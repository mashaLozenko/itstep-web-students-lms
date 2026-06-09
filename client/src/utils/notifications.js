import dayjs from 'dayjs'
import { Grade, Announcement, ChatBubbleOutline, NotificationsNone } from '@mui/icons-material'

function parsePayload(payloadJson) {
  if (!payloadJson) return {}
  if (typeof payloadJson === 'object') return payloadJson
  try {
    return JSON.parse(payloadJson)
  } catch {
    return {}
  }
}

export function describeNotification(notification) {
  const p = parsePayload(notification.payloadJson ?? notification.payload)

  switch (notification.kind) {
    case 'grade_posted':
      return {
        Icon: Grade,
        title: 'Нова оцінка',
        text: `Оцінено роботу «${p.assignmentTitle ?? 'завдання'}»${
          p.score != null ? ` — ${p.score} балів` : ''
        }${p.courseTitle ? ` (${p.courseTitle})` : ''}`,
        to: '/grades',
      }
    case 'announcement_published':
      return {
        Icon: Announcement,
        title: 'Нове оголошення',
        text: `${p.courseTitle ? `${p.courseTitle}: ` : ''}${p.title ?? 'Нове оголошення в курсі'}`,
        to: p.courseId ? `/courses/${p.courseId}/announcements` : '/notifications',
      }
    case 'comment_added':
      return {
        Icon: ChatBubbleOutline,
        title: 'Новий коментар',
        text: p.message
          ? p.message
          : p.courseTitle
            ? `Новий коментар у курсі «${p.courseTitle}»`
            : 'До вашої роботи додано новий коментар',
        to: p.courseId ? `/courses/${p.courseId}` : '/notifications',
      }
    default:
      return {
        Icon: NotificationsNone,
        title: 'Сповіщення',
        text: p.title ?? p.message ?? 'У вас нове сповіщення',
        to: '/notifications',
      }
  }
}


export const formatDate = (iso) => (iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '')
