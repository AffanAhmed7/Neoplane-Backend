import { Request, Response, NextFunction } from 'express';
import { FriendService } from '../services/friend.service';

/**
 * Controller for the friend system.
 */
export class FriendController {
  /**
   * GET /api/friends — List all friends.
   */
  static async getFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const friends = await FriendService.getFriends(userId);
      res.status(200).json({ status: 'success', results: friends.length, data: { friends } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/friends/requests — Incoming + outgoing pending requests.
   */
  static async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const requests = await FriendService.getRequests(userId);
      res.status(200).json({ status: 'success', data: requests });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/friends/request — Send a friend request by username.
   */
  static async sendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { username } = req.body;
      const request = await FriendService.sendRequest(userId, username);
      res.status(201).json({ status: 'success', data: { request } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/friends/request/:id/accept — Accept an incoming request.
   */
  static async acceptRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { id } = req.params;
      const result = await FriendService.acceptRequest(userId, id);
      res.status(200).json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/friends/request/:id — Decline or cancel a request.
   */
  static async declineRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { id } = req.params;
      await FriendService.declineRequest(userId, id);
      res.status(200).json({ status: 'success', message: 'Request removed' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/friends/:friendId — Remove a friend.
   */
  static async removeFriend(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.params;
      await FriendService.removeFriend(userId, friendId);
      res.status(200).json({ status: 'success', message: 'Friend removed' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/friends/check/:friendId — Check if two users are friends.
   */
  static async checkFriendship(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { friendId } = req.params;
      const isFriend = await FriendService.areFriends(userId, friendId);
      res.status(200).json({ status: 'success', data: { isFriend } });
    } catch (error) {
      next(error);
    }
  }
}
