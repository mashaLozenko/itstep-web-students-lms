import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import 'dayjs/locale/uk.js'

dayjs.extend(relativeTime)
dayjs.locale('uk')

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return dayjs(dateStr).format('MMM D, YYYY')
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return dayjs(dateStr).format('MMM D, YYYY h:mm A')
}

export const formatRelative = (dateStr) => {
  if (!dateStr) return '—'
  return dayjs(dateStr).fromNow()
}

export const formatISODate = (date) => {
  return dayjs(date).toISOString()
}
