import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const UserPublic = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.enum(['Student', 'Instructor']),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const UpdateUserBody = z.object({
  fullName: z.string().min(2).optional().describe('Оновлене повне ім\'я'),
  avatarUrl: z
    .string()
    .refine(
      (v) => v === '' || v.startsWith('/uploads/') || /^https?:\/\//.test(v),
      { message: 'Має бути URL (http(s)://…) або шлях до завантаженого файлу (/uploads/…)' },
    )
    .nullable()
    .optional()
    .describe('URL зовнішнього зображення або відносний шлях до завантаженого файлу'),
});

export const UsersQuery = PaginationQuery.extend({
  role: z.enum(['Student', 'Instructor']).optional().describe('Фільтр за роллю'),
  q: z.string().optional().describe('Пошук за ім\'ям або електронною поштою'),
});

export const UsersListResponse = z.object({
  data: z.array(UserPublic),
  meta: PaginationMeta,
});
