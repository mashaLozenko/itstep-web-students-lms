import { z } from 'zod';
import { ErrorResponse } from '../schemas/common.js';

export default async function dashboardRoutes(fastify) {
  // GET /api/v1/dashboard/student
  fastify.get('/student', {
    preHandler: [fastify.requireRole('Student')],
    schema: {
      summary: 'Дашборд студента',
      description: 'Повертає зведену інформацію для автентифікованого студента: записані курси, найближчі дедлайни завдань, останні оцінки, непрочитані сповіщення та останні оголошення.',
      tags: ['Dashboard'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          enrolledCourses: z.number().describe('Загальна кількість підтверджених записів на курси'),
          upcomingDeadlines: z.array(z.object({
            assignmentId: z.string(),
            title: z.string(),
            dueAt: z.string().datetime(),
            courseTitle: z.string(),
          })).describe('Наступні 5 дедлайнів завдань'),
          recentGrades: z.array(z.object({
            gradeId: z.string(),
            score: z.number(),
            maxScore: z.number(),
            assignmentTitle: z.string(),
            gradedAt: z.string().datetime(),
          })).describe('Останні 5 отриманих оцінок'),
          unreadNotifications: z.number().describe('Кількість непрочитаних сповіщень'),
          latestAnnouncements: z.array(z.object({
            id: z.string(),
            title: z.string(),
            courseTitle: z.string(),
            createdAt: z.string().datetime(),
          })).describe('5 найновіших оголошень із записаних курсів'),
          upcomingLessons: z.array(z.object({
            id: z.string(),
            title: z.string(),
            releaseAt: z.string().datetime().nullable(),
            courseTitle: z.string(),
          })).describe('5 уроків із найближчою датою публікації'),
          recentComments: z.array(z.object({
            id: z.string(),
            body: z.string(),
            authorName: z.string(),
            createdAt: z.string().datetime(),
          })).describe('Останні 5 коментарів на оцінках студента'),
        }),
        403: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub;
    const now = new Date();

    // Get enrolled course IDs
    const enrollments = await fastify.prisma.enrollment.findMany({
      where: { userId, status: 'Approved', hiddenByStudent: false },
      include: { course: { select: { id: true, title: true } } },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    const courseTitleById = Object.fromEntries(enrollments.map((e) => [e.courseId, e.course.title]));

    // Upcoming deadlines
    const upcomingAssignments = await fastify.prisma.assignment.findMany({
      where: {
        dueAt: { gte: now },
        section: { courseId: { in: courseIds } },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
      include: { section: { select: { courseId: true } } },
    });

    // Recent grades
    const recentGrades = await fastify.prisma.grade.findMany({
      where: { submission: { userId } },
      orderBy: { gradedAt: 'desc' },
      take: 5,
      include: {
        submission: {
          include: { assignment: { select: { title: true, maxScore: true } } },
        },
      },
    });

    // Unread notifications
    const unreadNotifications = await fastify.prisma.notification.count({
      where: { userId, readAt: null },
    });

    // Latest announcements from enrolled courses
    const latestAnnouncements = await fastify.prisma.announcement.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Upcoming lessons (release scheduled in the future) from enrolled courses
    const upcomingLessonsRaw = await fastify.prisma.lesson.findMany({
      where: {
        releaseAt: { gte: now },
        section: { courseId: { in: courseIds } },
      },
      orderBy: { releaseAt: 'asc' },
      take: 5,
      include: { section: { select: { courseId: true } } },
    });

    // Recent comments on this student's grades
    const studentGradeIds = await fastify.prisma.grade.findMany({
      where: { submission: { userId } },
      select: { id: true },
    });
    const recentCommentsRaw = await fastify.prisma.comment.findMany({
      where: {
        parentType: 'Grade',
        parentId: { in: studentGradeIds.map((g) => g.id) },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { author: { select: { fullName: true } } },
    });

    return {
      enrolledCourses: enrollments.length,
      upcomingDeadlines: upcomingAssignments.map((a) => ({
        assignmentId: a.id,
        title: a.title,
        dueAt: a.dueAt.toISOString(),
        courseTitle: courseTitleById[a.section.courseId] || '',
      })),
      recentGrades: recentGrades.map((g) => ({
        gradeId: g.id,
        score: g.score,
        maxScore: g.submission.assignment.maxScore,
        assignmentTitle: g.submission.assignment.title,
        gradedAt: g.gradedAt.toISOString(),
      })),
      unreadNotifications,
      latestAnnouncements: latestAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        courseTitle: courseTitleById[a.courseId] || '',
        createdAt: a.createdAt.toISOString(),
      })),
      upcomingLessons: upcomingLessonsRaw.map((l) => ({
        id: l.id,
        title: l.title,
        releaseAt: l.releaseAt ? l.releaseAt.toISOString() : null,
        courseTitle: courseTitleById[l.section.courseId] || '',
      })),
      recentComments: recentCommentsRaw.map((c) => ({
        id: c.id,
        body: c.body,
        authorName: c.author?.fullName ?? '',
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });

  // GET /api/v1/dashboard/instructor
  fastify.get('/instructor', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Дашборд викладача',
      description: 'Повертає зведену інформацію для автентифікованого викладача: кількість курсів, здані роботи, що очікують на оцінювання, останні коментарі студентів та нові запити на запис.',
      tags: ['Dashboard'],
      security: [{ bearerAuth: [] }],
      response: {
        200: z.object({
          totalCourses: z.number(),
          publishedCourses: z.number(),
          pendingSubmissionsCount: z.number().describe('Кількість зданих робіт без оцінки'),
          pendingEnrollments: z.number().describe('Запити на запис, що очікують підтвердження'),
          pendingSubmissions: z.array(z.object({
            id: z.string(),
            user: z.object({ id: z.string(), fullName: z.string() }),
            assignment: z.object({ id: z.string(), title: z.string() }),
            submittedAt: z.string().datetime(),
          })).describe('Останні 6 неоцінених зданих робіт'),
          newLessonComments: z.array(z.object({
            id: z.string(),
            body: z.string(),
            author: z.object({ id: z.string(), fullName: z.string() }),
            lessonId: z.string(),
            createdAt: z.string().datetime(),
          })).describe('Останні 5 коментарів до уроків викладача (lessonId для лінку)'),
          newGradeComments: z.array(z.object({
            id: z.string(),
            body: z.string(),
            author: z.object({ id: z.string(), fullName: z.string() }),
            submissionId: z.string(),
            createdAt: z.string().datetime(),
          })).describe('Останні 5 коментарів до оцінок з submissionId для лінку на сторінку оцінювання'),
          draftCourses: z.array(z.object({
            id: z.string(),
            title: z.string(),
            createdAt: z.string().datetime(),
          })).describe('Курси викладача зі статусом Чернетка'),
        }),
        403: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const instructorId = request.user.sub;

    const [courses, pendingEnrollments, draftCourses] = await Promise.all([
      fastify.prisma.course.findMany({
        where: { instructorId },
        select: { id: true, status: true },
      }),
      fastify.prisma.enrollment.count({
        where: { course: { instructorId }, status: 'Pending' },
      }),
      fastify.prisma.course.findMany({
        where: { instructorId, status: 'Draft' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, createdAt: true },
        take: 10,
      }),
    ]);

    const courseIds = courses.map((c) => c.id);
    const publishedCourses = courses.filter((c) => c.status === 'Published').length;

    // Lesson + Grade IDs for instructor's courses (polymorphic comment filter)
    const [courseLessons, courseGrades] = await Promise.all([
      courseIds.length > 0 ? fastify.prisma.lesson.findMany({
        where: { section: { courseId: { in: courseIds } } },
        select: { id: true },
      }) : Promise.resolve([]),
      courseIds.length > 0 ? fastify.prisma.grade.findMany({
        where: { submission: { assignment: { section: { courseId: { in: courseIds } } } } },
        select: { id: true },
      }) : Promise.resolve([]),
    ]);
    const lessonIds = courseLessons.map((l) => l.id);
    const gradeIds = courseGrades.map((g) => g.id);

    const [pendingSubmissionsCount, pendingSubmissions, newLessonComments, newGradeComments] = await Promise.all([
      fastify.prisma.submission.count({
        where: {
          assignment: { section: { courseId: { in: courseIds } } },
          grade: { is: null },
        },
      }),
      fastify.prisma.submission.findMany({
        where: {
          assignment: { section: { courseId: { in: courseIds } } },
          grade: { is: null },
        },
        orderBy: { submittedAt: 'desc' },
        take: 6,
        include: {
          user: { select: { id: true, fullName: true } },
          assignment: { select: { id: true, title: true } },
        },
      }),
      lessonIds.length > 0 ? fastify.prisma.comment.findMany({
        where: {
          deletedAt: null,
          parentType: 'Lesson',
          parentId: { in: lessonIds },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { author: { select: { id: true, fullName: true } } },
      }) : Promise.resolve([]),
      gradeIds.length > 0 ? fastify.prisma.comment.findMany({
        where: {
          deletedAt: null,
          parentType: 'Grade',
          parentId: { in: gradeIds },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { author: { select: { id: true, fullName: true } } },
      }) : Promise.resolve([]),
    ]);

    // For Grade comments, we need submissionId to link the comment to the grading page.
    const gradeToSubmissionId = gradeIds.length > 0
      ? Object.fromEntries(
          (await fastify.prisma.grade.findMany({
            where: { id: { in: newGradeComments.map((c) => c.parentId) } },
            select: { id: true, submissionId: true },
          })).map((g) => [g.id, g.submissionId]),
        )
      : {};

    return {
      totalCourses: courses.length,
      publishedCourses,
      pendingSubmissionsCount,
      pendingEnrollments,
      pendingSubmissions: pendingSubmissions.map((s) => ({
        id: s.id,
        user: s.user,
        assignment: s.assignment,
        submittedAt: s.submittedAt.toISOString(),
      })),
      newLessonComments: newLessonComments.map((c) => ({
        id: c.id,
        body: c.body.length > 200 ? c.body.substring(0, 200) : c.body,
        author: { id: c.author.id, fullName: c.author.fullName },
        lessonId: c.parentId,
        createdAt: c.createdAt.toISOString(),
      })),
      newGradeComments: newGradeComments.map((c) => ({
        id: c.id,
        body: c.body.length > 200 ? c.body.substring(0, 200) : c.body,
        author: { id: c.author.id, fullName: c.author.fullName },
        submissionId: gradeToSubmissionId[c.parentId] ?? '',
        createdAt: c.createdAt.toISOString(),
      })),
      draftCourses: draftCourses.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });
}
