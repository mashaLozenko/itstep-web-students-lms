import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma plugin — decorates fastify with `fastify.prisma`.
 * Uses a singleton PrismaClient so all routes share one connection pool.
 */
async function prismaPlugin(fastify) {
  const prisma = new PrismaClient({
    log: fastify.log.level === 'debug' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin, { name: 'prisma' });
