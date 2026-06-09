import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { getUsers, getUser } from '../../api/users.js'
import { formatDate } from '../../utils/notifications.js'

const PAGE_SIZE = 12
const ROLE_LABELS = { Student: 'Студент', Instructor: 'Викладач' }
const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || 'http://localhost:4000'

// /uploads/... -> повний URL (так само, як у AppShell)
const resolveAvatarUrl = (url) =>
  !url ? '' : url.startsWith('/uploads/') ? `${UPLOADS_BASE}${url}` : url

function UserDetailDialog({ userId, onClose }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
    enabled: Boolean(userId),
  })

  return (
    <Dialog open={Boolean(userId)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Профіль користувача</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : error ? (
          <Typography color="error" sx={{ py: 2 }}>Не вдалося завантажити профіль</Typography>
        ) : user && (
          <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
            <Avatar
              src={resolveAvatarUrl(user.avatarUrl)}
              alt={user.fullName}
              sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 30 }}
            >
              {user.fullName?.[0] ?? 'U'}
            </Avatar>
            <Typography variant="h6">{user.fullName}</Typography>
            <Chip label={ROLE_LABELS[user.role] ?? user.role} color="primary" variant="outlined" />
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2" color="text.secondary">Електронна пошта</Typography>
              <Typography sx={{ mb: 1 }}>{user.email}</Typography>
              <Typography variant="body2" color="text.secondary">Дата реєстрації</Typography>
              <Typography>{formatDate(user.createdAt)}</Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function UsersList() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', { q, role, page, pageSize: PAGE_SIZE }],
    queryFn: () => getUsers({ q, role, page, pageSize: PAGE_SIZE }),
  })

  const users = data?.data ?? []
  const totalPages = data?.meta?.totalPages ?? 1

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Користувачі</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Пошук за ім'ям або поштою"
          size="small"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="role-filter">Роль</InputLabel>
          <Select
            labelId="role-filter"
            label="Роль"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1) }}
          >
            <MenuItem value="">Усі ролі</MenuItem>
            <MenuItem value="Student">Студенти</MenuItem>
            <MenuItem value="Instructor">Викладачі</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Card>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : error ? (
          <Typography color="error" sx={{ py: 4, textAlign: 'center' }}>Не вдалося завантажити користувачів</Typography>
        ) : users.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Користувачів не знайдено</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Користувач</TableCell>
                <TableCell>Електронна пошта</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Зареєстрований</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  hover
                  onClick={() => setSelectedId(u.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={resolveAvatarUrl(u.avatarUrl)}
                        alt={u.fullName}
                        sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}
                      >
                        {u.fullName?.[0] ?? 'U'}
                      </Avatar>
                      <Typography>{u.fullName}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(e, value) => setPage(value)} color="primary" />
        </Box>
      )}

      <UserDetailDialog userId={selectedId} onClose={() => setSelectedId(null)} />
    </Box>
  )
}
