import { z } from 'zod';
import { ErrorResponse } from '../schemas/common.js';

const CalendarEvent = z.object({
  id: z.string(),
  type: z.enum(['assignment', 'lesson']),
  title: z.string(),
  when: z.string().datetime(),
  courseId: z.string(),
  courseTitle: z.string(),
});

export default async function calendarRoutes(fastify) {
  // GET /api/v1/calendar
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати події календаря',
      description: 'Повертає найближчі дедлайни завдань та заплановані дати публікації уроків для автентифікованого користувача у вказаному діапазоні дат. Студенти бачать події зі своїх записаних курсів; викладачі — зі своїх курсів.',
      tags: ['Calendar'],
      security: [{ bearerAuth: [] }],
      querystring: z.object({
        from: z.string().datetime().optional().describe('Початок діапазону дат (ISO 8601). За замовчуванням — зараз.'),
        to: z.string().datetime().optional().describe('Кінець діапазону дат (ISO 8601). За замовчуванням — 30 днів від зараз.'),
      }),
      response: {
        200: z.object({ data: z.array(CalendarEvent) }),
      },
    },
  }, async (request, reply) => {
    const now = new Date();
    const from = request.query.from ? new Date(request.query.from) : now;
    const to = request.query.to
      ? new Date(request.query.to)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const userId = request.user.sub;
    const role = request.user.role;

    let courseIds = [];

    if (role === 'Student') {
      const enrollments = await fastify.prisma.enrollment.findMany({
        where: { userId, status: 'Approved' },
        select: { courseId: true },
      });
      courseIds = enrollments.map((e) => e.courseId);
    } else {
      const courses = await fastify.prisma.course.findMany({
        where: { instructorId: userId },
        select: { id: true },
      });
      courseIds = courses.map((c) => c.id);
    }

    if (courseIds.length === 0) return { data: [] };

    // Get course titles
    const courses = await fastify.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    });
    const courseTitleById = Object.fromEntries(courses.map((c) => [c.id, c.title]));

    // Fetch assignments with deadlines in range
    const assignments = await fastify.prisma.assignment.findMany({
      where: {
        dueAt: { gte: from, lte: to },
        section: { courseId: { in: courseIds } },
      },
      include: { section: { select: { courseId: true } } },
      orderBy: { dueAt: 'asc' },
    });

    // Fetch lessons with releaseAt in range
    const lessons = await fastify.prisma.lesson.findMany({
      where: {
        releaseAt: { gte: from, lte: to },
        section: { courseId: { in: courseIds } },
      },
      include: { section: { select: { courseId: true } } },
      orderBy: { releaseAt: 'asc' },
    });

    const events = [
      ...assignments.map((a) => ({
        id: a.id,
        type: 'assignment',
        title: a.title,
        when: a.dueAt.toISOString(),
        courseId: a.section.courseId,
        courseTitle: courseTitleById[a.section.courseId] || '',
      })),
      ...lessons.map((l) => ({
        id: l.id,
        type: 'lesson',
        title: l.title,
        when: l.releaseAt.toISOString(),
        courseId: l.section.courseId,
        courseTitle: courseTitleById[l.section.courseId] || '',
      })),
    ].sort((a, b) => new Date(a.when) - new Date(b.when));

    return { data: events };
  });
}
