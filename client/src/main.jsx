import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { QueryClientProvider } from '@tanstack/react-query'

import App from './App.jsx'
import theme, { darkTheme } from './theme.js'
import { queryClient } from './api/queryClient.js'
import { AuthProvider } from './auth/AuthContext.jsx'
import './index.css'

// Обираємо тему за збереженим у localStorage режимом
const activeTheme = localStorage.getItem('theme') === 'dark' ? darkTheme : theme

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={activeTheme}>
          <CssBaseline />
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
