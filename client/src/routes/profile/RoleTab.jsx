import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../../auth/useAuth.js'

const availKey = (id) => `lms.availability.${id}`

export function RoleTab() {
  const { user } = useAuth()
  const isInstructor = user?.role === 'Instructor'
  const [success, setSuccess] = useState('')

  const [status, setStatus] = useState(() => localStorage.getItem(availKey(user?.id)) || 'available')
  const [savingStatus, setSavingStatus] = useState(false)

  const handleStatus = () => {
    setSavingStatus(true)
    localStorage.setItem(availKey(user.id), status)
    setTimeout(() => {
      setSavingStatus(false)
      setSuccess('Статус доступності оновлено')
    }, 400)
  }

  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [absError, setAbsError] = useState('')
  const [sending, setSending] = useState(false)

  const handleAbsence = (e) => {
    e.preventDefault()
    setAbsError('')
    if (!date) return setAbsError('Оберіть дату відсутності')
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setDate('')
      setReason('')
      setSuccess('Повідомлення про відсутність надіслано')
    }, 600)
  }

  const content = isInstructor ? (
    <Box sx={{ maxWidth: 480 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Статус доступності</Typography>
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="status-label">Статус</InputLabel>
        <Select
          labelId="status-label"
          label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="available">Доступний</MenuItem>
          <MenuItem value="busy">Зайнятий</MenuItem>
          <MenuItem value="unavailable">Недоступний</MenuItem>
        </Select>
      </FormControl>
      <Button variant="contained" onClick={handleStatus} disabled={savingStatus}>
        {savingStatus ? 'Збереження…' : 'Оновити статус'}
      </Button>
    </Box>
  ) : (
    <Box component="form" onSubmit={handleAbsence} sx={{ maxWidth: 480 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Повідомлення про відсутність</Typography>
      {absError && <Alert severity="error" sx={{ mb: 2 }}>{absError}</Alert>}
      <TextField
        label="Дата відсутності"
        type="date"
        fullWidth
        value={date}
        onChange={(e) => setDate(e.target.value)}
        sx={{ mb: 2 }}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label="Причина"
        fullWidth
        multiline
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        sx={{ mb: 3 }}
        placeholder="Коротко опишіть причину відсутності"
      />
      <Button type="submit" variant="contained" disabled={sending}>
        {sending ? 'Надсилання…' : 'Повідомити викладача'}
      </Button>
    </Box>
  )

  return (
    <>
      {content}
      <Snackbar
        open={Boolean(success)}
        autoHideDuration={3000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </>
  )
}
