import { useState } from 'react'
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  Box,
  Divider,
  CircularProgress,
} from '@mui/material'
import { Notifications as NotificationsIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications.js'
import { formatRelative } from '../utils/formatDate.js'

const NOTIFICATION_KIND_LABELS = {
  grade_posted: 'Нова оцінка',
  new_comment: 'Новий коментар',
  new_announcement: 'Нове оголошення',
  enrollment_approved: 'Запис на курс затверджено',
  submission_received: 'Здану роботу отримано',
  assignment_due: 'Наближається дедлайн завдання',
}

function notificationKindLabel(kind) {
  if (!kind) return ''
  return NOTIFICATION_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ')
}

export function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { page: 1, pageSize: 15 }],
    queryFn: () => getNotifications({ page: 1, pageSize: 15 }),
  })

  const notifications = data?.data ?? []
  const unreadCount = notifications.filter((n) => !n.readAt).length

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const handleOpen = (e) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)
  const open = Boolean(anchorEl)

  const handleClickNotification = (n) => {
    if (!n.readAt) markRead.mutate(n.id)
  }

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} aria-label="notifications">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 480 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Сповіщення
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              Позначити всі прочитаними
            </Button>
          )}
        </Box>
        <Divider />

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!isLoading && notifications.length === 0 && (
          <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            Сповіщень ще немає
          </Typography>
        )}

        <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
          {notifications.map((n) => (
            <ListItem
              key={n.id}
              button
              onClick={() => handleClickNotification(n)}
              sx={{
                bgcolor: n.readAt ? 'transparent' : 'action.hover',
                alignItems: 'flex-start',
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={n.readAt ? 400 : 600}>
                    {notificationKindLabel(n.kind)}
                  </Typography>
                }
                secondary={
                  <>
                    <Typography variant="caption" component="span" display="block">
                      {typeof n.payloadJson === 'string'
                        ? (() => { try { return JSON.parse(n.payloadJson)?.message ?? '' } catch { return '' } })()
                        : n.payloadJson?.message ?? ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelative(n.createdAt)}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </>
  )
}
