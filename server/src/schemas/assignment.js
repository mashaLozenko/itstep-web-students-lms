import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const AssignmentBody = z.object({
  title: z.string().min(2).describe('Назва завдання'),
  descriptionMarkdown: z.string().describe('Повний опис завдання у форматі Markdown'),
  dueAt: z.string().datetime().describe('Дедлайн (ISO 8601)'),
  releaseAt: z.string().datetime().nullable().optional().describe('Коли завдання стає видимим для студентів'),
  maxScore: z.number().int().min(1).default(100).optional().describe('Максимально можливий бал'),
});

export const UpdateAssignmentBody = AssignmentBody.partial();

export const AssignmentOut = z.object({
  id: z.string(),
  sectionId: z.string(),
  title: z.string(),
  descriptionMarkdown: z.string(),
  dueAt: z.string().datetime(),
  releaseAt: z.string().datetime().nullable(),
  maxScore: z.number(),
  createdAt: z.string().datetime(),
  _count: z.object({ submissions: z.number() }).optional(),
});

export const AssignmentsQuery = PaginationQuery.extend({
  sectionId: z.string().optional().describe('Фільтр за ID розділу'),
});

export const AssignmentsListResponse = z.object({
  data: z.array(AssignmentOut),
  meta: PaginationMeta,
});
