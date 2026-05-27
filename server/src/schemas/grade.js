import { z } from 'zod';

export const GradeBody = z.object({
  score: z.number().min(0).describe('Числовий бал'),
});

export const UpdateGradeBody = z.object({
  score: z.number().min(0).describe('Оновлений числовий бал'),
});

export const GradeOut = z.object({
  id: z.string(),
  submissionId: z.string(),
  score: z.number(),
  instructorId: z.string(),
  gradedAt: z.string().datetime(),
  submission: z.object({
    id: z.string(),
    userId: z.string(),
    assignmentId: z.string(),
  }).optional(),
  instructor: z.object({ id: z.string(), fullName: z.string() }).optional(),
});
