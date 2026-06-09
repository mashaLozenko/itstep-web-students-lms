import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

const DEFAULTS = {
  language: 'uk',
  pushGrades: true,
  pushAnnouncements: true,
  pushComments: false,
  showEmail: true,
  messageDisplay: 'all', // 'all' | 'unread'
}

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('lms.settings') || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}


export function SettingsTab() {
  const [settings, setSettings] = useState(loadSettings)
  const [success, setSuccess] = useState(false)

  const theme = localStorage.getItem('theme') || 'light'

  const handleThemeChange = (e, value) => {
    if (!value) return
    localStorage.setItem('theme', value)
    window.location.reload() 
  }

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }))

  const handleSave = () => {
    localStorage.setItem('lms.settings', JSON.stringify(settings))
    setSuccess(true)
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      {/* Тема оформлення */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Тема оформлення</Typography>
      <ToggleButtonGroup value={theme} exclusive onChange={handleThemeChange} size="small">
        <ToggleButton value="light">Світла</ToggleButton>
        <ToggleButton value="dark">Темна</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 3 }}>
        Застосовується одразу до всього інтерфейсу
      </Typography>

      {/* Мова інтерфейсу */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="lang-label">Мова інтерфейсу</InputLabel>
        <Select
          labelId="lang-label"
          label="Мова інтерфейсу"
          value={settings.language}
          onChange={(e) => update('language', e.target.value)}
        >
          <MenuItem value="uk">Українська</MenuItem>
          <MenuItem value="en">English</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 1 }} />

      {/* Push-сповіщення */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Push-сповіщення</Typography>
      <FormGroup sx={{ mb: 3 }}>
        <FormControlLabel
          control={<Switch checked={settings.pushGrades} onChange={(e) => update('pushGrades', e.target.checked)} />}
          label="Нові оцінки"
        />
        <FormControlLabel
          control={<Switch checked={settings.pushAnnouncements} onChange={(e) => update('pushAnnouncements', e.target.checked)} />}
          label="Оголошення курсів"
        />
        <FormControlLabel
          control={<Switch checked={settings.pushComments} onChange={(e) => update('pushComments', e.target.checked)} />}
          label="Коментарі до робіт"
        />
      </FormGroup>

      {/* Відображення повідомлень */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="display-label">Відображення повідомлень</InputLabel>
        <Select
          labelId="display-label"
          label="Відображення повідомлень"
          value={settings.messageDisplay}
          onChange={(e) => update('messageDisplay', e.target.value)}
        >
          <MenuItem value="all">Усі повідомлення</MenuItem>
          <MenuItem value="unread">Лише непрочитані</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 1 }} />

      {/* Конфіденційність */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Конфіденційність</Typography>
      <FormControlLabel
        control={<Switch checked={settings.showEmail} onChange={(e) => update('showEmail', e.target.checked)} />}
        label="Показувати мою пошту іншим користувачам"
        sx={{ mb: 3, display: 'block' }}
      />

      <Button variant="contained" onClick={handleSave}>
        Зберегти налаштування
      </Button>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess(false)}>Налаштування збережено</Alert>
      </Snackbar>
    </Box>
  )
}
