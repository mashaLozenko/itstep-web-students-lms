import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControlLabel,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Pagination,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { DoneAll, Send } from '@mui/icons-material'
import { useAuth } from '../../auth/useAuth.js'
import { listNotifications, markRead, markAllRead } from '../../api/notifications.js'
import { describeNotification, formatDate } from '../../utils/notifications.js'
import { NotifyStudentsDialog } from './NotifyStudentsDialog.jsx'

const PAGE_SIZE = 15

function initialUnreadOnly() {
  try {
    return JSON.parse(localStorage.getItem('lms.settings') || '{}').messageDisplay === 'unread'
  } catch {
    return false
  }
}

export function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(initialUnreadOnly)
  const [dialogOpen, setDialogOpen] = useState(false)

  const isInstructor = user?.role === 'Instructor'

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', { page, unreadOnly, pageSize: PAGE_SIZE }],
    queryFn: () =>
      listNotifications({ page, pageSize: PAGE_SIZE, unreadOnly: unreadOnly ? 'true' : undefined }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const items = data?.data ?? []
  const totalPages = data?.meta?.totalPages ?? 1

  const handleItemClick = (n) => {
    if (!n.readAt) markReadMutation.mutate(n.id)
    const { to } = describeNotification(n)
    if (to && to !== '/notifications') navigate(to)
  }

  const handleFilterChange = (e) => {
    setUnreadOnly(e.target.checked)
    setPage(1)
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Сповіщення</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={<Switch checked={unreadOnly} onChange={handleFilterChange} />}
            label="Лише непрочитані"
          />
          <Button
            startIcon={<DoneAll />}
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            Прочитати всі
          </Button>
          {isInstructor && (
            <Button variant="contained" startIcon={<Send />} onClick={() => setDialogOpen(true)}>
              Надіслати студентам
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : error ? (
          <Typography color="error" sx={{ py: 4, textAlign: 'center' }}>Не вдалося завантажити сповіщення</Typography>
        ) : items.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Сповіщень немає</Typography>
        ) : (
          <List disablePadding>
            {items.map((n) => {
              const info = describeNotification(n)
              const unread = !n.readAt
              return (
                <ListItemButton
                  key={n.id}
                  divider
                  onClick={() => handleItemClick(n)}
                  sx={{ bgcolor: unread ? 'action.hover' : 'transparent' }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: unread ? 'primary.main' : 'grey.400' }}>
                      <info.Icon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={unread ? 700 : 500}>{info.title}</Typography>
                        {unread && <Chip label="Нове" size="small" color="primary" />}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {info.text}
                        </Typography>
                        {' — '}
                        {formatDate(n.createdAt)}
                      </>
                    }
                  />
                </ListItemButton>
              )
            })}
          </List>
        )}
      </Card>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(e, value) => setPage(value)} color="primary" />
        </Box>
      )}

      <NotifyStudentsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  )
}
