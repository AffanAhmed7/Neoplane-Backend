import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { 
  createConversationSchema, 
  updateConversationSchema, 
  addParticipantSchema 
} from '../utils/validators/conversation.validator';

/**
 * Routes for conversation management.
 * All endpoints are protected by JWT authentication.
 */

const router = Router();

// 1. Conversation Creation & Retrieval
router.post('/', authMiddleware, validateRequest(createConversationSchema), ConversationController.create);
router.get('/', authMiddleware, ConversationController.list);
router.get('/:id', authMiddleware, ConversationController.getById);

// 2. Metadata Updates
router.patch('/:id', authMiddleware, validateRequest(updateConversationSchema), ConversationController.update);

// 3. Participant Management
router.post('/:id/participants', authMiddleware, validateRequest(addParticipantSchema), ConversationController.addParticipant);
router.delete('/:id/participants/:userId', authMiddleware, ConversationController.removeParticipant);

export default router;
