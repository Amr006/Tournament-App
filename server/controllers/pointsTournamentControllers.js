const Node = require("../models/PointsTournamentNode");
const Tournament = require("../models/Tournament");
const FinishedTournament = require("../models/FinishedTournament");
const roundrobin = require("roundrobin-tournament-js");
const fs = require("fs");

//const lodash = require("lodash");
const axios = require("axios");
const { round } = require("lodash");

var timeValue = new Map();

timeValue.set("Rapid", 600);
timeValue.set("Blitz", 300);
timeValue.set("Classic", 1800);

const displayNodes = async (req, res, next) => {
  const tournament_Id = req.params.id;
  console.log("result");
  await Node.find({ tournamentID: tournament_Id })
    .populate("tournamentID")
    .then(async (result) => {
      var roundNumber =
    Math.floor(
      data[0].tournamentID.FinishedMatches / (data[0].tournamentID.Players.length/2)
    ) + 1;
      if (result.length !== 0) {
        return res.status(200).json({
          data: result,
          current_round : roundNumber
        });
      } else {
        var data = [];
        await Tournament.findOne({ _id: tournament_Id })
          .then(async (result) => {
            //console.log(result);

            if (result) {
              var arr = result.Players;
              const rounds = roundrobin(arr);
              console.log(rounds);

              var data = {};

              for (var i = 0; i < arr.length; i++) {
                data[arr[i]] = [];
              }

              for (var i = 0; i < rounds.length; i++) {
                for (let j = 0; j < rounds[i].length; j++) {
                  let playerOne = rounds[i][j][0];
                  let playerTwo = rounds[i][j][1];

                  let formData = new URLSearchParams();
                  var nodeTime = timeValue.get(result.Time);
                  formData.append("clock.limit", nodeTime);
                  formData.append("users", `${playerOne},${playerTwo}`);
                  formData.append("clock.increment", 0);

                  try {
                    let response = await axios.post(
                      "https://lichess.org/api/challenge/open",
                      formData,
                      {
                        headers: {
                          "Content-Type": "application/x-www-form-urlencoded",
                        },
                      }
                    );

                    var MatchOne = {
                      Player: playerTwo,
                      gameID: response.data.challenge.id,
                      gameLink: response.data.challenge.url,
                      round: i + 1,
                    };
                    var MatchTwo = {
                      Player: playerOne,
                      gameID: response.data.challenge.id,
                      gameLink: response.data.challenge.url,
                      round: i + 1,
                    };

                    data[playerOne].push(MatchOne);
                    data[playerTwo].push(MatchTwo);
                  } catch (error) {
                    console.log(error);
                    res.json(error);
                  }
                }
              }

              var WholeData = [];
              //console.log(data)
              var keys = Object.keys(data);
              console.log(keys);
              for (let i = 0; i < keys.length; i++) {
                var playerMatches = new Node({
                  Name: keys[i],
                  tournamentID: tournament_Id,
                  Matches: data[keys[i]],
                });

                try {
                  await playerMatches.save();
                  WholeData.push(playerMatches);
                  console.log(WholeData);
                } catch (err) {
                  console.log(err);
                }
              }

              console.log("WholeData");
              console.log(WholeData);
              return res.status(200).json({
                data: WholeData,
                current_round : 1
              });
            }
          })
          .catch((err) => {
            console.log(err);
          });
      }
    });
};

