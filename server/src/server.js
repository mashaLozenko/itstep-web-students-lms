import { buildApp } from './app.js';
import { config } from './config.js';

const fastify = await buildApp({
  logger: true,
});

try {
  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info(`Swagger UI: http://localhost:${config.port}/docs`);
  fastify.log.info(`API base:   http://localhost:${config.port}/api/v1`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
