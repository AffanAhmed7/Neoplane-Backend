import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { 
  sendMessageSchema, 
  updateMessageSchema, 
  reactionSchema, 
  paginationSchema 
} from '../utils/validators/message.validator';

/**
 * Routes for messaging management.
 * All endpoints are protected by JWT authentication.
 */

const router = Router();

// 1. Sending & Listing Messages
router.post('/', authMiddleware, validateRequest(sendMessageSchema), MessageController.send);
router.get('/:conversationId', authMiddleware, validateRequest(paginationSchema), MessageController.list);

// 2. Editing & Deleting
router.patch('/:id', authMiddleware, validateRequest(updateMessageSchema), MessageController.edit);
router.delete('/:id', authMiddleware, MessageController.delete);

// 3. Reactions & Read Receipts
router.post('/:id/react', authMiddleware, validateRequest(reactionSchema), MessageController.react);
router.post('/:conversationId/read', authMiddleware, MessageController.read);

export default router;
