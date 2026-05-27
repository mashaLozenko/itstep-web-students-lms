import fp from 'fastify-plugin';
import fastifyWebsocket from '@fastify/websocket';

/**
 * WebSocket plugin — registers @fastify/websocket and exposes:
 *   - fastify.wsConnections: Map<userId, Set<WebSocket>> — active connections
 *   - fastify.pushNotification(userId, kind, payload): persists a Notification
 *     row in the DB and sends the payload JSON to all open sockets for that user.
 *
 * Clients connect via: GET /ws/notifications?token=<jwt>
 * The query-string token is used because browsers cannot set Authorization
 * headers on WebSocket handshakes.
 */
async function websocketPlugin(fastify) {
  await fastify.register(fastifyWebsocket);

  // In-memory connection registry: userId → Set of WebSocket instances
  const connections = new Map();
  fastify.decorate('wsConnections', connections);

  /**
   * Push a notification to a user.
   * @param {string} userId - Target user ID
   * @param {string} kind - Notification kind (e.g. 'grade_posted')
   * @param {object} payload - Arbitrary JSON-serialisable data
   */
  fastify.decorate('pushNotification', async function (userId, kind, payload) {
    // Persist to DB
    const notification = await fastify.prisma.notification.create({
      data: {
        userId,
        kind,
        payloadJson: JSON.stringify(payload),
      },
    });

    // Push to open WebSocket connections for this user
    const userSockets = connections.get(userId);
    if (userSockets && userSockets.size > 0) {
      const message = JSON.stringify({ id: notification.id, kind, payload, createdAt: notification.createdAt });
      for (const socket of userSockets) {
        if (socket.readyState === 1 /* OPEN */) {
          socket.send(message);
        }
      }
    }

    return notification;
  });
}

export default fp(websocketPlugin, { name: 'websocket' });
