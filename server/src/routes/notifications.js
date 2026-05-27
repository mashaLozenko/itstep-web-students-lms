import { z } from 'zod';
import { NotificationOut, NotificationsQuery, NotificationsListResponse } from '../schemas/notification.js';
import { IdParam, ErrorResponse, MessageResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

function serialize(n) {
  return {
    ...n,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export default async function notificationsRoutes(fastify) {
  // GET /api/v1/notifications
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список сповіщень',
      description: 'Повертає пагінований список сповіщень автентифікованого користувача в зворотному хронологічному порядку. Опціонально фільтрувати лише непрочитані.',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      querystring: NotificationsQuery,
      response: { 200: NotificationsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const where = { userId: request.user.sub };
    if (request.query.unreadOnly === 'true') where.readAt = null;

    const [total, notifications] = await Promise.all([
      fastify.prisma.notification.count({ where }),
      fastify.prisma.notification.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { data: notifications.map(serialize), meta: buildMeta(total, page, pageSize) };
  });

  // PATCH /api/v1/notifications/:id/read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Позначити сповіщення як прочитане',
      description: 'Встановити мітку readAt для одного сповіщення. Ідемпотентно — повторне позначення вже прочитаного сповіщення не має ефекту.',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: NotificationOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const notification = await fastify.prisma.notification.findUnique({ where: { id: request.params.id } });
    if (!notification) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Сповіщення не знайдено' } });
    if (notification.userId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Це не ваше сповіщення' } });
    }

    const updated = await fastify.prisma.notification.update({
      where: { id: request.params.id },
      data: { readAt: notification.readAt ?? new Date() },
    });

    return serialize(updated);
  });

  // PATCH /api/v1/notifications/read-all
  fastify.patch('/read-all', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Позначити всі сповіщення як прочитані',
      description: 'Встановити readAt для всіх непрочитаних сповіщень автентифікованого користувача одним запитом.',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ updated: z.number() }) },
    },
  }, async (request, reply) => {
    const result = await fastify.prisma.notification.updateMany({
      where: { userId: request.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  });
}
