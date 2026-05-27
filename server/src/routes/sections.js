import { z } from 'zod';
import { SectionBody, UpdateSectionBody, ReorderBody, SectionOut } from '../schemas/section.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';

export default async function sectionsRoutes(fastify) {
  // GET /api/v1/courses/:id/sections
  fastify.get('/courses/:id/sections', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список розділів курсу',
      description: 'Повертає всі розділи курсу в порядку відображення, включаючи кількість уроків та завдань. Студенти повинні бути записані (або бути викладачем курсу) для перегляду розділів.',
      tags: ['Sections'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: {
        200: z.array(SectionOut),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });

    const sections = await fastify.prisma.section.findMany({
      where: { courseId: request.params.id },
      orderBy: { order: 'asc' },
      include: { _count: { select: { lessons: true, assignments: true } } },
    });

    return sections.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
  });

  // POST /api/v1/courses/:id/sections
  fastify.post('/courses/:id/sections', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Створити розділ',
      description: 'Додати новий розділ до курсу. Порядок за замовчуванням — в кінець. Лише викладач курсу може додавати розділи.',
      tags: ['Sections'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: SectionBody,
      response: { 201: SectionOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    // Auto-assign order if not provided
    let order = request.body.order;
    if (order === undefined) {
      const lastSection = await fastify.prisma.section.findFirst({
        where: { courseId: request.params.id },
        orderBy: { order: 'desc' },
      });
      order = lastSection ? lastSection.order + 1 : 0;
    }

    const section = await fastify.prisma.section.create({
      data: { courseId: request.params.id, title: request.body.title, order },
      include: { _count: { select: { lessons: true, assignments: true } } },
    });

    return reply.code(201).send({ ...section, createdAt: section.createdAt.toISOString() });
  });

  // PATCH /api/v1/sections/:id
  fastify.patch('/sections/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити розділ',
      description: 'Оновити назву або порядок розділу. Лише викладач курсу може редагувати розділи.',
      tags: ['Sections'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateSectionBody,
      response: { 200: SectionOut, 403: ErrorResponse, 404: ErrorResponse },
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

    const updated = await fastify.prisma.section.update({
      where: { id: request.params.id },
      data: request.body,
      include: { _count: { select: { lessons: true, assignments: true } } },
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() };
  });

  // DELETE /api/v1/sections/:id
  fastify.delete('/sections/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити розділ',
      description: 'Остаточно видалити розділ та всі його уроки та завдання. Лише викладач курсу може видаляти розділи.',
      tags: ['Sections'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
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

    await fastify.prisma.section.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });

  // PATCH /api/v1/courses/:id/sections/reorder
  fastify.patch('/courses/:id/sections/reorder', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Змінити порядок розділів',
      description: 'Задати новий порядок відображення розділів у курсі, передавши масив ID розділів у бажаному порядку. Усі ID мають належати курсу з URL.',
      tags: ['Sections'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: z.object({ orderedIds: z.array(z.string()).describe('ID розділів у бажаному порядку') }),
      response: { 200: z.array(SectionOut), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const courseId = request.params.id;
    const { orderedIds } = request.body;

    const course = await fastify.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    await fastify.prisma.$transaction(
      orderedIds.map((id, index) => fastify.prisma.section.update({ where: { id }, data: { order: index } }))
    );

    const sections = await fastify.prisma.section.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: { _count: { select: { lessons: true, assignments: true } } },
    });

    return sections.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
  });
}
