import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Alert,
  Chip,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PhotoCamera } from '@mui/icons-material'
import { useAuth } from '../../auth/useAuth.js'
import { updateProfile, uploadAvatar } from '../../api/users.js'
import { formatDate } from '../../utils/notifications.js'

const ROLE_LABELS = { Student: 'Студент', Instructor: 'Викладач' }
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || 'http://localhost:4000'

const resolveAvatarUrl = (url) =>
  !url ? '' : url.startsWith('/uploads/') ? `${UPLOADS_BASE}${url}` : url

export function PersonalDataTab() {
  const { user, updateUser } = useAuth()
  const fileInputRef = useRef(null)

  // Телефон та "про себе" не зберігаються на сервері — читаємо/пишемо в localStorage
  const extrasKey = `lms.profile.${user?.id}`
  const savedExtras = (() => {
    try {
      return JSON.parse(localStorage.getItem(extrasKey) || '{}')
    } catch {
      return {}
    }
  })()

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState(savedExtras.phone ?? '')
  const [bio, setBio] = useState(savedExtras.bio ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Збереження персональних даних: ім'я — на сервер, телефон/опис — локально
  const saveMutation = useMutation({
    mutationFn: (body) => updateProfile(user.id, body),
    onSuccess: (updated) => {
      updateUser(updated)
      setSuccess('Дані успішно оновлено')
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Не вдалося зберегти дані'),
  })

  const avatarMutation = useMutation({
    mutationFn: (file) => uploadAvatar(user.id, file),
    onSuccess: (updated) => {
      updateUser(updated)
      setSuccess('Фото профілю оновлено')
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Не вдалося завантажити фото'),
  })

  const handleSave = (e) => {
    e.preventDefault()
    setError('')
    const trimmed = fullName.trim()
    if (trimmed.length < 2) {
      setError("Ім'я має містити щонайменше 2 символи")
      return
    }
    localStorage.setItem(extrasKey, JSON.stringify({ phone: phone.trim(), bio: bio.trim() }))
    saveMutation.mutate({ fullName: trimmed })
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' 
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Дозволені лише зображення (PNG, JPEG, WEBP, GIF)')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Файл завеликий (максимум 2 МБ)')
      return
    }
    avatarMutation.mutate(file)
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Аватар */}
      <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 4 }}>
        <Avatar
          src={resolveAvatarUrl(user?.avatarUrl)}
          alt={user?.fullName}
          sx={{ width: 88, height: 88, bgcolor: 'primary.main', fontSize: 32 }}
        >
          {user?.fullName?.[0] ?? 'U'}
        </Avatar>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PhotoCamera />}
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
          >
            {avatarMutation.isPending ? 'Завантаження…' : 'Змінити фото'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            PNG, JPEG, WEBP або GIF, до 2 МБ
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={handleFileChange}
          />
        </Box>
      </Stack>

      {/* Форма персональних даних */}
      <Box component="form" onSubmit={handleSave} sx={{ maxWidth: 480 }}>
        <TextField
          label="Ім'я та прізвище"
          fullWidth
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Номер телефону"
          fullWidth
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          sx={{ mb: 2 }}
          placeholder="+380 .."
        />
        <TextField
          label="Про себе"
          fullWidth
          multiline
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          sx={{ mb: 2 }}
          placeholder="Коротка інформація про себе"
        />
        <TextField
          label="Електронна пошта"
          fullWidth
          value={user?.email ?? ''}
          sx={{ mb: 2 }}
          InputProps={{ readOnly: true }}
          helperText="Пошту можна змінити на вкладці «Безпека»"
        />
        <TextField
          label="Роль"
          fullWidth
          value={ROLE_LABELS[user?.role] ?? user?.role ?? ''}
          sx={{ mb: 2 }}
          InputProps={{ readOnly: true }}
        />
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Статус акаунта</Typography>
          <Chip label="Активний" color="success" size="small" />
        </Box>
        <TextField
          label="Дата реєстрації"
          fullWidth
          value={formatDate(user?.createdAt)}
          sx={{ mb: 3 }}
          InputProps={{ readOnly: true }}
        />
        <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Збереження…' : 'Зберегти'}
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
