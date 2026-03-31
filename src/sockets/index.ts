import { Server, Socket } from 'socket.io';
import http from 'http';
import { verifyToken } from '../utils/jwt';
import { ConversationService } from '../services/conversation.service';
import { registerChatHandlers } from './chat.socket';
import { registerPresenceHandlers } from './presence.socket';
import { registerNotificationHandlers } from './notification.socket';

/**
 * Entry point for Socket.io integration.
 * Handles server initialization, JWT authentication, and handler registration.
 */

let io: Server | null = null;

/**
 * Returns the initialized Socket.io instance.
 * Useful for services that need to emit events from outside handlers.
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

export const setupSockets = (server: http.Server) => {
  const ioInstance = new Server(server, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST'],
    },
  });

  io = ioInstance;

  /**
   * Handshake Middleware: Authenticate user using JWT from handshake.auth or headers.
   */
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyToken(token);
      (socket as any).user = payload;
      next();
    } catch (error) {
      next(new Error('Invalid or expired authentication token'));
    }
  });

  /**
   * Connection Logic: Handles user rooms, presence, and handler registration.
   */
  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).user.userId;
    console.log(`[Socket] User connected: ${userId}`);

    // 1. Join private room for user notifications
    socket.join(`user:${userId}`);

    // 2. Fetch and join all conversation rooms for this user
    try {
      const conversations = await ConversationService.listUserConversations(userId);
      conversations.forEach((conv) => {
        socket.join(`conversation:${conv.id}`);
        console.log(`[Socket] Joined Room: conversation:${conv.id}`);
      });
    } catch (error) {
      console.error('[Socket] Failed to join conversation rooms:', error);
    }

    // 3. Register all modular handlers
    registerChatHandlers(ioInstance, socket);
    registerPresenceHandlers(ioInstance, socket);
    registerNotificationHandlers(ioInstance, socket);

    // 4. Global disconnection logic
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${userId} (${reason})`);
    });
  });

  return io;
};
