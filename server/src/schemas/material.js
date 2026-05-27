import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const MaterialBody = z.object({
  title: z.string().min(2).describe('Назва матеріалу'),
  kind: z.enum(['Video', 'Link', 'File']).describe('Тип навчального матеріалу'),
  url: z.string().url().nullable().optional().describe('URL для типів Video або Link'),
  description: z.string().describe('Опис матеріалу'),
});

export const UpdateMaterialBody = MaterialBody.partial();

export const MaterialOut = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['Video', 'Link', 'File']),
  url: z.string().nullable(),
  fileUrl: z.string().nullable(),
  description: z.string(),
  creatorId: z.string(),
  createdAt: z.string().datetime(),
  creator: z.object({ id: z.string(), fullName: z.string() }).optional(),
  isFavorited: z.boolean().optional().describe('Чи додав автентифікований користувач цей матеріал до вибраного'),
});

export const MaterialsQuery = PaginationQuery.extend({
  q: z.string().optional().describe('Пошук за назвою або описом'),
  kind: z.enum(['Video', 'Link', 'File']).optional().describe('Фільтр за типом матеріалу'),
  favoritesOnly: z.enum(['true', 'false']).optional().describe('Повертати лише вибрані матеріали'),
});

export const MaterialsListResponse = z.object({
  data: z.array(MaterialOut),
  meta: PaginationMeta,
});