const gameEnds = async (req, res, next) => {
  const game_Id = req.params.game_id;
  console.log(game_Id);
  //console.log(req.forfree);

  try {
    if (req.hasOwnProperty("forfree")) {
      var winnerName = req.forfree;
      var response = { data: {} };
    } else {
      var response = await axios.get(
        `https://lichess.org/game/export/${game_Id}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      );

      //console.log(response.data);
      if (response.status === 200) {
        console.log("Request successful");
        // Handle successful response
      } else {
        console.log("Request failed with status:", response.status);
        // Handle other statuses
      }

      if (
        response.data.hasOwnProperty("winner") ||
        response.data.status == "draw"
      ) {
        if (response.data.status != "draw") {
          var winner = response.data.winner;
          var winnerName = response.data.players[winner].user.name;
        }
      } else {
        //console.log("the game is not finished yet !!");
        return res.status(404).json({
          message: "the game is not finished",
        });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(404).json({
      message: "game is not started yet",
      error: err,
    });
  }
  const data = await Node.find({
    Matches: { $elemMatch: { gameID: game_Id } }, // Matches the specified element in the Matches array
  }).populate("tournamentID");
  console.log(game_Id);
  console.log(data);
  var response = { data: {} };
  var roundNumber =
    Math.floor(
      data[0].tournamentID.FinishedMatches / (data[0].tournamentID.Players.length/2)
    ) + 1;
  
  if (
    response.data.hasOwnProperty("status") &&
    response.data.status == "draw" &&
    data[0].Matches[roundNumber - 1].winner == "*"
  ) {
    data[0].Matches[roundNumber - 1].winner = "draw";
    data[0].Points += 1;
    data[1].Matches[roundNumber - 1].winner = "draw";
    data[1].Points += 1;
  } else {
    if (
      data[0].Name == winnerName &&
      data[0].Matches[roundNumber - 1].winner == "*"
    ) {
      data[0].Matches[roundNumber - 1].winner = winnerName;
      data[0].Points += 2;
      data[1].Matches[roundNumber - 1].winner = winnerName;
    } else if (data[0].Matches[roundNumber - 1].winner == "*") {
      data[1].Matches[roundNumber - 1].winner = winnerName;
      data[1].Points += 2;
      data[0].Matches[roundNumber - 1].winner = winnerName;
    }
  }
  data[0].tournamentID.FinishedMatches += 1;
  if (roundNumber == data[0].tournamentID.Players.length) {
    data[0].tournamentID.Winner = winnerName;
  }
  await data[0].tournamentID.save();
  const promises = data.map((document) => document.save());
  await Promise.all(promises);

  req.params.id = data[0].tournamentID;
  return next();
};

const abortMatch = async (req, res, next) => {
  const user = req.userName;
  const game_Id = req.params.game_Id;
  console.log(game_Id);
  const timeNow = Date.now();

  await Node.find({
    Matches: { $elemMatch: { gameID: game_Id } },
  })
    .populate("tournamentID")
    .then((result) => {
      try {
        const round =
          Math.floor(
            result[0].tournamentID.FinishedMatches /
            (data[0].tournamentID.Players.length/2)
          ) + 1;
        if (
          !result[0].Matches[round - 1].hasOwnProperty("secondUserEntered") &&
          result[0].Matches[round - 1].firstUserEntered.User == user
        ) {
          var timeDifferenceMs =
            result[0].Matches[round - 1].firstUserEntered.Time.getTime() -
            timeNow;
          console.log(Math.abs(timeDifferenceMs / (1000 * 60)));
          if (Math.abs(timeDifferenceMs / (1000 * 60)) > 10) {
            req.forfree = user;
            console.log(user);
            return next();
          }
        }
      } catch (err) {
        return res.status(402).json({
          message: `Can't abort this match now`,
        });
      }
    });
};

const savingEntry = async (req, res, next) => {
  const user = req.userName;
  const game_Id = req.params.game_Id;

  await Node.find({
    Matches: { $elemMatch: { gameID: game_Id } },
  })
    .populate("tournamentID")
    .populate("Matches")
    .then(async (result) => {
      console.log(result);
      const round =
        Math.floor(
          result[0].tournamentID.FinishedMatches /
          (data[0].tournamentID.Players.length/2)
        ) + 1;
      const timeNow = Date.now();
      const data = {
        User: user,
        Time: timeNow,
      };
      console.log(round);
      console.log(result[0].Matches[0]);
      if (!result[0].Matches[round - 1].hasOwnProperty("firstUserEntered")) {
        result[0].Matches[round - 1].firstUserEntered = data;
        result[1].Matches[round - 1].firstUserEntered = data;
      } else if (
        !result[0].Matches[round - 1].hasOwnProperty("secondUserEntered")
      ) {
        result[0].Matches[round - 1].secondUserEntered = data;
        result[1].Matches[round - 1].secondUserEntered = data;
      }

      const promises = result.map((document) => document.save());
      await Promise.all(promises);

      res.status(200).json({
        message: "User entered match successfully !",
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

//  function generateTournamentSchedule(numberOfPlayers) {
//   if (numberOfPlayers % 2 !== 0) {
//     throw new Error("Number of players must be even.");
//   }

//   const schedule = [];
//   const players = Array.from({ length: numberOfPlayers }, (_, i) => i + 1);

//   for (let round = 0; round < numberOfPlayers - 1; round++) {
//     const roundSchedule = [];
//     const player1 = players[0];
//     const player2 = players[players.length - 1];

//     roundSchedule.push([player1, player2]);

//     for (let i = 1; i < numberOfPlayers / 2; i++) {
//       const opponent1 = players[i];
//       const opponent2 = players[players.length - 1 - i];

//       roundSchedule.push([opponent1, opponent2]);
//     }

//     schedule.push(roundSchedule);

//     // Rotate players for the next round
//     players.splice(1, 0, players.pop());
//   }

//   return schedule;
// }

// try {
//   const numberOfPlayers = 4; // Replace this with your desired number of players (must be even)
//   const tournamentSchedule = generateTournamentSchedule(numberOfPlayers);
//   console.log(JSON.stringify(tournamentSchedule, null, 2));
// } catch (error) {
//   console.error(error.message);
// }

module.exports = { displayNodes, gameEnds, savingEntry, abortMatch };
