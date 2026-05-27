import { z } from 'zod';
import { IdParam, ErrorResponse } from '../schemas/common.js';
import { toCsv } from '../utils/csv.js';

export default async function gradebookRoutes(fastify) {
  // GET /api/v1/courses/:id/gradebook
  fastify.get('/courses/:id/gradebook', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Отримати матрицю журналу оцінок',
      description: 'Повертає матрицю балів для курсу: студенти (рядки) × завдання (стовпці). Кожна клітинка містить бал студента або null, якщо ще не оцінено. Лише викладач курсу має доступ до журналу оцінок.',
      tags: ['Gradebook'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: {
        200: z.object({
          students: z.array(z.object({ id: z.string(), fullName: z.string() })),
          assignments: z.array(z.object({ id: z.string(), title: z.string(), maxScore: z.number() })),
          cells: z.record(z.record(z.number().nullable())).describe('cells[studentId][assignmentId] = бал | null'),
        }),
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    // Get all enrolled students
    const enrollments = await fastify.prisma.enrollment.findMany({
      where: { courseId: request.params.id, status: 'Approved' },
      include: { user: { select: { id: true, fullName: true } } },
    });
    const students = enrollments.map((e) => ({ id: e.user.id, fullName: e.user.fullName }));

    // Get all assignments for this course
    const assignments = await fastify.prisma.assignment.findMany({
      where: { section: { courseId: request.params.id } },
      orderBy: [{ section: { order: 'asc' } }, { createdAt: 'asc' }],
      select: { id: true, title: true, maxScore: true },
    });

    // Get all submissions + grades
    const submissions = await fastify.prisma.submission.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        userId: { in: students.map((s) => s.id) },
      },
      include: { grade: { select: { score: true } } },
    });

    // Build cells map
    const cells = {};
    for (const student of students) {
      cells[student.id] = {};
      for (const assignment of assignments) {
        cells[student.id][assignment.id] = null;
      }
    }
    for (const sub of submissions) {
      if (cells[sub.userId] && sub.grade) {
        cells[sub.userId][sub.assignmentId] = sub.grade.score;
      }
    }

    return { students, assignments, cells };
  });

  // GET /api/v1/courses/:id/gradebook.csv
  fastify.get('/courses/:id/gradebook.csv', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Експортувати журнал оцінок як CSV',
      description: 'Завантажує журнал оцінок у форматі CSV. Рядки — студенти, стовпці — завдання (з максимальним балом у заголовку). Порожні клітинки означають відсутність здачі або відсутність оцінки. Лише викладач курсу може виконати експорт.',
      tags: ['Gradebook'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: {
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (course.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const enrollments = await fastify.prisma.enrollment.findMany({
      where: { courseId: request.params.id, status: 'Approved' },
      include: { user: { select: { id: true, fullName: true } } },
    });
    const students = enrollments.map((e) => e.user);

    const assignments = await fastify.prisma.assignment.findMany({
      where: { section: { courseId: request.params.id } },
      orderBy: [{ section: { order: 'asc' } }, { createdAt: 'asc' }],
      select: { id: true, title: true, maxScore: true },
    });

    const submissions = await fastify.prisma.submission.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        userId: { in: students.map((s) => s.id) },
      },
      include: { grade: { select: { score: true } } },
    });

    const scoreMap = {};
    for (const sub of submissions) {
      if (!scoreMap[sub.userId]) scoreMap[sub.userId] = {};
      scoreMap[sub.userId][sub.assignmentId] = sub.grade?.score ?? '';
    }

    // Build CSV rows
    const rows = students.map((student) => {
      const row = { Студент: student.fullName };
      for (const assignment of assignments) {
        const key = `${assignment.title} (макс ${assignment.maxScore})`;
        row[key] = scoreMap[student.id]?.[assignment.id] ?? '';
      }
      return row;
    });

    const csv = toCsv(rows);

    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="gradebook-${request.params.id}.csv"`)
      .send(csv);
  });
}
