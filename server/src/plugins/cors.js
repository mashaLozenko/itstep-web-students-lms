import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

/**
 * CORS plugin — allows the Vite dev server (default :5173) and any other
 * origin to call the API. In production, restrict `origin` to your actual domain.
 */
async function corsPlugin(fastify) {
  await fastify.register(fastifyCors, {
    origin: true, // reflect request origin — fine for dev/teaching; restrict in production
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}

export default fp(corsPlugin, { name: 'cors' });
