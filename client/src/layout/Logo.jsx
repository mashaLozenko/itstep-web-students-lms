import { School } from '@mui/icons-material'
import { Box, Typography } from '@mui/material'

export function Logo() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
      <School sx={{ fontSize: 28, color: 'inherit' }} />
      <Typography variant="h6" sx={{ fontWeight: 700, color: 'inherit', letterSpacing: 0.5 }}>
        LMS
      </Typography>
    </Box>
  )
}
