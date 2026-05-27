import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

// Plugins
import corsPlugin from './plugins/cors.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import multipartPlugin from './plugins/multipart.js';
import staticPlugin from './plugins/static.js';
import websocketPlugin from './plugins/websocket.js';
import errorHandlerPlugin from './plugins/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import coursesRoutes from './routes/courses.js';
import enrollmentsRoutes from './routes/enrollments.js';
import sectionsRoutes from './routes/sections.js';
import lessonsRoutes from './routes/lessons.js';
import assignmentsRoutes from './routes/assignments.js';
import submissionsRoutes from './routes/submissions.js';
import gradesRoutes from './routes/grades.js';
import commentsRoutes from './routes/comments.js';
import announcementsRoutes from './routes/announcements.js';
import materialsRoutes from './routes/materials.js';
import notificationsRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import calendarRoutes from './routes/calendar.js';
import gradebookRoutes from './routes/gradebook.js';
import wsNotificationsRoute from './routes/wsNotifications.js';

/**
 * Build and configure the Fastify application.
 * Exported for potential testing; server.js calls buildApp() and then listens.
 * @param {object} opts - Fastify options (e.g. logger config)
 */
export async function buildApp(opts = {}) {
  const fastify = Fastify(opts);

  // Use Zod for validation and serialisation
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Infrastructure plugins (order matters — prisma before routes, swagger before routes)
  await fastify.register(errorHandlerPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(multipartPlugin);
  await fastify.register(staticPlugin);
  await fastify.register(websocketPlugin);

  // WebSocket route (must be registered after websocket plugin)
  await fastify.register(wsNotificationsRoute);

  // REST API routes — all prefixed with /api/v1
  const API_PREFIX = '/api/v1';

  await fastify.register(authRoutes, { prefix: `${API_PREFIX}/auth` });
  await fastify.register(usersRoutes, { prefix: `${API_PREFIX}/users` });
  await fastify.register(coursesRoutes, { prefix: `${API_PREFIX}/courses` });
  await fastify.register(enrollmentsRoutes, { prefix: `${API_PREFIX}` });
  await fastify.register(sectionsRoutes, { prefix: `${API_PREFIX}` });
  await fastify.register(lessonsRoutes, { prefix: `${API_PREFIX}` });
  await fastify.register(assignmentsRoutes, { prefix: `${API_PREFIX}` });
  await fastify.register(submissionsRoutes, { prefix: `${API_PREFIX}/submissions` });
  await fastify.register(gradesRoutes, { prefix: `${API_PREFIX}` });
  await fastify.register(commentsRoutes, { prefix: `${API_PREFIX}/comments` });
  await fastify.register(announcementsRoutes, { prefix: `${API_PREFIX}` });
  await fastify.register(materialsRoutes, { prefix: `${API_PREFIX}/materials` });
  await fastify.register(notificationsRoutes, { prefix: `${API_PREFIX}/notifications` });
  await fastify.register(dashboardRoutes, { prefix: `${API_PREFIX}/dashboard` });
  await fastify.register(calendarRoutes, { prefix: `${API_PREFIX}/calendar` });
  await fastify.register(gradebookRoutes, { prefix: `${API_PREFIX}` });

  return fastify;
}
