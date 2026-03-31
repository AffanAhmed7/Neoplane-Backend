import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';

/**
 * Controller for managing user notifications.
 * Connects the API layer to NotificationService for real-time alert management.
 */
export class NotificationController {
  /**
   * Retrieves paginated notifications for the authenticated user.
   */
  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { page, limit } = req.query as any;

      const data = await NotificationService.getNotifications(userId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      res.status(200).json({
        status: 'success',
        ...data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marks a set of notifications as read.
   */
  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { notificationIds } = req.body;

      await NotificationService.markAsRead(userId, notificationIds);

      res.status(200).json({
        status: 'success',
        message: 'Notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk clears all read notifications for the authenticated user.
   */
  static async clear(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      await NotificationService.clearNotifications(userId);

      res.status(200).json({
        status: 'success',
        message: 'Read notifications cleared',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns the count of unread notifications for the UI badge.
   */
  static async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const count = await NotificationService.getUnreadCount(userId);

      res.status(200).json({
        status: 'success',
        data: { unreadCount: count },
      });
    } catch (error) {
      next(error);
    }
  }
}
