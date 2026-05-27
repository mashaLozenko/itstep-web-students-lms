import fp from 'fastify-plugin';
import fastifyMultipart from '@fastify/multipart';

/**
 * Multipart plugin — enables file upload support via @fastify/multipart.
 * Files are limited to 50 MB per upload. Access uploaded files via
 * `await request.file()` (single) or `request.files()` (multiple) in routes.
 */
async function multipartPlugin(fastify) {
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
      files: 5,
    },
  });
}

export default fp(multipartPlugin, { name: 'multipart' });
