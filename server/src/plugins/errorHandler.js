import fp from 'fastify-plugin';

/**
 * Global error handler plugin.
 * Normalises all errors into the standard error envelope:
 * { error: { code, message, details? } }
 *
 * Handles:
 *   - Zod/Fastify validation errors → 400 VALIDATION_ERROR
 *   - Prisma unique constraint violations → 409 CONFLICT
 *   - Prisma record-not-found → 404 NOT_FOUND
 *   - JWT errors → 401 UNAUTHORIZED
 *   - Everything else → 500 INTERNAL
 */
async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler((err, request, reply) => {
    fastify.log.error({ err, url: request.url }, 'Request error');

    // Fastify/Zod validation errors
    if (err.validation || err.statusCode === 400) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'Помилка валідації',
          details: err.validation || [],
        },
      });
    }

    // JWT errors
    if (err.statusCode === 401 || err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
        err.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
        err.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'Не авторизовано',
        },
      });
    }

    // Forbidden
    if (err.statusCode === 403) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: err.message || 'Доступ заборонено',
        },
      });
    }

    // Not found
    if (err.statusCode === 404) {
      return reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: err.message || 'Ресурс не знайдено',
        },
      });
    }

    // Prisma: unique constraint
    if (err.code === 'P2002') {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Ресурс з такими значеннями вже існує',
          details: err.meta?.target,
        },
      });
    }

    // Prisma: record not found
    if (err.code === 'P2025') {
      return reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: err.meta?.cause || 'Ресурс не знайдено',
        },
      });
    }

    // Conflict
    if (err.statusCode === 409) {
      return reply.code(409).send({
        error: {
          code: 'CONFLICT',
          message: err.message || 'Конфлікт',
        },
      });
    }

    // Internal
    return reply.code(500).send({
      error: {
        code: 'INTERNAL',
        message: fastify.config?.nodeEnv === 'production' ? 'Внутрішня помилка сервера' : err.message,
      },
    });
  });

  // 404 for unrecognised routes
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Маршрут ${request.method} ${request.url} не знайдено`,
      },
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'errorHandler' });
