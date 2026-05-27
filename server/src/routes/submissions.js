import { z } from 'zod';
import { SubmissionOut, SubmissionsQuery, SubmissionsListResponse } from '../schemas/submission.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

function serialize(s) {
  return {
    ...s,
    submittedAt: s.submittedAt.toISOString(),
    assignment: s.assignment
      ? { ...s.assignment, dueAt: undefined, releaseAt: undefined, createdAt: undefined }
      : undefined,
    grade: s.grade
      ? { ...s.grade, gradedAt: s.grade.gradedAt.toISOString() }
      : null,
  };
}

export default async function submissionsRoutes(fastify) {
  // POST /api/v1/submissions — multipart form with optional file
  fastify.post('/', {
    preHandler: [fastify.requireRole('Student')],
    schema: {
      summary: 'Здати завдання',
      description: 'Надіслати текст та/або файл для завдання. Підтримує multipart/form-data. Поля: assignmentId (обов\'язкове), textBody (опціональний текст), file (опціональний файл). Одна здача на студента на завдання.',
      tags: ['Submissions'],
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: { 201: SubmissionOut, 409: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const parts = request.parts();
    const fields = {};
    let fileUrl = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = path.extname(part.filename || '');
        const filename = `${randomUUID()}${ext}`;
        const filePath = path.join(config.uploadDir, filename);
        await pipeline(part.file, fs.createWriteStream(filePath));
        fileUrl = `/uploads/${filename}`;
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    const { assignmentId, textBody } = fields;
    if (!assignmentId) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Поле assignmentId є обов\'язковим' } });
    }

    const assignment = await fastify.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Завдання не знайдено' } });
    }

    const existing = await fastify.prisma.submission.findUnique({
      where: { assignmentId_userId: { assignmentId, userId: request.user.sub } },
    });
    if (existing) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Ви вже здали це завдання' } });
    }

    const submission = await fastify.prisma.submission.create({
      data: {
        assignmentId,
        userId: request.user.sub,
        textBody: textBody || null,
        fileUrl,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignment: { select: { id: true, title: true, maxScore: true } },
        grade: true,
      },
    });

    return reply.code(201).send(serialize(submission));
  });

  // GET /api/v1/submissions
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список зданих робіт',
      description: 'Повертає пагінований список зданих робіт. Викладачі можуть фільтрувати за assignmentId, userId або статусом оцінювання. Студенти бачать лише свої здані роботи.',
      tags: ['Submissions'],
      security: [{ bearerAuth: [] }],
      querystring: SubmissionsQuery,
      response: { 200: SubmissionsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const { assignmentId, userId, graded, sort = 'submittedAt', order = 'desc' } = request.query;

    const where = {};
    if (request.user.role === 'Student') {
      where.userId = request.user.sub;
    } else {
      if (userId) where.userId = userId;
    }
    if (assignmentId) where.assignmentId = assignmentId;
    if (graded === 'true') where.grade = { isNot: null };
    if (graded === 'false') where.grade = { is: null };

    const [total, submissions] = await Promise.all([
      fastify.prisma.submission.count({ where }),
      fastify.prisma.submission.findMany({
        where, skip, take,
        orderBy: { [sort]: order },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          assignment: { select: { id: true, title: true, maxScore: true } },
          grade: true,
        },
      }),
    ]);

    return { data: submissions.map(serialize), meta: buildMeta(total, page, pageSize) };
  });

  // GET /api/v1/submissions/:id
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати здану роботу за ID',
      description: 'Повертає повні дані зданої роботи. Студенти можуть переглядати лише свої здані роботи; викладачі — будь-яку.',
      tags: ['Submissions'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: SubmissionOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const submission = await fastify.prisma.submission.findUnique({
      where: { id: request.params.id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignment: { select: { id: true, title: true, maxScore: true } },
        grade: true,
      },
    });
    if (!submission) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Здану роботу не знайдено' } });

    if (request.user.role === 'Student' && submission.userId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Це не ваша здана робота' } });
    }

    return serialize(submission);
  });
}
