import { z } from 'zod';
import { CourseBody, UpdateCourseBody, CourseOut, CoursesQuery, CoursesListResponse } from '../schemas/course.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';

function serializeCourse(c) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    instructor: c.instructor
      ? {
          id: c.instructor.id,
          fullName: c.instructor.fullName,
          email: c.instructor.email,
          avatarUrl: c.instructor.avatarUrl ?? null,
        }
      : undefined,
    sections: c.sections
      ? c.sections.map((s) => ({
          id: s.id,
          courseId: s.courseId,
          title: s.title,
          order: s.order,
          createdAt: s.createdAt.toISOString(),
          lessons: (s.lessons ?? []).map((l) => ({
            id: l.id,
            sectionId: l.sectionId,
            title: l.title,
            order: l.order,
            releaseAt: l.releaseAt ? l.releaseAt.toISOString() : null,
            createdAt: l.createdAt.toISOString(),
          })),
          assignments: (s.assignments ?? []).map((a) => ({
            id: a.id,
            sectionId: a.sectionId,
            title: a.title,
            dueAt: a.dueAt.toISOString(),
            releaseAt: a.releaseAt ? a.releaseAt.toISOString() : null,
            maxScore: a.maxScore,
            createdAt: a.createdAt.toISOString(),
          })),
        }))
      : undefined,
  };
}

export default async function coursesRoutes(fastify) {
  // GET /api/v1/courses
  fastify.get('/', {
    schema: {
      summary: 'Список курсів',
      description: 'Повертає пагінований список курсів. Підтримує повнотекстовий пошук по назві/опису, фільтрацію за статусом та сортування. Неавтентифіковані користувачі бачать лише опубліковані курси.',
      tags: ['Courses'],
      querystring: CoursesQuery,
      response: { 200: CoursesListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const { q, status, sort = 'createdAt', order = 'desc' } = request.query;

    // Determine which user is making the request (if any)
    let currentUserId = null;
    let currentUserRole = null;
    try {
      await request.jwtVerify();
      currentUserId = request.user.sub;
      currentUserRole = request.user.role;
    } catch (_) { /* unauthenticated */ }

    const where = {};
    // Unauthenticated users and students only see Published courses
    if (!currentUserId || currentUserRole === 'Student') {
      where.status = 'Published';
    } else if (currentUserRole === 'Instructor') {
      // Instructors see their own courses in any status + all published
      if (status) {
        where.status = status;
      }
    } else if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const [total, courses] = await Promise.all([
      fastify.prisma.course.count({ where }),
      fastify.prisma.course.findMany({
        where,
        skip,
        take,
        orderBy: { [sort]: order },
        include: {
          instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          _count: { select: { enrollments: true, sections: true } },
        },
      }),
    ]);

    // For authenticated students, attach myEnrollment per course
    let myEnrollmentByCourse = {};
    if (currentUserId && currentUserRole === 'Student' && courses.length > 0) {
      const enrollments = await fastify.prisma.enrollment.findMany({
        where: { userId: currentUserId, courseId: { in: courses.map((c) => c.id) } },
        select: { courseId: true, status: true, hiddenByStudent: true },
      });
      myEnrollmentByCourse = Object.fromEntries(enrollments.map((e) => [e.courseId, e]));
    }

    return {
      data: courses.map((c) => ({
        ...serializeCourse(c),
        myEnrollment: myEnrollmentByCourse[c.id]
          ? { status: myEnrollmentByCourse[c.id].status, hiddenByStudent: myEnrollmentByCourse[c.id].hiddenByStudent }
          : null,
      })),
      meta: buildMeta(total, page, pageSize),
    };
  });

  // POST /api/v1/courses
  fastify.post('/', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Створити курс',
      description: 'Створити новий курс. Лише викладачі можуть створювати курси. Нові курси за замовчуванням мають статус Чернетка.',
      tags: ['Courses'],
      security: [{ bearerAuth: [] }],
      body: CourseBody,
      response: { 201: CourseOut, 403: ErrorResponse },
    },
  }, async (request, reply) => {
    const course = await fastify.prisma.course.create({
      data: {
        ...request.body,
        instructorId: request.user.sub,
      },
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        _count: { select: { enrollments: true, sections: true } },
      },
    });
    return reply.code(201).send(serializeCourse(course));
  });

  // GET /api/v1/courses/:id
  fastify.get('/:id', {
    schema: {
      summary: 'Отримати курс за ID',
      description: 'Повертає повні дані одного курсу, включаючи ім\'я викладача та кількість записів і розділів. Для автентифікованого студента додається поле `myEnrollment` зі статусом його запису.',
      tags: ['Courses'],
      params: IdParam,
      response: { 200: CourseOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    let currentUserId = null;
    let currentUserRole = null;
    try {
      await request.jwtVerify();
      currentUserId = request.user.sub;
      currentUserRole = request.user.role;
    } catch (_) { /* unauthenticated */ }

    const course = await fastify.prisma.course.findUnique({
      where: { id: request.params.id },
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        _count: { select: { enrollments: true, sections: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
            assignments: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!course) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });

    let myEnrollment = null;
    if (currentUserId && currentUserRole === 'Student') {
      const e = await fastify.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: currentUserId, courseId: course.id } },
        select: { status: true, hiddenByStudent: true },
      });
      if (e) myEnrollment = { status: e.status, hiddenByStudent: e.hiddenByStudent };
    }

    return { ...serializeCourse(course), myEnrollment };
  });

  // PATCH /api/v1/courses/:id
  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити курс',
      description: 'Оновити деталі курсу або змінити його статус (Чернетка → Опубліковано → Архів). Лише власник-викладач може оновлювати свій курс.',
      tags: ['Courses'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateCourseBody,
      response: { 200: CourseOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const existing = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (existing.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    const course = await fastify.prisma.course.update({
      where: { id: request.params.id },
      data: request.body,
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        _count: { select: { enrollments: true, sections: true } },
      },
    });
    return serializeCourse(course);
  });

  // DELETE /api/v1/courses/:id
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити курс',
      description: 'Остаточно видалити курс та всі його розділи, уроки та завдання. Лише власник-викладач може видаляти свій курс.',
      tags: ['Courses'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const existing = await fastify.prisma.course.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Курс не знайдено' } });
    if (existing.instructorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не є власником цього курсу' } });
    }

    await fastify.prisma.course.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
