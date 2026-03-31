import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../utils/validators/auth.validator';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Routes for authentication endpoints.
 * Handles user registration, login, token rotation, and secure sessions.
 */

const router = Router();

// 1. User Registration
router.post('/register', validateRequest(registerSchema), AuthController.register);

// 2. User Login
router.post('/login', validateRequest(loginSchema), AuthController.login);

// 3. Token Refresh
router.post('/refresh', validateRequest(refreshTokenSchema), AuthController.refresh);

// 4. User Logout (Protected)
router.post('/logout', authMiddleware, AuthController.logout);

export default router;
