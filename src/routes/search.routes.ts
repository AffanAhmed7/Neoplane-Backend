import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { 
  messageSearchSchema, 
  userSearchSchema, 
  fileSearchSchema 
} from '../utils/validators/search.validator';

/**
 * Routes for searching across messages, users, and files.
 * All endpoints are protected by JWT authentication.
 */

const router = Router();

// 1. Search Messages
router.get('/messages', authMiddleware, validateRequest(messageSearchSchema), SearchController.messages);

// 2. Search Users
router.get('/users', authMiddleware, validateRequest(userSearchSchema), SearchController.users);

// 3. Search Files & Media
router.get('/files', authMiddleware, validateRequest(fileSearchSchema), SearchController.files);

export default router;
