import apiClient from './client.js'

export const getNotifications = async ({ page = 1, pageSize = 20 } = {}) => {
  const { data } = await apiClient.get('/notifications', { params: { page, pageSize } })
  return data
}

export const markNotificationRead = async (id) => {
  const { data } = await apiClient.patch(`/notifications/${id}/read`)
  return data
}

export const markAllNotificationsRead = async () => {
  const { data } = await apiClient.patch('/notifications/read-all')
  return data
}
