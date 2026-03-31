import { Server, Socket } from 'socket.io';
import prisma from '../utils/prisma';
import { UserStatus } from '@prisma/client';

/**
 * Handlers for real-time presence and status tracking.
 * Broadcasts online/offline/away status and typing indicators to active rooms.
 */

export const registerPresenceHandlers = (io: Server, socket: Socket) => {
  const userId = (socket as any).user.userId;

  /**
   * Updates user status and broadcasts to all conversations they are in.
   */
  const updateStatus = async (status: UserStatus) => {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { status, lastSeen: new Date() },
      });

      // Broadly broadcast status change (in a real production app, we would limit to friends/contacts)
      // For this portfolio, we broadcast to all user rooms the user belongs to.
      socket.broadcast.emit('user:status_changed', { userId, status });
    } catch (error) {
      console.error('[Presence] Failed to update status:', error);
    }
  };

  /**
   * Initial Connection: Set status to ONLINE.
   */
  updateStatus(UserStatus.ONLINE);

  /**
   * Handle 'status:update' triggered by the client (e.g., AWAY, DND).
   */
  socket.on('status:update', (data: { status: UserStatus }) => {
    if (Object.values(UserStatus).includes(data.status)) {
      updateStatus(data.status);
    }
  });

  /**
   * Handle 'typing:start' indicator.
   */
  socket.on('typing:start', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
      userId,
      conversationId: data.conversationId,
    });
  });

  /**
   * Handle 'typing:stop' indicator.
   */
  socket.on('typing:stop', (data: { conversationId: string }) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      userId,
      conversationId: data.conversationId,
    });
  });

  /**
   * Handle Disconnection: Set status to OFFLINE.
   */
  socket.on('disconnect', () => {
    updateStatus(UserStatus.OFFLINE);
  });
};
