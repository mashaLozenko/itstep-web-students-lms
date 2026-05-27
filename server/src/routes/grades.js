import { z } from 'zod';
import { GradeBody, UpdateGradeBody, GradeOut } from '../schemas/grade.js';
import { IdParam, ErrorResponse, PaginationQuery, PaginationMeta } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

function serialize(g) {
  return {
    ...g,
    gradedAt: g.gradedAt.toISOString(),
    instructor: g.instructor ? { id: g.instructor.id, fullName: g.instructor.fullName } : undefined,
  };
}

export default async function gradesRoutes(fastify) {
  // POST /api/v1/submissions/:id/grade
  fastify.post('/submissions/:id/grade', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оцінити здану роботу',
      description: 'Виставити числовий бал за здану роботу. Надсилає WebSocket-сповіщення студенту та зберігає запис у Notification. Лише викладачі можуть оцінювати здані роботи.',
      tags: ['Grades'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: GradeBody,
      response: { 201: GradeOut, 409: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const submission = await fastify.prisma.submission.findUnique({
      where: { id: request.params.id },
      include: { assignment: { include: { section: { include: { course: true } } } } },
    });
    if (!submission) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Здану роботу не знайдено' } });

    const existing = await fastify.prisma.grade.findUnique({ where: { submissionId: request.params.id } });
    if (existing) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Ця здана робота вже оцінена. Для зміни використовуйте PATCH.' } });

    const grade = await fastify.prisma.grade.create({
      data: {
        submissionId: request.params.id,
        score: request.body.score,
        instructorId: request.user.sub,
      },
      include: { instructor: { select: { id: true, fullName: true } } },
    });

    // Push notification to the student
    await fastify.pushNotification(submission.userId, 'grade_posted', {
      gradeId: grade.id,
      score: grade.score,
      assignmentTitle: submission.assignment.title,
      courseTitle: submission.assignment.section.course.title,
    });

    return reply.code(201).send(serialize(grade));
  });

  // PATCH /api/v1/submissions/:id/grade
  fastify.patch('/submissions/:id/grade', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити оцінку',
      description: 'Змінити бал за вже оцінену здану роботу. Лише викладачі можуть оновлювати оцінки.',
      tags: ['Grades'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateGradeBody,
      response: { 200: GradeOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const submission = await fastify.prisma.submission.findUnique({ where: { id: request.params.id } });
    if (!submission) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Здану роботу не знайдено' } });

    const grade = await fastify.prisma.grade.findUnique({ where: { submissionId: request.params.id } });
    if (!grade) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Оцінку не знайдено. Для створення використовуйте POST.' } });

    const updated = await fastify.prisma.grade.update({
      where: { submissionId: request.params.id },
      data: { score: request.body.score, gradedAt: new Date() },
      include: { instructor: { select: { id: true, fullName: true } } },
    });

    return serialize(updated);
  });

  // GET /api/v1/users/:id/grades
  fastify.get('/users/:id/grades', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список оцінок користувача',
      description: 'Повертає пагінований список оцінок вказаного користувача. Студенти можуть переглядати лише свої оцінки; викладачі — оцінки будь-якого студента.',
      tags: ['Grades'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      querystring: PaginationQuery,
      response: {
        200: z.object({
          data: z.array(GradeOut),
          meta: PaginationMeta,
        }),
        403: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const targetId = request.params.id === 'me' ? request.user.sub : request.params.id;
    if (request.user.role === 'Student' && request.user.sub !== targetId) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви можете переглядати лише свої оцінки' } });
    }

    const { page, pageSize, skip, take } = parsePagination(request.query);

    const where = { submission: { userId: targetId } };
    const [total, grades] = await Promise.all([
      fastify.prisma.grade.count({ where }),
      fastify.prisma.grade.findMany({
        where, skip, take,
        orderBy: { gradedAt: 'desc' },
        include: {
          instructor: { select: { id: true, fullName: true } },
          submission: { select: { id: true, userId: true, assignmentId: true } },
        },
      }),
    ]);

    return {
      data: grades.map(serialize),
      meta: buildMeta(total, page, pageSize),
    };
  });
}
