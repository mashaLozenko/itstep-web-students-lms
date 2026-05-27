import { useState } from 'react'
import {
  Badge,
  IconButton,
  Popover,
  Box,
  Typography,
  Divider,
  Tooltip,
} from '@mui/material'
import { Notifications as NotificationsIcon } from '@mui/icons-material'

/**
 * Заглушка дзвоника сповіщень.
 * Тут має бути ваша інтеграція з API нотифікацій + WebSocket.
 */
export function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  return (
    <>
      <Tooltip title="Сповіщення">
        <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge color="error" variant="dot" invisible>
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
        slotProps={{ paper: { sx: { width: 360 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>Сповіщення</Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Сповіщень немає.
          </Typography>
        </Box>
      </Popover>
    </>
  )
}
