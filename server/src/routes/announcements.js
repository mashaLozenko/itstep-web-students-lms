import { z } from 'zod';
import { AnnouncementBody, UpdateAnnouncementBody, AnnouncementOut, AnnouncementsListResponse, AnnouncementsQuery } from '../schemas/announcement.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

function serialize(a) {
  return {
    ...a,
    createdAt: a.createdAt.toISOString(),
    instructor: a.instructor ? { id: a.instructor.id, fullName: a.instructor.fullName } : undefined,
  };
}

export default async function announcementsRoutes(fastify) {
  // GET /api/v1/courses/:id/announcements
  fastify.get('/courses/:id/announcements', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список оголошень курсу',
      description: 'Повертає пагіновані оголошення курсу в зворотному хронологічному порядку. Записані студенти та викладач курсу можуть переглядати оголошення.',
      tags: ['Announcements'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      querystring: AnnouncementsQuery,
      response: { 200: AnnouncementsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);

    const [total, announcements] = await Promise.all([
      fastify.prisma.announcement.count({ where: { courseId: request.params.id } }),
      fastify.prisma.announcement.findMany({
        where: { courseId: request.params.id },
        skip, take,
        orderBy: { createdAt: 'desc' },
        include: { instructor: { select: { id: true, fullName: true } } },
      }),
    ]);

    return { data: announcements.map(serialize), meta: buildMeta(total, page, pageSize) };
  });

  // POST /api/v1/courses/:id/announcements
  fastify.post('/courses/:id/announcements', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Створити оголошення',
      description: 'Опублікувати нове оголошення для всіх записаних студентів курсу. Надсилає WebSocket-сповіщення та зберігає запис Notification для кожного записаного студента.',
      tags: ['Announcements'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: AnnouncementBody,
      response: { 201: AnnouncementOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const announcement = await fastify.prisma.announcement.create({
      data: {
        courseId: request.params.id,
        instructorId: request.user.sub,
        title: request.body.title,
        body: request.body.body,
      },
      include: { instructor: { select: { id: true, fullName: true } } },
    });

    // Notify all enrolled students asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        const enrollments = await fastify.prisma.enrollment.findMany({
          where: { courseId: request.params.id, status: 'Approved' },
          select: { userId: true },
        });
        for (const { userId } of enrollments) {
          await fastify.pushNotification(userId, 'announcement_published', {
            announcementId: announcement.id,
            courseId: request.params.id,
            courseTitle: course.title,
            title: announcement.title,
          });
        }
      } catch (_) { /* notification failure is non-fatal */ }
    });

    return reply.code(201).send(serialize(announcement));
  });

  // GET /api/v1/announcements/:id
  fastify.get('/announcements/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати оголошення за ID',
      description: 'Повертає повні дані одного оголошення.',
      tags: ['Announcements'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: AnnouncementOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const announcement = await fastify.prisma.announcement.findUnique({
      where: { id: request.params.id },
      include: { instructor: { select: { id: true, fullName: true } } },
    });
    if (!announcement) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Оголошення не знайдено' } });
    return serialize(announcement);
  });

  // PATCH /api/v1/announcements/:id
  fastify.patch('/announcements/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити оголошення',
      description: 'Змінити заголовок або текст існуючого оголошення. Лише викладач, що створив оголошення, може його редагувати.',
      tags: ['Announcements'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateAnnouncementBody,
      response: { 200: AnnouncementOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const announcement = await fastify.prisma.announcement.findUnique({ where: { id: request.params.id } });
    if (!announcement) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Оголошення не знайдено' } });
    if (announcement.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не створювали це оголошення' } });
    }

    const updated = await fastify.prisma.announcement.update({
      where: { id: request.params.id },
      data: request.body,
      include: { instructor: { select: { id: true, fullName: true } } },
    });
    return serialize(updated);
  });

  // DELETE /api/v1/announcements/:id
  fastify.delete('/announcements/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити оголошення',
      description: 'Остаточно видалити оголошення. Лише викладач, що створив оголошення, може його видалити.',
      tags: ['Announcements'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const announcement = await fastify.prisma.announcement.findUnique({ where: { id: request.params.id } });
    if (!announcement) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Оголошення не знайдено' } });
    if (announcement.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не створювали це оголошення' } });
    }

    await fastify.prisma.announcement.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
