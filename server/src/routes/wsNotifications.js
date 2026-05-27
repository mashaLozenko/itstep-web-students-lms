/**
 * WebSocket notifications route.
 * Clients connect via: GET /ws/notifications?token=<jwt>
 *
 * The query-string token is necessary because browsers cannot send
 * Authorization headers on WebSocket handshakes (HTTP upgrade).
 *
 * On connect:
 *   1. Verify the JWT from ?token=
 *   2. Register the socket in fastify.wsConnections (Map<userId, Set<WebSocket>>)
 *   3. On close, clean up the registry
 *
 * Messages pushed to the client are JSON-serialised Notification objects.
 */
export default async function wsNotificationsRoute(fastify) {
  fastify.get('/ws/notifications', {
    websocket: true,
    schema: {
      summary: 'WebSocket notification stream',
      description: 'Establish a persistent WebSocket connection to receive real-time notifications. Pass the JWT as a query parameter: ?token=<jwt>. Events pushed: grade_posted, comment_added, announcement_published.',
      tags: ['Notifications'],
    },
  }, async (connection, request) => {
    const { socket } = connection;
    const token = request.query.token;

    // Verify token
    let userId;
    try {
      const payload = fastify.jwt.verify(token);
      userId = payload.sub;
    } catch (err) {
      socket.send(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }));
      socket.close();
      return;
    }

    // Register connection
    if (!fastify.wsConnections.has(userId)) {
      fastify.wsConnections.set(userId, new Set());
    }
    fastify.wsConnections.get(userId).add(socket);

    fastify.log.info({ userId }, 'WebSocket client connected');

    // Send confirmation
    socket.send(JSON.stringify({ type: 'connected', userId }));

    // Clean up on disconnect
    socket.on('close', () => {
      const userSockets = fastify.wsConnections.get(userId);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          fastify.wsConnections.delete(userId);
        }
      }
      fastify.log.info({ userId }, 'WebSocket client disconnected');
    });

    socket.on('error', (err) => {
      fastify.log.error({ userId, err }, 'WebSocket error');
    });
  });
}
