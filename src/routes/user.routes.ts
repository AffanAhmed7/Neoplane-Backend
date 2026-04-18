import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Routes for user profile management.
 * All endpoints are protected by JWT authentication.
 */
const router = Router();

// 1. Own profile
router.get('/me', authMiddleware, UserController.getMe);
router.patch('/me', authMiddleware, UserController.updateProfile);
router.post('/me/password', authMiddleware, UserController.updatePassword);
router.patch('/me/status', authMiddleware, UserController.updateStatus);
router.patch('/me/preferences', authMiddleware, UserController.updatePreferences);

// 2. Public profile of any user (must be after /me routes to avoid conflict)
router.get('/:id', authMiddleware, UserController.getProfile);

export default router;
