import { z } from 'zod';
import { RegisterBody, LoginBody, AuthResponse, UserPublic } from '../schemas/auth.js';
import { ErrorResponse } from '../schemas/common.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

/**
 * Auth routes — registration, login, and current-user lookup.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function authRoutes(fastify) {
  // POST /api/v1/auth/register
  fastify.post('/register', {
    schema: {
      summary: 'Зареєструвати нового користувача',
      description: 'Створити новий акаунт студента або викладача. Повертає профіль створеного користувача та підписаний JWT токен терміном дії 7 днів.',
      tags: ['Auth'],
      body: RegisterBody,
      response: {
        201: AuthResponse,
        409: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { email, password, fullName, role } = request.body;

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({
        error: { code: 'CONFLICT', message: 'Користувач з такою електронною поштою вже існує' },
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await fastify.prisma.user.create({
      data: { email, passwordHash, fullName, role },
    });

    const token = fastify.jwt.sign({ sub: user.id, role: user.role, email: user.email });

    return reply.code(201).send({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  });

  // POST /api/v1/auth/login
  fastify.post('/login', {
    schema: {
      summary: 'Увійти за електронною поштою та паролем',
      description: 'Автентифікація за електронною поштою та паролем. Повертає профіль користувача та JWT токен. Використовуйте токен у наступних запитах через заголовок Authorization: Bearer.',
      tags: ['Auth'],
      body: LoginBody,
      response: {
        200: AuthResponse,
        401: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Невірна електронна пошта або пароль' },
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Невірна електронна пошта або пароль' },
      });
    }

    const token = fastify.jwt.sign({ sub: user.id, role: user.role, email: user.email });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати профіль поточного користувача',
      description: 'Повертає профіль автентифікованого користувача. Потребує дійсного JWT токена в заголовку Authorization.',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: UserPublic,
        401: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.sub },
    });

    if (!user) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Користувача не знайдено' },
      });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  });
}
