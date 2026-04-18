import { Router } from 'express';
import { FriendController } from '../controllers/friend.controller';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Routes for the friend system.
 * All endpoints are protected by JWT authentication.
 */
const router = Router();

// 1. Friend List & Requests
router.get('/', authMiddleware, FriendController.getFriends);
router.get('/requests', authMiddleware, FriendController.getRequests);

// 2. Send / Accept / Decline
router.post('/request', authMiddleware, FriendController.sendRequest);
router.post('/request/:id/accept', authMiddleware, FriendController.acceptRequest);
router.delete('/request/:id', authMiddleware, FriendController.declineRequest);

// 3. Check friendship
router.get('/check/:friendId', authMiddleware, FriendController.checkFriendship);

// 4. Unfriend
router.delete('/:friendId', authMiddleware, FriendController.removeFriend);

export default router;
