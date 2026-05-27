import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1565C0',
      light: '#5E92F3',
      dark: '#003C8F',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FF6F00',
      light: '#FFA000',
      dark: '#E65100',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F5F7FA',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1565C0',
          color: '#ffffff',
        },
      },
    },
  },
})

export default theme
