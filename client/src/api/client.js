import axios from 'axios'

// Don't set a default Content-Type — axios picks the right one based on the body
// (application/json for plain objects, multipart/form-data with boundary for FormData).
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api/v1',
})

// Request interceptor — inject JWT from localStorage and strip empty query params
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.params && typeof config.params === 'object') {
    config.params = Object.fromEntries(
      Object.entries(config.params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    )
  }
  return config
})

// Response interceptor — on 401 from an authenticated request clear token + redirect.
// Skip for /auth/* endpoints so wrong-password login doesn't reload the page.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? ''
    const isAuthEndpoint = url.startsWith('/auth') || url.includes('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default apiClient
