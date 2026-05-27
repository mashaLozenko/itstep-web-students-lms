import { z } from 'zod';
import { UserPublic, UpdateUserBody, UsersQuery, UsersListResponse } from '../schemas/user.js';
import { IdParam, ErrorResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const MIME_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };

/**
 * Users routes — browse users and update profiles.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function usersRoutes(fastify) {
  // GET /api/v1/users
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список користувачів',
      description: 'Повертає пагінований список користувачів. Підтримує фільтрацію за роллю та пошук за ім\'ям або електронною поштою. Потребує автентифікації.',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      querystring: UsersQuery,
      response: {
        200: UsersListResponse,
      },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const { role, q } = request.query;

    const where = {};
    if (role) where.role = role;
    if (q) {
      where.OR = [
        { fullName: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const [total, users] = await Promise.all([
      fastify.prisma.user.count({ where }),
      fastify.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, createdAt: true },
      }),
    ]);

    return {
      data: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
      meta: buildMeta(total, page, pageSize),
    };
  });

  // GET /api/v1/users/:id
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати користувача за ID',
      description: 'Повертає публічну інформацію профілю вказаного користувача. Потребує автентифікації.',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: {
        200: UserPublic,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Користувача не знайдено' } });
    }

    return { ...user, createdAt: user.createdAt.toISOString() };
  });

  // PATCH /api/v1/users/:id
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Оновити профіль користувача',
      description: 'Оновити профіль вказаного користувача. Користувачі можуть оновлювати лише власний профіль; викладачі не можуть підвищувати ролі через цей ендпоінт.',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateUserBody,
      response: {
        200: UserPublic,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Only the user themselves can update their profile
    if (request.user.sub !== id) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви можете оновлювати лише власний профіль' } });
    }

    const user = await fastify.prisma.user.update({
      where: { id },
      data: request.body,
      select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, createdAt: true },
    });

    return { ...user, createdAt: user.createdAt.toISOString() };
  });

  // POST /api/v1/users/:id/avatar — multipart upload (single file field "file")
  fastify.post('/:id/avatar', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Завантажити аватар',
      description: 'Завантажити нове фото профілю користувача через multipart/form-data. Поле файлу — `file`. Підтримуються PNG, JPEG, WEBP, GIF (до 2 МБ). Користувач може оновлювати лише власний аватар. Повертає оновлений профіль з новим `avatarUrl`.',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      params: IdParam,
      response: {
        200: UserPublic,
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    if (request.user.sub !== id) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви можете оновлювати лише власний аватар' } });
    }

    const file = await request.file({ limits: { fileSize: 2 * 1024 * 1024 } });
    if (!file) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Файл не надіслано (очікується поле "file")' } });
    }
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Дозволені формати: PNG, JPEG, WEBP, GIF' } });
    }

    const ext = MIME_EXT[file.mimetype] || path.extname(file.filename || '') || '.bin';
    const filename = `avatar-${randomUUID()}${ext}`;
    const filePath = path.join(config.uploadDir, filename);
    await pipeline(file.file, fs.createWriteStream(filePath));
    if (file.file.truncated) {
      try { await fs.promises.unlink(filePath); } catch {}
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Файл завеликий (максимум 2 МБ)' } });
    }

    const avatarUrl = `/uploads/${filename}`;
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, createdAt: true },
    });
    return { ...user, createdAt: user.createdAt.toISOString() };
  });
}
