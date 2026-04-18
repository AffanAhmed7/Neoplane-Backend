import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { 
  createConversationSchema, 
  updateConversationSchema, 
  addParticipantSchema,
  updateRoleSchema
} from '../utils/validators/conversation.validator';

/**
 * Routes for conversation management.
 * All endpoints are protected by JWT authentication.
 */

const router = Router();

// 1. Conversation Creation, Exploration & Retrieval
router.post('/', authMiddleware, validateRequest(createConversationSchema), ConversationController.create);
router.get('/explore', authMiddleware, ConversationController.explore);
router.get('/', authMiddleware, ConversationController.list);
router.get('/:id', authMiddleware, ConversationController.getById);
router.get('/:id/preview', authMiddleware, ConversationController.getPreview);

// 1.5. Joining & Join Requests
router.post('/:id/join', authMiddleware, ConversationController.join);
router.get('/:id/join-requests', authMiddleware, ConversationController.getJoinRequests);
router.post('/join-requests/:requestId/resolve', authMiddleware, ConversationController.resolveJoinRequest);

// 2. Metadata Updates
router.patch('/:id', authMiddleware, validateRequest(updateConversationSchema), ConversationController.update);
router.delete('/:id', authMiddleware, ConversationController.delete);

// 3. Participant Management (now sends invites instead of direct-adding)
router.post('/:id/participants', authMiddleware, validateRequest(addParticipantSchema), ConversationController.addParticipant);
router.patch('/:id/participants/:userId/role', authMiddleware, validateRequest(updateRoleSchema), ConversationController.updateParticipantRole);
router.delete('/:id/participants/:userId', authMiddleware, ConversationController.removeParticipant);

// 4. Channel Invites
router.get('/invites/pending', authMiddleware, ConversationController.getPendingInvites);
router.post('/invites/:inviteId/accept', authMiddleware, ConversationController.acceptInvite);
router.post('/invites/:inviteId/decline', authMiddleware, ConversationController.declineInvite);

export default router;
