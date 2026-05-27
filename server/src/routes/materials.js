import { z } from 'zod';
import { MaterialBody, UpdateMaterialBody, MaterialOut, MaterialsQuery, MaterialsListResponse } from '../schemas/material.js';
import { IdParam, ErrorResponse, MessageResponse } from '../schemas/common.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

function serialize(m, favoritedIds = new Set()) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
    creator: m.creator ? { id: m.creator.id, fullName: m.creator.fullName } : undefined,
    isFavorited: favoritedIds.has(m.id),
  };
}

export default async function materialsRoutes(fastify) {
  // GET /api/v1/materials
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Список навчальних матеріалів',
      description: 'Повертає пагінований список навчальних матеріалів. Підтримує пошук за назвою/описом, фільтрацію за типом (Video, Link, File) та показ лише вибраних матеріалів.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      querystring: MaterialsQuery,
      response: { 200: MaterialsListResponse },
    },
  }, async (request, reply) => {
    const { page, pageSize, skip, take } = parsePagination(request.query);
    const { q, kind, favoritesOnly } = request.query;

    const where = {};
    if (kind) where.kind = kind;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }
    if (favoritesOnly === 'true') {
      where.favorites = { some: { userId: request.user.sub } };
    }

    const [total, materials] = await Promise.all([
      fastify.prisma.learningMaterial.count({ where }),
      fastify.prisma.learningMaterial.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { id: true, fullName: true } } },
      }),
    ]);

    // Get favorited IDs for current user
    const materialIds = materials.map((m) => m.id);
    const favorites = await fastify.prisma.materialFavorite.findMany({
      where: { userId: request.user.sub, materialId: { in: materialIds } },
      select: { materialId: true },
    });
    const favoritedIds = new Set(favorites.map((f) => f.materialId));

    return { data: materials.map((m) => serialize(m, favoritedIds)), meta: buildMeta(total, page, pageSize) };
  });

  // GET /api/v1/materials/:id
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Отримати навчальний матеріал за ID',
      description: 'Повертає повні дані навчального матеріалу, включаючи інформацію про те, чи додав його автентифікований користувач до вибраного.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: MaterialOut, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const material = await fastify.prisma.learningMaterial.findUnique({
      where: { id: request.params.id },
      include: { creator: { select: { id: true, fullName: true } } },
    });
    if (!material) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Навчальний матеріал не знайдено' } });

    const fav = await fastify.prisma.materialFavorite.findUnique({
      where: { userId_materialId: { userId: request.user.sub, materialId: request.params.id } },
    });

    return serialize(material, fav ? new Set([material.id]) : new Set());
  });

  // POST /api/v1/materials — supports multipart for File kind
  fastify.post('/', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Створити навчальний матеріал',
      description: 'Створити новий навчальний матеріал. Для типу File надсилайте як multipart/form-data з полем `file`. Для Video/Link надсилайте JSON з полем `url`.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data', 'application/json'],
      response: { 201: MaterialOut },
    },
  }, async (request, reply) => {
    let data = {};
    let fileUrl = null;

    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const ext = path.extname(part.filename || '');
          const filename = `${randomUUID()}${ext}`;
          const filePath = path.join(config.uploadDir, filename);
          await pipeline(part.file, fs.createWriteStream(filePath));
          fileUrl = `/uploads/${filename}`;
        } else {
          data[part.fieldname] = part.value;
        }
      }
    } else {
      data = request.body || {};
    }

    const material = await fastify.prisma.learningMaterial.create({
      data: {
        title: data.title,
        kind: data.kind,
        url: data.url || null,
        fileUrl,
        description: data.description || '',
        creatorId: request.user.sub,
      },
      include: { creator: { select: { id: true, fullName: true } } },
    });

    return reply.code(201).send(serialize(material));
  });

  // PATCH /api/v1/materials/:id
  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Оновити навчальний матеріал',
      description: 'Змінити назву, опис, URL або тип навчального матеріалу. Лише автор може оновлювати матеріал.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      body: UpdateMaterialBody,
      response: { 200: MaterialOut, 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const material = await fastify.prisma.learningMaterial.findUnique({ where: { id: request.params.id } });
    if (!material) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Навчальний матеріал не знайдено' } });
    if (material.creatorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не створювали цей матеріал' } });
    }

    const updated = await fastify.prisma.learningMaterial.update({
      where: { id: request.params.id },
      data: request.body,
      include: { creator: { select: { id: true, fullName: true } } },
    });

    const fav = await fastify.prisma.materialFavorite.findUnique({
      where: { userId_materialId: { userId: request.user.sub, materialId: request.params.id } },
    });

    return serialize(updated, fav ? new Set([updated.id]) : new Set());
  });

  // DELETE /api/v1/materials/:id
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('Instructor')],
    schema: {
      summary: 'Видалити навчальний матеріал',
      description: 'Остаточно видалити навчальний матеріал та всі пов\'язані вибрані записи. Лише автор може видаляти матеріал.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 204: z.null(), 403: ErrorResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const material = await fastify.prisma.learningMaterial.findUnique({ where: { id: request.params.id } });
    if (!material) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Навчальний матеріал не знайдено' } });
    if (material.creatorId !== request.user.sub) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ви не створювали цей матеріал' } });
    }

    await fastify.prisma.learningMaterial.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });

  // POST /api/v1/materials/:id/favorite
  fastify.post('/:id/favorite', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Додати навчальний матеріал до вибраного',
      description: 'Додати навчальний матеріал до вибраного автентифікованого користувача. Ідемпотентно.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: MessageResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    const material = await fastify.prisma.learningMaterial.findUnique({ where: { id: request.params.id } });
    if (!material) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Навчальний матеріал не знайдено' } });

    await fastify.prisma.materialFavorite.upsert({
      where: { userId_materialId: { userId: request.user.sub, materialId: request.params.id } },
      create: { userId: request.user.sub, materialId: request.params.id },
      update: {},
    });

    return { message: 'Матеріал додано до вибраного' };
  });

  // DELETE /api/v1/materials/:id/favorite
  fastify.delete('/:id/favorite', {
    preHandler: [fastify.authenticate],
    schema: {
      summary: 'Прибрати навчальний матеріал з вибраного',
      description: 'Видалити навчальний матеріал з вибраного автентифікованого користувача.',
      tags: ['Materials'],
      security: [{ bearerAuth: [] }],
      params: IdParam,
      response: { 200: MessageResponse, 404: ErrorResponse },
    },
  }, async (request, reply) => {
    await fastify.prisma.materialFavorite.deleteMany({
      where: { userId: request.user.sub, materialId: request.params.id },
    });
    return { message: 'Матеріал прибрано з вибраного' };
  });
}
