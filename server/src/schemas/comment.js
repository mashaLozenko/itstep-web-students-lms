import { z } from 'zod';

export const CommentBody = z.object({
  body: z.string().min(1).describe('Текст коментаря'),
  parentCommentId: z.string().nullable().optional().describe('ID батьківського коментаря для вкладених відповідей'),
});

// Author sub-object
const CommentAuthor = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

// Flat comment (no recursive replies in schema — tree is built in route logic)
export const CommentOut = z.object({
  id: z.string(),
  authorId: z.string(),
  parentType: z.enum(['Lesson', 'Grade']),
  parentId: z.string(),
  parentCommentId: z.string().nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  author: CommentAuthor.optional(),
  replies: z.array(z.object({
    id: z.string(),
    authorId: z.string(),
    parentType: z.enum(['Lesson', 'Grade']),
    parentId: z.string(),
    parentCommentId: z.string().nullable(),
    body: z.string(),
    createdAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
    author: CommentAuthor.optional(),
    replies: z.array(z.any()).optional(),
  })).optional(),
});

export const CommentsQuery = z.object({
  parentType: z.enum(['Lesson', 'Grade']).describe('Фільтр за типом батьківського об\'єкта'),
  parentId: z.string().describe('Фільтр за ID батьківського ресурсу'),
});
