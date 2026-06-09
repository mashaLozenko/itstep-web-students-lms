import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  IconButton,
  Popover,
  Box,
  Typography,
  Button,
  Divider,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Tooltip,
  
} from '@mui/material'
import { Notifications as NotificationsIcon } from '@mui/icons-material'
import { useAuth } from '../auth/useAuth.js'
import { listNotifications, markRead } from '../api/notifications.js'
import { describeNotification, formatDate } from '../utils/notifications.js'

const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:4000'

export function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { token } = useAuth()

  useEffect(() => {
    if (!token) return
    const ws = new WebSocket(`${WS_BASE}/ws/notifications?token=${token}`)
    ws.onmessage = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    return () => ws.close()
  }, [token, queryClient])

  const { data } = useQuery({
    queryKey: ['notifications', { bell: true }],
    queryFn: () => listNotifications({ pageSize: 8, unreadOnly: 'true' }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const items = data?.data ?? []
  const unreadCount = data?.meta?.total ?? 0

  const handleClick = (n) => {
    markReadMutation.mutate(n.id)
    setAnchorEl(null)
    const { to } = describeNotification(n)
    if (to) navigate(to)
  }

  return (
    <>
      <Tooltip title="Сповіщення">
        <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge color="error" badgeContent={unreadCount} max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Сповіщення{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Typography>
        </Box>
        <Divider />

        {items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Непрочитаних сповіщень немає.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((n) => {
              const info = describeNotification(n)
              return (
                <ListItemButton key={n.id} divider onClick={() => handleClick(n)}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                      <info.Icon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={info.title}
                    secondary={`${info.text} — ${formatDate(n.createdAt)}`}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              )
            })}
          </List>
        )}

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              setAnchorEl(null)
              navigate('/notifications')
            }}
          >
            Переглянути всі
          </Button>
        </Box>
      </Popover>
    </>
  )
}
