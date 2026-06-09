import apiClient from './client.js'

export const listNotifications = async (params) => {
  const { data } = await apiClient.get('/notifications', { params })
  return data
}

export const markRead = async (id) => {
  const { data } = await apiClient.patch(`/notifications/${id}/read`)
  return data
}

export const markAllRead = async () => {
  const { data } = await apiClient.patch('/notifications/read-all')
  return data
}
