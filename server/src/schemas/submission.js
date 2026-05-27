import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const SubmissionOut = z.object({
  id: z.string(),
  assignmentId: z.string(),
  userId: z.string(),
  textBody: z.string().nullable(),
  fileUrl: z.string().nullable(),
  submittedAt: z.string().datetime(),
  user: z.object({ id: z.string(), fullName: z.string(), email: z.string() }).optional(),
  assignment: z.object({ id: z.string(), title: z.string(), maxScore: z.number() }).optional(),
  grade: z.object({ id: z.string(), score: z.number(), gradedAt: z.string().datetime() }).nullable().optional(),
});

export const SubmissionsQuery = PaginationQuery.extend({
  assignmentId: z.string().optional().describe('Фільтр за ID завдання'),
  userId: z.string().optional().describe('Фільтр за ID студента'),
  graded: z.enum(['true', 'false']).optional().describe('Фільтр за статусом оцінювання'),
  sort: z.enum(['submittedAt', 'userId']).optional().default('submittedAt').describe('Поле сортування'),
  order: z.enum(['asc', 'desc']).optional().default('desc').describe('Напрямок сортування'),
});

export const SubmissionsListResponse = z.object({
  data: z.array(SubmissionOut),
  meta: PaginationMeta,
});
