import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const AnnouncementBody = z.object({
  title: z.string().min(3).describe('Заголовок оголошення'),
  body: z.string().min(10).describe('Текст оголошення у форматі plain text або Markdown'),
});

export const UpdateAnnouncementBody = AnnouncementBody.partial();

export const AnnouncementOut = z.object({
  id: z.string(),
  courseId: z.string(),
  instructorId: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  instructor: z.object({ id: z.string(), fullName: z.string() }).optional(),
});

export const AnnouncementsListResponse = z.object({
  data: z.array(AnnouncementOut),
  meta: PaginationMeta,
});

export const AnnouncementsQuery = PaginationQuery;
