import { z } from 'zod';
import { ErrorResponse, IdParam } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

const EnrollmentOut = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  status: z.enum(['Pending', 'Approved']),
  hiddenByStudent: z.boolean(),
  createdAt: z.string().datetime(),
  user: z.object({ id: z.string(), fullName: z.string(), email: z.string() }).optional(),
  course: z.object({ id: z.string(), title: z.string() }).optional(),
});

const EnrollmentsListResponse = z.object({
  data: z.array(EnrollmentOut),
  meta: z.object({ total: z.number(), page: z.number(), pageSize: z.number(), totalPages: z.number() }),
});

function serialize(e) {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
  };
}

export default async function enrollmentsRoutes(fastify) {
  // POST /api/v1/courses/:id/enroll
  fastify.post('/courses/:id/enroll', {
    preHandler: [fastify.requireRole('Student')],
    schema: {
      summary: 'Записатись на курс',
      description: 'Записати автентифікованого студента на вказаний курс. Створює запис зі статусом Очікує; викладач може підтвердити його через PATCH.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 201: EnrollmentOut, 409: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course || course.status !== 'Published') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено або не опубліковано' } });
    }

    const existing = await fastify.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: request.user.sub, courseId: request.params.id } },
    });
    if (existing) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Ви вже записані на цей курс' } });
    }

    const enrollment = await fastify.prisma.enrollment.create({
      data: { userId: request.user.sub, courseId: request.params.id },
      include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { id: true, title: true } } },
    });

    return reply.code(201).send(serialize(enrollment));
  });

  // POST /api/v1/courses/:id/enrollments — instructor directly enrolls a student
  fastify.post('/courses/:id/enrollments', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Додати студента на курс (викладач)',
      description: 'Викладач курсу безпосередньо додає студента. За замовчуванням створює запис зі статусом Approved (без потреби підтвердження). Тільки власник курсу може це робити.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: z.object({
        userId: z.string().describe('ID студента, якого додають на курс'),
        status: z.enum(['Pending', 'Approved']).optional().default('Approved').describe('Статус створеного запису'),
      }),
      response: { 201: EnrollmentOut, 403: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є викладачем цього курсу' } });
    }
    const target = await fastify.prisma.user.findUnique({ where: { id: request.body.userId } });
    if (!target) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Користувача не знайдено' } });
    if (target.role !== 'Student') {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'На курс можна записати лише користувачів з роллю Студент' } });
    }

    const existing = await fastify.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: target.id, courseId: request.params.id } },
    });
    if (existing) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Цей студент уже записаний на курс' } });
    }

    const enrollment = await fastify.prisma.enrollment.create({
      data: { userId: target.id, courseId: request.params.id, status: request.body.status ?? 'Approved' },
      include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { id: true, title: true } } },
    });
    return reply.code(201).send(serialize(enrollment));
  });

  // DELETE /api/v1/enrollments/:id — instructor removes a student from their course
  fastify.delete('/enrollments/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити запис студента з курсу',
      description: 'Викладач курсу видаляє запис студента. Не видаляє самі здані роботи студента, лише знімає його з курсу.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const enrollment = await fastify.prisma.enrollment.findUnique({
      where: { id: request.params.id },
      include: { course: true },
    });
    if (!enrollment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Запис не знайдено' } });
    if (enrollment.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є викладачем цього курсу' } });
    }
    await fastify.prisma.enrollment.delete({ where: { id: request.params.id } });
    return reply.code(204).send(null);
  });

  // GET /api/v1/courses/:id/enrollments
  fastify.get('/courses/:id/enrollments', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список записів на курс',
      description: 'Повертає пагінований список записів на курс. Викладачі бачать усі записи; студенти — лише свої.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      querystring: z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(['Pending', 'Approved']).optional(),
      }),
      response: { 200: EnrollmentsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const where = { courseId: request.params.id };
    if (request.query.status) where.status = request.query.status;
    if (request.user.role === 'Student') where.userId = request.user.sub;

    const [total, enrollments] = await Promise.all([
      fastify.prisma.enrollment.count({ where }),
      fastify.prisma.enrollment.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { id: true, title: true } } },
      }),
    ]);

    return { data: enrollments.map(serialize), meta: buildMeta(total, page, pageSize) };
  });

  // PATCH /api/v1/enrollments/:id/approve
  fastify.patch('/enrollments/:id/approve', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Підтвердити запис на курс',
      description: 'Підтвердити запит на запис, що очікує. Лише викладач курсу може підтверджувати записи.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: EnrollmentOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const enrollment = await fastify.prisma.enrollment.findUnique({
      where: { id: request.params.id },
      include: { course: true },
    });
    if (!enrollment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Запис не знайдено' } });
    if (enrollment.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const updated = await fastify.prisma.enrollment.update({
      where: { id: request.params.id },
      data: { status: 'Approved' },
      include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { id: true, title: true } } },
    });
    return serialize(updated);
  });

  // POST /api/v1/enrollments/:id/hide
  fastify.post('/enrollments/:id/hide', {
    preHandler: [fastify.requireRole('Student')],
    schema: {
      summary: 'Приховати запис на курс з дашборду студента',
      description: 'Студенти можуть приховати запис, щоб прибрати його зі списку активних курсів без відписки.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: EnrollmentOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const enrollment = await fastify.prisma.enrollment.findUnique({ where: { id: request.params.id } });
    if (!enrollment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Запис не знайдено' } });
    if (enrollment.userId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Це не ваш запис' } });
    }

    const updated = await fastify.prisma.enrollment.update({
      where: { id: request.params.id },
      data: { hiddenByStudent: true },
      include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { id: true, title: true } } },
    });
    return serialize(updated);
  });

  // POST /api/v1/enrollments/:id/unhide
  fastify.post('/enrollments/:id/unhide', {
    preHandler: [fastify.requireRole('Student')],
    schema: {
      summary: 'Показати прихований запис на курс',
      description: 'Відновити раніше прихований запис у списку активних курсів студента.',
      tags: ['Enrollments'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: EnrollmentOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const enrollment = await fastify.prisma.enrollment.findUnique({ where: { id: request.params.id } });
    if (!enrollment) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Запис не знайдено' } });
    if (enrollment.userId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Це не ваш запис' } });
    }

    const updated = await fastify.prisma.enrollment.update({
      where: { id: request.params.id },
      data: { hiddenByStudent: false },
      include: { user: { select: { id: true, fullName: true, email: true } }, course: { select: { id: true, title: true } } },
    });
    return serialize(updated);
  });
}
