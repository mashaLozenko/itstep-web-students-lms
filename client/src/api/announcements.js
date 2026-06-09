import apiClient from './client.js'

export const createAnnouncement = async (courseId, body) => {
  const { data } = await apiClient.post(`/courses/${courseId}/announcements`, body)
  return data
}
