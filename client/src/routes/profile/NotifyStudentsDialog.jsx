import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import { useAuth } from '../../auth/useAuth.js'
import { getCourses } from '../../api/courses.js'
import { createAnnouncement } from '../../api/announcements.js'


export function NotifyStudentsDialog({ open, onClose, onSent }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')


  const { data, isLoading } = useQuery({
    queryKey: ['courses', 'mine'],
    queryFn: () => getCourses({ pageSize: 100 }),
    enabled: open,
  })
  const myCourses = (data?.data ?? []).filter((c) => c.instructor?.id === user?.id)

  const mutation = useMutation({
    mutationFn: () => createAnnouncement(courseId, { title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      resetAndClose()
      onSent?.()
    },
    onError: (err) => setError(err.response?.data?.error?.message || 'Не вдалося надіслати сповіщення'),
  })

  const resetAndClose = () => {
    setCourseId('')
    setTitle('')
    setBody('')
    setError('')
    onClose()
  }

  const handleSend = () => {
    setError('')
    if (!courseId) return setError('Оберіть курс')
    if (title.trim().length < 2) return setError('Введіть заголовок')
    if (body.trim().length < 2) return setError('Введіть текст повідомлення')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="sm">
      <DialogTitle>Надіслати сповіщення студентам</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <FormControl fullWidth sx={{ mt: 1, mb: 2 }} disabled={isLoading}>
          <InputLabel id="course-label">Курс</InputLabel>
          <Select
            labelId="course-label"
            label="Курс"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {myCourses.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Заголовок"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Текст повідомлення"
          fullWidth
          multiline
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={resetAndClose}>Скасувати</Button>
        <Button variant="contained" onClick={handleSend} disabled={mutation.isPending}>
          {mutation.isPending ? 'Надсилання…' : 'Надіслати'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
