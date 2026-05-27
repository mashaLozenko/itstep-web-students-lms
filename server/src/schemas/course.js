import { z } from 'zod';
import { PaginationQuery, PaginationMeta } from './common.js';

export const FinalControl = z.enum(['Pass', 'GradedPass', 'Exam']);

export const CourseBody = z.object({
  title: z.string().min(3).describe('Назва дисципліни'),
  description: z.string().min(10).describe('Опис курсу у форматі plain text або Markdown'),
  status: z.enum(['Draft', 'Published', 'Archived']).optional().default('Draft').describe('Статус публікації'),
  creditsEcts: z.number().int().min(1).max(30).optional().default(5).describe('Кількість кредитів ECTS'),
  semester: z.string().min(3).optional().default('2026-Spring').describe('Семестр викладання, напр. "2026-Spring"'),
  finalControl: FinalControl.optional().default('Exam').describe('Тип підсумкового контролю: Pass (залік), GradedPass (диференційований залік), Exam (екзамен)'),
  syllabusUrl: z.string().url().nullable().optional().describe('Посилання на офіційний силабус (URL)'),
});

export const UpdateCourseBody = CourseBody.partial();

export const CourseOut = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  instructorId: z.string(),
  status: z.enum(['Draft', 'Published', 'Archived']),
  creditsEcts: z.number().int(),
  semester: z.string(),
  finalControl: FinalControl,
  syllabusUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  instructor: z.object({ id: z.string(), fullName: z.string(), email: z.string().optional(), avatarUrl: z.string().nullable().optional() }).optional(),
  _count: z.object({ enrollments: z.number(), sections: z.number() }).optional(),
  myEnrollment: z.object({
    status: z.enum(['Pending', 'Approved']),
    hiddenByStudent: z.boolean(),
  }).nullable().optional().describe('Запис автентифікованого студента на цей курс, якщо існує'),
  sections: z.array(z.object({
    id: z.string(),
    courseId: z.string(),
    title: z.string(),
    order: z.number().int(),
    createdAt: z.string().datetime(),
    lessons: z.array(z.object({
      id: z.string(),
      sectionId: z.string(),
      title: z.string(),
      order: z.number().int(),
      releaseAt: z.string().datetime().nullable(),
      createdAt: z.string().datetime(),
    })).optional(),
    assignments: z.array(z.object({
      id: z.string(),
      sectionId: z.string(),
      title: z.string(),
      dueAt: z.string().datetime(),
      releaseAt: z.string().datetime().nullable(),
      maxScore: z.number().int(),
      createdAt: z.string().datetime(),
    })).optional(),
  })).optional(),
});

export const CoursesQuery = PaginationQuery.extend({
  q: z.string().optional().describe('Повнотекстовий пошук за назвою та описом'),
  status: z.enum(['Draft', 'Published', 'Archived']).optional().describe('Фільтр за статусом'),
  sort: z.enum(['createdAt', 'title', 'updatedAt']).optional().default('createdAt').describe('Поле сортування'),
  order: z.enum(['asc', 'desc']).optional().default('desc').describe('Напрямок сортування'),
});

export const CoursesListResponse = z.object({
  data: z.array(CourseOut),
  meta: PaginationMeta,
});
