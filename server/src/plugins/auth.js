import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';

/**
 * Auth plugin — registers @fastify/jwt and adds two decorators:
 *   - fastify.authenticate: preHandler that verifies JWT Bearer token
 *   - fastify.requireRole(role): returns a preHandler that also checks the user's role
 */
async function authPlugin(fastify) {
  await fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: '7d',
      algorithm: 'HS256',
    },
  });

  // Verify JWT from Authorization: Bearer header
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token',
        },
      });
    }
  });

  // Verify JWT AND check that the user has the expected role
  fastify.decorate('requireRole', function (role) {
    return async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization token',
          },
        });
      }
      if (request.user.role !== role) {
        return reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: `This action requires the ${role} role`,
          },
        });
      }
    };
  });
}

export default fp(authPlugin, { name: 'auth' });
