import { z } from 'zod';
import { AssignmentBody, UpdateAssignmentBody, AssignmentOut, AssignmentsQuery, AssignmentsListResponse } from '../schemas/assignment.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

function serialize(a) {
  return {
    ...a,
    dueAt: a.dueAt.toISOString(),
    releaseAt: a.releaseAt ? a.releaseAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

export default async function assignmentsRoutes(fastify) {
  // GET /api/v1/courses/:id/assignments
  fastify.get('/courses/:id/assignments', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список завдань курсу',
      description: 'Повертає пагінований список усіх завдань по всіх розділах курсу. Опціонально фільтрувати за sectionId.',
      tags: ['Assignments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      querystring: AssignmentsQuery,
      response: { 200: AssignmentsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const where = { section: { courseId: request.params.id } };
    if (request.query.sectionId) where.sectionId = request.query.sectionId;

    const [total, assignments] = await Promise.all([
      fastify.prisma.assignment.count({ where }),
      fastify.prisma.assignment.findMany({
        where, skip, take,
        orderBy: { dueAt: 'asc' },
        include: { _count: { select: { submissions: true } } },
      }),
    ]);

    return { data: assignments.map(serialize), meta: buildMeta(total, page, pageSize) };
  });

  // GET /api/v1/sections/:id/assignments
  fastify.get('/sections/:id/assignments', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список завдань розділу',
      description: 'Повертає всі завдання у вказаному розділі.',
      tags: ['Assignments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      querystring: AssignmentsQuery,
      response: { 200: AssignmentsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const where = { sectionId: request.params.id };

    const [total, assignments] = await Promise.all([
      fastify.prisma.assignment.count({ where }),
      fastify.prisma.assignment.findMany({
        where, skip, take,
        orderBy: { dueAt: 'asc' },
        include: { _count: { select: { submissions: true } } },
      }),
    ]);

    return { data: assignments.map(serialize), meta: buildMeta(total, page, pageSize) };
  });

  // GET /api/v1/assignments/:id
  fastify.get('/assignments/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати завдання за ID',
      description: 'Повертає повні дані завдання, включаючи опис у форматі Markdown, дедлайн та кількість зданих робіт.',
      tags: ['Assignments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: AssignmentOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const assignment = await fastify.prisma.assignment.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!assignment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Завдання не знайдено' } });
    return serialize(assignment);
  });

  // POST /api/v1/sections/:id/assignments
  fastify.post('/sections/:id/assignments', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Створити завдання',
      description: 'Додати нове завдання до розділу з дедлайном та описом у форматі Markdown. Лише викладач курсу може додавати завдання.',
      tags: ['Assignments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: AssignmentBody,
      response: { 201: AssignmentOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const section = await fastify.prisma.section.findUnique({
      where: { id: request.params.id },
      include: { course: true },
    });
    if (!section) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Розділ не знайдено' } });
    if (section.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const assignment = await fastify.prisma.assignment.create({
      data: {
        sectionId: request.params.id,
        title: request.body.title,
        descriptionMarkdown: request.body.descriptionMarkdown,
        dueAt: new Date(request.body.dueAt),
        releaseAt: request.body.releaseAt ? new Date(request.body.releaseAt) : null,
        maxScore: request.body.maxScore ?? 100,
      },
      include: { _count: { select: { submissions: true } } },
    });

    return reply.code(201).send(serialize(assignment));
  });

  // PATCH /api/v1/assignments/:id
  fastify.patch('/assignments/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити завдання',
      description: 'Оновити деталі завдання: назву, опис, дедлайн або максимальний бал. Лише викладач курсу може змінювати завдання.',
      tags: ['Assignments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateAssignmentBody,
      response: { 200: AssignmentOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const assignment = await fastify.prisma.assignment.findUnique({
      where: { id: request.params.id },
      include: { section: { include: { course: true } } },
    });
    if (!assignment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Завдання не знайдено' } });
    if (assignment.section.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const data = { ...request.body };
    if (data.dueAt) data.dueAt = new Date(data.dueAt);
    if (data.releaseAt !== undefined) data.releaseAt = data.releaseAt ? new Date(data.releaseAt) : null;

    const updated = await fastify.prisma.assignment.update({
      where: { id: request.params.id },
      data,
      include: { _count: { select: { submissions: true } } },
    });
    return serialize(updated);
  });

  // DELETE /api/v1/assignments/:id
  fastify.delete('/assignments/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити завдання',
      description: 'Остаточно видалити завдання та всі його здані роботи та оцінки. Лише викладач курсу може видаляти завдання.',
      tags: ['Assignments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const assignment = await fastify.prisma.assignment.findUnique({
      where: { id: request.params.id },
      include: { section: { include: { course: true } } },
    });
    if (!assignment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Завдання не знайдено' } });
    if (assignment.section.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    await fastify.prisma.assignment.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
