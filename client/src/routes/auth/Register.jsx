import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff, School } from '@mui/icons-material'
import { useAuth } from '../../auth/useAuth.js'

export function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'Student' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('Пароль має містити щонайменше 6 символів.')
      return
    }
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Помилка реєстрації.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <School color="primary" sx={{ fontSize: 48 }} />
            <Typography variant="h5" fontWeight={700}>
              Створити акаунт
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Приєднайтесь до платформи LMS
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Повне ім'я"
              fullWidth
              required
              value={form.fullName}
              onChange={handleChange('fullName')}
              sx={{ mb: 2 }}
              autoComplete="name"
            />
            <TextField
              label="Електронна пошта"
              type="email"
              fullWidth
              required
              value={form.email}
              onChange={handleChange('email')}
              sx={{ mb: 2 }}
              autoComplete="email"
            />
            <TextField
              label="Пароль"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              required
              value={form.password}
              onChange={handleChange('password')}
              sx={{ mb: 2 }}
              helperText="Щонайменше 6 символів"
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Typography variant="body2" gutterBottom>
              Я є:
            </Typography>
            <ToggleButtonGroup
              value={form.role}
              exclusive
              onChange={(_, val) => val && setForm((f) => ({ ...f, role: val }))}
              sx={{ mb: 3, width: '100%' }}
            >
              <ToggleButton value="Student" sx={{ flex: 1 }}>
                Студент
              </ToggleButton>
              <ToggleButton value="Instructor" sx={{ flex: 1 }}>
                Викладач
              </ToggleButton>
            </ToggleButtonGroup>

            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
              {loading ? 'Створення акаунту…' : 'Зареєструватися'}
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Вже маєте акаунт?{' '}
            <Link component={RouterLink} to="/login">
              Увійти
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
