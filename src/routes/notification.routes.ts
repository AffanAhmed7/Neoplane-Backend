import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { 
  notificationPaginationSchema, 
  notificationIdsSchema 
} from '../utils/validators/notification.validator';

/**
 * Routes for managing user notifications.
 * All endpoints are protected by JWT authentication and provide real-time updates.
 */

const router = Router();

// 1. Get paginated notifications
router.get('/', authMiddleware, validateRequest(notificationPaginationSchema), NotificationController.getNotifications);

// 2. Get unread count for badge
router.get('/count', authMiddleware, NotificationController.getUnreadCount);

// 3. Mark notifications as read (Bulk or single)
router.post('/read', authMiddleware, validateRequest(notificationIdsSchema), NotificationController.markAsRead);

// 4. Bulk clear read notifications
router.post('/clear', authMiddleware, NotificationController.clear);

export default router;
