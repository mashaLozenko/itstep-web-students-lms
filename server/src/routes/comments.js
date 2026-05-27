import { z } from 'zod';
import { CommentBody, CommentOut, CommentsQuery } from '../schemas/comment.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';

function serialize(c) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    author: c.author
      ? { id: c.author.id, fullName: c.author.fullName, avatarUrl: c.author.avatarUrl ?? null }
      : undefined,
    replies: c.replies ? c.replies.map(serialize) : [],
  };
}

export default async function commentsRoutes(fastify) {
  // GET /api/v1/comments
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список коментарів до уроку або оцінки',
      description: 'Повертає дерево коментарів для вказаного батьківського об\'єкта (урок або оцінка). Коментарі верхнього рівня містять вкладені відповіді. Видалені коментарі показуються з прихованим текстом.',
      tags: ['Comments'],
      security: [{ bearerAuth: [] }],
      querystring: CommentsQuery,
      response: { 200: z.object({ data: z.array(CommentOut) }) },
    },
  }, async (request, reply) => {
    const { parentType, parentId } = request.query;

    // Fetch all comments for this parent (flat list, then build tree)
    const allComments = await fastify.prisma.comment.findMany({
      where: { parentType, parentId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    // Redact deleted comments
    const redacted = allComments.map((c) =>
      c.deletedAt
        ? { ...c, body: '[видалено]' }
        : c
    );

    // Build tree: top-level comments with nested replies
    const byId = new Map(redacted.map((c) => [c.id, { ...serialize(c), replies: [] }]));
    const roots = [];
    for (const comment of byId.values()) {
      if (comment.parentCommentId) {
        const parent = byId.get(comment.parentCommentId);
        if (parent) parent.replies.push(comment);
      } else {
        roots.push(comment);
      }
    }

    return { data: roots };
  });

  // POST /api/v1/comments — unified endpoint for both Lesson and Grade comments
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Додати коментар',
      description: 'Опублікувати коментар до уроку або до оцінки. Підтримує вкладені відповіді через parentCommentId. Надсилає сповіщення зацікавленим сторонам.',
      tags: ['Comments'],
      security: [{ bearerAuth: [] }],
      body: z.object({
        parentType: z.enum(['Lesson', 'Grade']).describe('Тип батьківського обʼєкта'),
        parentId: z.string().describe('ID уроку або оцінки'),
        body: z.string().min(1).describe('Текст коментаря'),
        parentCommentId: z.string().nullable().optional().describe('ID батьківського коментаря (для вкладеної відповіді)'),
      }),
      response: { 201: CommentOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const { parentType, parentId, body, parentCommentId } = request.body;

    if (parentType === 'Lesson') {
      const lesson = await fastify.prisma.lesson.findUnique({ where: { id: parentId } });
      if (!lesson) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Урок не знайдено' } });

      const comment = await fastify.prisma.comment.create({
        data: {
          authorId: request.user.sub,
          parentType: 'Lesson',
          parentId,
          parentCommentId: parentCommentId || null,
          body,
        },
        include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
      });

      try {
        const section = await fastify.prisma.section.findUnique({
          where: { id: lesson.sectionId },
          include: { course: { select: { instructorId: true } } },
        });
        if (section && section.course.instructorId !== request.user.sub) {
          await fastify.pushNotification(section.course.instructorId, 'comment_added', {
            commentId: comment.id,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            authorName: comment.author.fullName,
          });
        }
      } catch (_) { /* notification failure is non-fatal */ }

      return reply.code(201).send(serialize(comment));
    }

    // parentType === 'Grade'
    const grade = await fastify.prisma.grade.findUnique({
      where: { id: parentId },
      include: { submission: true },
    });
    if (!grade) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Оцінку не знайдено' } });

    const comment = await fastify.prisma.comment.create({
      data: {
        authorId: request.user.sub,
        parentType: 'Grade',
        parentId,
        parentCommentId: parentCommentId || null,
        body,
      },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    try {
      const targetUserId = request.user.sub === grade.submission.userId
        ? grade.instructorId
        : grade.submission.userId;
      await fastify.pushNotification(targetUserId, 'comment_added', {
        commentId: comment.id,
        gradeId: grade.id,
        authorName: comment.author.fullName,
      });
    } catch (_) { /* notification failure is non-fatal */ }

    return reply.code(201).send(serialize(comment));
  });

  // DELETE /api/v1/comments/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Видалити коментар',
      description: 'М\'яке видалення коментаря шляхом встановлення deletedAt. Текст коментаря замінюється на "[видалено]" у наступних відповідях. Лише автор може видаляти свої коментарі.',
      tags: ['Comments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const comment = await fastify.prisma.comment.findUnique({ where: { id: request.params.id } });
    if (!comment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Коментар не знайдено' } });
    if (comment.authorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви можете видаляти лише свої коментарі' } });
    }

    await fastify.prisma.comment.update({
      where: { id: request.params.id },
      data: { deletedAt: new Date() },
    });

    return reply.code(204).send();
  });
}
