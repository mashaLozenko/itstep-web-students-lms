import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import { config } from '../config.js';

/**
 * Static plugin — serves uploaded files at /uploads/*.
 * Files are stored in the UPLOAD_DIR configured via environment variable.
 */
async function staticPlugin(fastify) {
  await fastify.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });
}

export default fp(staticPlugin, { name: 'static' });
