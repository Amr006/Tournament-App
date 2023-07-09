import { Box, TextField, Typography } from '@mui/material'
import React from 'react'
import { MyButton } from '../MyButton/MyButton'

const ForgotPasswordForm = ({values , touched, errors , handleBlur, handleChange}) => {
        return (
        <>
            <Typography variant='h3' className={`text-center game-font flex-center`}>Forgot Your Password ?</Typography>
            <TextField className={`grid-stretch email`} label="Username" name='forgot_pass_username' value={values.forgot_pass_username} onChange={handleChange} id="forgot_pass_username" error={Boolean(touched.forgot_pass_username) && Boolean(errors.forgot_pass_username)} helperText={touched.forgot_pass_username && errors.forgot_pass_username} onBlur={handleBlur}/>
            <Box className={`flex-center btn`}>
                {/*onClick Wait Till End*/}
                <MyButton type="submit">Reset Password</MyButton>
            </Box>
        </>
    )
}

export default ForgotPasswordForm
