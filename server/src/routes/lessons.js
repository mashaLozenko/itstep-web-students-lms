import { z } from 'zod';
import { LessonBody, UpdateLessonBody, ReorderLessonsBody, LessonOut } from '../schemas/lesson.js';
import { IdParam, ErrorResponse, PaginationQuery, PaginationMeta } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

export default async function lessonsRoutes(fastify) {
  // GET /api/v1/courses/:id/lessons
  fastify.get('/courses/:id/lessons', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список уроків курсу',
      description: 'Повертає пагінований список усіх уроків у межах курсу, упорядкованих за порядком розділу та порядком уроку. Кожен урок містить прапорець `completed` для автентифікованого студента.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      querystring: PaginationQuery,
      response: {
        200: z.object({ data: z.array(LessonOut), meta: PaginationMeta }),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });

    const { page, pageSize, skip, take } = parsePagination(request.query);
    const where = { section: { courseId: request.params.id } };

    const [total, lessons] = await Promise.all([
      fastify.prisma.lesson.count({ where }),
      fastify.prisma.lesson.findMany({
        where,
        skip,
        take,
        orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
      }),
    ]);

    let progressSet = new Set();
    if (request.user.role === 'Student' && lessons.length > 0) {
      const progress = await fastify.prisma.lessonProgress.findMany({
        where: { userId: request.user.sub, lessonId: { in: lessons.map((l) => l.id) } },
      });
      progressSet = new Set(progress.map((p) => p.lessonId));
    }

    return {
      data: lessons.map((l) => ({
        ...l,
        releaseAt: l.releaseAt ? l.releaseAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
        completed: progressSet.has(l.id),
      })),
      meta: buildMeta(total, page, pageSize),
    };
  });

  // GET /api/v1/sections/:id/lessons
  fastify.get('/sections/:id/lessons', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список уроків розділу',
      description: 'Повертає всі уроки розділу в порядку відображення. Кожен урок містить прапорець `completed`, що вказує, чи позначив автентифікований студент його виконаним.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: z.array(LessonOut), 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const section = await fastify.prisma.section.findUnique({ where: { id: request.params.id } });
    if (!section) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Розділ не знайдено' } });

    const lessons = await fastify.prisma.lesson.findMany({
      where: { sectionId: request.params.id },
      orderBy: { order: 'asc' },
    });

    let progressSet = new Set();
    if (request.user.role === 'Student') {
      const progress = await fastify.prisma.lessonProgress.findMany({
        where: { userId: request.user.sub, lessonId: { in: lessons.map((l) => l.id) } },
      });
      progressSet = new Set(progress.map((p) => p.lessonId));
    }

    return lessons.map((l) => ({
      ...l,
      releaseAt: l.releaseAt ? l.releaseAt.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      completed: progressSet.has(l.id),
    }));
  });

  // GET /api/v1/lessons/:id
  fastify.get('/lessons/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати урок за ID',
      description: 'Повертає повні дані уроку, включаючи вміст у форматі Markdown та статус виконання для поточного студента.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: LessonOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const lesson = await fastify.prisma.lesson.findUnique({ where: { id: request.params.id } });
    if (!lesson) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Урок не знайдено' } });

    let completed = false;
    if (request.user.role === 'Student') {
      const progress = await fastify.prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: request.user.sub, lessonId: lesson.id } },
      });
      completed = !!progress;
    }

    return {
      ...lesson,
      releaseAt: lesson.releaseAt ? lesson.releaseAt.toISOString() : null,
      createdAt: lesson.createdAt.toISOString(),
      completed,
    };
  });

  // POST /api/v1/sections/:id/lessons
  fastify.post('/sections/:id/lessons', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Створити урок',
      description: 'Додати новий урок до розділу з вмістом у форматі Markdown/rich-text. Лише викладач курсу може додавати уроки.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: LessonBody,
      response: { 201: LessonOut, 403: ErrorResponse, 404: ErrorResponse },
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

    let order = request.body.order;
    if (order === undefined) {
      const last = await fastify.prisma.lesson.findFirst({
        where: { sectionId: request.params.id },
        orderBy: { order: 'desc' },
      });
      order = last ? last.order + 1 : 0;
    }

    const lesson = await fastify.prisma.lesson.create({
      data: {
        sectionId: request.params.id,
        title: request.body.title,
        contentMarkdown: request.body.contentMarkdown,
        releaseAt: request.body.releaseAt ? new Date(request.body.releaseAt) : null,
        order,
      },
    });

    return reply.code(201).send({
      ...lesson,
      releaseAt: lesson.releaseAt ? lesson.releaseAt.toISOString() : null,
      createdAt: lesson.createdAt.toISOString(),
      completed: false,
    });
  });

  // PATCH /api/v1/lessons/:id
  fastify.patch('/lessons/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити урок',
      description: 'Оновити вміст, назву, порядок або дату публікації уроку. Лише викладач курсу може редагувати уроки.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateLessonBody,
      response: { 200: LessonOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const lesson = await fastify.prisma.lesson.findUnique({
      where: { id: request.params.id },
      include: { section: { include: { course: true } } },
    });
    if (!lesson) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Урок не знайдено' } });
    if (lesson.section.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const data = { ...request.body };
    if (data.releaseAt !== undefined) {
      data.releaseAt = data.releaseAt ? new Date(data.releaseAt) : null;
    }

    const updated = await fastify.prisma.lesson.update({
      where: { id: request.params.id },
      data,
    });

    return {
      ...updated,
      releaseAt: updated.releaseAt ? updated.releaseAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      completed: false,
    };
  });

  // DELETE /api/v1/lessons/:id
  fastify.delete('/lessons/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити урок',
      description: 'Остаточно видалити урок та всі пов\'язані записи прогресу та коментарі.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const lesson = await fastify.prisma.lesson.findUnique({
      where: { id: request.params.id },
      include: { section: { include: { course: true } } },
    });
    if (!lesson) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Урок не знайдено' } });
    if (lesson.section.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    await fastify.prisma.lesson.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });

  // POST /api/v1/lessons/:id/complete
  fastify.post('/lessons/:id/complete', {
    preHandler: [fastify.requireRole('Student')],
    schema: {
      summary: 'Позначити урок як виконаний',
      description: 'Зафіксувати, що автентифікований студент виконав урок. Ідемпотентно — повторний виклик, коли урок вже виконано, повертає 200 без помилки.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: {
        200: z.object({ message: z.string() }),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const lesson = await fastify.prisma.lesson.findUnique({ where: { id: request.params.id } });
    if (!lesson) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Урок не знайдено' } });

    await fastify.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: request.user.sub, lessonId: request.params.id } },
      create: { userId: request.user.sub, lessonId: request.params.id },
      update: {},
    });

    return { message: 'Урок позначено як виконаний' };
  });

  // PATCH /api/v1/sections/:id/lessons/reorder
  fastify.patch('/sections/:id/lessons/reorder', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Змінити порядок уроків у розділі',
      description: 'Задати новий порядок відображення уроків у розділі, передавши ID уроків у бажаному порядку. Усі ID мають належати розділу з URL.',
      tags: ['Lessons'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: z.object({ orderedIds: z.array(z.string()).describe('ID уроків у бажаному порядку') }),
      response: { 200: z.array(LessonOut), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const sectionId = request.params.id;
    const { orderedIds } = request.body;

    const section = await fastify.prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });
    if (!section) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Розділ не знайдено' } });
    if (section.course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є викладачем цього курсу' } });
    }

    await fastify.prisma.$transaction(
      orderedIds.map((id, index) => fastify.prisma.lesson.update({ where: { id }, data: { order: index } }))
    );

    const lessons = await fastify.prisma.lesson.findMany({
      where: { sectionId },
      orderBy: { order: 'asc' },
    });

    return lessons.map((l) => ({
      ...l,
      releaseAt: l.releaseAt ? l.releaseAt.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      completed: false,
    }));
  });
}
