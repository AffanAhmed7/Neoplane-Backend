import prisma from '../utils/prisma';
import { getIO } from '../sockets';

/**
 * Service layer for managing user notifications.
 * Handles database persistence and real-time Socket.io emission.
 */
export class NotificationService {
  /**
   * Creates a new notification and emits it to the user's private room.
   */
  static async createNotification(data: {
    userId: string;
    type: string;
    entityId?: string;
    senderId?: string;
    conversationId?: string;
  }) {
    const { userId, type, entityId } = data;

    // 1. Persist to database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        entityId,
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    // 2. Emit real-time update to the user's private room
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('notification:new', notification);
      
      // Also emit updated unread count
      const unreadCount = await this.getUnreadCount(userId);
      io.to(`user:${userId}`).emit('notification:count_updated', { unreadCount });
    } catch (error) {
      console.error('[NotificationService] Socket emission failed:', error);
    }

    return notification;
  }

  /**
   * Retrieves paginated notifications for a user.
   */
  static async getNotifications(userId: string, pagination: { page: number; limit: number }) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marks specific notifications as read.
   */
  static async markAsRead(userId: string, notificationIds: string[]) {
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
      data: { isRead: true },
    });

    // Emit updated count and read event after marking as read
    try {
      const io = getIO();
      const unreadCount = await this.getUnreadCount(userId);
      io.to(`user:${userId}`).emit('notification:count_updated', { unreadCount });
      io.to(`user:${userId}`).emit('notification:read', { notificationIds });
    } catch (error) {
      // Ignore if socket not ready
    }

    return { status: 'success' };
  }

  /**
   * Bulk clears (deletes) all read notifications for a user.
   */
  static async clearNotifications(userId: string) {
    return await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });
  }

  /**
   * Returns the total count of unread notifications for a user.
   */
  static async getUnreadCount(userId: string) {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
