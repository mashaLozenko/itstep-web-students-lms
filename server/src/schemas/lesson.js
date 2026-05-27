import { z } from 'zod';

export const LessonBody = z.object({
  title: z.string().min(2).describe('Назва уроку'),
  contentMarkdown: z.string().describe('Вміст уроку у форматі Markdown / rich-text HTML'),
  releaseAt: z.string().datetime().nullable().optional().describe('Запланована дата публікації (ISO 8601). Null означає доступність одразу.'),
  order: z.number().int().min(0).optional().describe('Порядок відображення в межах розділу'),
});

export const UpdateLessonBody = LessonBody.partial();

export const ReorderLessonsBody = z.object({
  ids: z.array(z.string()).min(1).describe('ID уроків у бажаному порядку'),
});

export const LessonOut = z.object({
  id: z.string(),
  sectionId: z.string(),
  title: z.string(),
  contentMarkdown: z.string(),
  releaseAt: z.string().datetime().nullable(),
  order: z.number(),
  createdAt: z.string().datetime(),
  completed: z.boolean().optional().describe('Чи позначив автентифікований студент цей урок виконаним'),
});
