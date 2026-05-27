import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard,
  MenuBook,
  Build,
  Assignment,
  Grade,
  TableChart,
  CalendarMonth,
  Announcement,
  LibraryBooks,
  Person,
  Logout,
  People,
} from '@mui/icons-material'
import { useAuth } from '../auth/useAuth.js'
import { NotificationBell } from './NotificationBell.jsx'

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || 'http://localhost:4000'
const resolveAvatarUrl = (url) => !url ? '' : url.startsWith('/uploads/') ? `${UPLOADS_BASE}${url}` : url
import { Logo } from './Logo.jsx'

const DRAWER_WIDTH = 220

const studentNavItems = [
  { label: 'Панель', icon: <Dashboard />, path: '/dashboard' },
  { label: 'Курси', icon: <MenuBook />, path: '/courses' },
  { label: 'Мої оцінки', icon: <Grade />, path: '/grades' },
  { label: 'Календар', icon: <CalendarMonth />, path: '/calendar' },
  { label: 'Бібліотека', icon: <LibraryBooks />, path: '/library' },
  { label: 'Сповіщення', icon: <Announcement />, path: '/notifications' },
  { label: 'Профіль', icon: <Person />, path: '/profile' },
]

const instructorNavItems = [
  { label: 'Панель', icon: <Dashboard />, path: '/dashboard' },
  { label: 'Курси', icon: <MenuBook />, path: '/courses' },
  { label: 'Здані роботи', icon: <Assignment />, path: '/submissions' },
  { label: 'Журнал оцінок', icon: <TableChart />, path: '/gradebook' },
  { label: 'Календар', icon: <CalendarMonth />, path: '/calendar' },
  { label: 'Бібліотека', icon: <LibraryBooks />, path: '/library' },
  { label: 'Студенти', icon: <People />, path: '/users' },
  { label: 'Сповіщення', icon: <Announcement />, path: '/notifications' },
  { label: 'Профіль', icon: <Person />, path: '/profile' },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState(null)

  const navItems = user?.role === 'Instructor' ? instructorNavItems : studentNavItems

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev)
  const handleUserMenuOpen = (e) => setAnchorEl(e.currentTarget)
  const handleUserMenuClose = () => setAnchorEl(null)

  const handleLogout = () => {
    handleUserMenuClose()
    logout()
    navigate('/login')
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 2 }}>
        <Logo />
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => {
                  navigate(item.path)
                  if (isMobile) setMobileOpen(false)
                }}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  color: 'rgba(255,255,255,0.85)',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    '& .MuiListItemIcon-root': { color: '#fff' },
                  },
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'rgba(255,255,255,0.7)' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
          {user?.role}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }} noWrap>
          {user?.fullName}
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <NotificationBell />
          <Tooltip title="Акаунт">
            <IconButton onClick={handleUserMenuOpen} sx={{ ml: 1 }}>
              <Avatar
                src={resolveAvatarUrl(user?.avatarUrl)}
                alt={user?.fullName}
                sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}
              >
                {user?.fullName?.[0] ?? 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* User menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleUserMenuClose}>
        <MenuItem onClick={() => { handleUserMenuClose(); navigate('/profile') }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          Профіль
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          Вийти
        </MenuItem>
      </Menu>

      {/* Drawer — mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Drawer — desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          mt: '64px',
          p: 3,
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
