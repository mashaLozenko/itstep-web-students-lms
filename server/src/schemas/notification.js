import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const NotificationOut = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.string().describe('Тип сповіщення, наприклад: grade_posted, comment_added, announcement_published'),
  payloadJson: z.string().describe('JSON-рядок з даними події'),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const NotificationsQuery = PaginationQuery.extend({
  unreadOnly: z.enum(['true', 'false']).optional().describe('Повертати лише непрочитані сповіщення'),
});

export const NotificationsListResponse = z.object({
  data: z.array(NotificationOut),
  meta: PaginationMeta,
});
