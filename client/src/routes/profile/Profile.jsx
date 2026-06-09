import { useState } from 'react'
import { Box, Card, CardContent, Tab, Tabs, Typography } from '@mui/material'
import { useAuth } from '../../auth/useAuth.js'
import { PersonalDataTab } from './PersonalDataTab.jsx'
import { SecurityTab } from './SecurityTab.jsx'
import { SettingsTab } from './SettingsTab.jsx'
import { RoleTab } from './RoleTab.jsx'

export function Profile() {
  const { user } = useAuth()
  const [tab, setTab] = useState(0)

  const isInstructor = user?.role === 'Instructor'
  const roleTabLabel = isInstructor ? 'Доступність' : 'Відсутність'

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Особистий кабінет</Typography>
      <Card>
        <Tabs
          value={tab}
          onChange={(e, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Персональні дані" />
          <Tab label="Безпека" />
          <Tab label="Налаштування" />
          <Tab label={roleTabLabel} />
        </Tabs>
        <CardContent sx={{ p: 3 }}>
          {tab === 0 && <PersonalDataTab />}
          {tab === 1 && <SecurityTab />}
          {tab === 2 && <SettingsTab />}
          {tab === 3 && <RoleTab />}
        </CardContent>
      </Card>
    </Box>
  )
}
