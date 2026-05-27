import apiClient from './client.js'

export const login = async ({ email, password }) => {
  const { data } = await apiClient.post('/auth/login', { email, password })
  return data
}

export const register = async ({ email, password, fullName, role }) => {
  const { data } = await apiClient.post('/auth/register', { email, password, fullName, role })
  return data
}

export const getMe = async () => {
  const { data } = await apiClient.get('/auth/me')
  return data
}
