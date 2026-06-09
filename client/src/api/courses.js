import apiClient from './client.js'

export const getCourses = async (params) => {
  const { data } = await apiClient.get('/courses', { params })
  return data
}
