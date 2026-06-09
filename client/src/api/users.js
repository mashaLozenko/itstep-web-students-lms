import apiClient from './client.js'

export const getUsers = async (params) => {
  const { data } = await apiClient.get('/users', { params })
  return data
}

export const getUser = async (id) => {
  const { data } = await apiClient.get(`/users/${id}`)
  return data
}

export const updateProfile = async (id, body) => {
  const { data } = await apiClient.patch(`/users/${id}`, body)
  return data
}

export const uploadAvatar = async (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post(`/users/${id}/avatar`, formData)
  return data
}
