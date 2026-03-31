import { Server, Socket } from 'socket.io';
import prisma from '../utils/prisma';

/**
 * Handlers for real-time notifications.
 * Manages notification read/clear status and secure emission.
 */
export const registerNotificationHandlers = (io: Server, socket: Socket) => {
  const userId = (socket as any).user.userId;

  /**
   * Handle 'notification:read' marking a specific notification as seen.
   */
  socket.on('notification:read', async (data: { notificationId: string }) => {
    try {
      await prisma.notification.update({
        where: { id: data.notificationId, userId },
        data: { isRead: true },
      });

      // Acknowledge locally if needed
    } catch (error) {
      console.error('[Notification] Failed to mark as read:', error);
    }
  });

  /**
   * Handle 'notification:clear' bulk deleting read notifications.
   */
  socket.on('notification:clear', async () => {
    try {
      await prisma.notification.deleteMany({
        where: { userId, isRead: true },
      });
    } catch (error) {
      console.error('[Notification] Failed to clear notifications:', error);
    }
  });
};
