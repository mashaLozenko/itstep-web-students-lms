import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'


export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [success, setSuccess] = useState('')

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  const handlePassword = (e) => {
    e.preventDefault()
    setPwError('')
    if (!currentPassword) return setPwError('Введіть поточний пароль')
    if (newPassword.length < 8) return setPwError('Новий пароль має містити щонайменше 8 символів')
    if (newPassword !== confirmPassword) return setPwError('Паролі не збігаються')
    setPwLoading(true)
    // Імітація запиту на сервер (endpoint не реалізовано)
    setTimeout(() => {
      setPwLoading(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Пароль успішно змінено')
    }, 600)
  }

  const handleEmail = (e) => {
    e.preventDefault()
    setEmailError('')
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return setEmailError('Введіть коректну електронну пошту')
    setEmailLoading(true)
    setTimeout(() => {
      setEmailLoading(false)
      setNewEmail('')
      setSuccess('Електронну пошту змінено')
    }, 600)
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      {/* Зміна пароля */}
      <Box component="form" onSubmit={handlePassword}>
        <Typography variant="h6" sx={{ mb: 2 }}>Зміна пароля</Typography>
        {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
        <TextField
          label="Поточний пароль"
          type="password"
          fullWidth
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          sx={{ mb: 2 }}
          autoComplete="current-password"
        />
        <TextField
          label="Новий пароль"
          type="password"
          fullWidth
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          sx={{ mb: 2 }}
          autoComplete="new-password"
        />
        <TextField
          label="Підтвердіть новий пароль"
          type="password"
          fullWidth
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={passwordMismatch}
          helperText={passwordMismatch ? 'Паролі не збігаються' : ' '}
          sx={{ mb: 2 }}
          autoComplete="new-password"
        />
        <Button type="submit" variant="contained" disabled={pwLoading}>
          {pwLoading ? 'Збереження…' : 'Змінити пароль'}
        </Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Зміна пошти */}
      <Box component="form" onSubmit={handleEmail}>
        <Typography variant="h6" sx={{ mb: 2 }}>Зміна електронної пошти</Typography>
        {emailError && <Alert severity="error" sx={{ mb: 2 }}>{emailError}</Alert>}
        <TextField
          label="Нова електронна пошта"
          type="email"
          fullWidth
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          sx={{ mb: 2 }}
          autoComplete="email"
        />
        <Button type="submit" variant="contained" disabled={emailLoading}>
          {emailLoading ? 'Збереження…' : 'Змінити пошту'}
        </Button>
      </Box>

      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Box>
  )
}
