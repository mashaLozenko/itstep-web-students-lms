import { z } from 'zod';

export const SectionBody = z.object({
  title: z.string().min(2).describe('Назва розділу'),
  order: z.number().int().min(0).optional().describe('Порядок відображення (ціле число від 0)'),
});

export const UpdateSectionBody = SectionBody.partial();

export const ReorderBody = z.object({
  ids: z.array(z.string()).min(1).describe('ID розділів у бажаному порядку'),
});

export const SectionOut = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  order: z.number(),
  createdAt: z.string().datetime(),
  _count: z.object({ lessons: z.number(), assignments: z.number() }).optional(),
});
