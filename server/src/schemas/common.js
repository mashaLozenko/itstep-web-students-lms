import { z } from 'zod';

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Номер сторінки (починається з 1)'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('Елементів на сторінці (макс. 100)'),
});

export const PaginationMeta = z.object({
  total: z.number().int().describe('Загальна кількість елементів'),
  page: z.number().int().describe('Поточний номер сторінки'),
  pageSize: z.number().int().describe('Елементів на сторінці'),
  totalPages: z.number().int().describe('Загальна кількість сторінок'),
});

export const ErrorResponse = z.object({
  error: z.object({
    code: z.enum(['VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL']),
    message: z.string(),
    details: z.array(z.any()).optional(),
  }),
});

export const IdParam = z.object({
  id: z.string().describe('ID ресурсу (cuid)'),
});

export const MessageResponse = z.object({
  message: z.string(),
});
