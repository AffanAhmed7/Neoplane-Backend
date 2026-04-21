import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

/**
 * Controller for user profile management.
 */
export class UserController {
  /**
   * GET /api/users/:id — Public profile of any user.
   */
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const user = await UserService.getPublicProfile(id);
      res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/me — Own full profile.
   */
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const user = await UserService.getPublicProfile(userId);
      res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/me — Update username, bio, avatar, banner.
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { username, bio, avatar, banner } = req.body;
      const user = await UserService.updateProfile(userId, { username, bio, avatar, banner });
      res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/me/password — Change own password.
   */
  static async updatePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { currentPassword, newPassword } = req.body;
      await UserService.updatePassword(userId, currentPassword, newPassword);
      res.status(200).json({ status: 'success', message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/me/status — Update presence status.
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { status, customStatus } = req.body;
      const user = await UserService.updateStatus(userId, status, customStatus);
      res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/me/preferences — Update user preferences.
   */
  static async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { pinnedChannels, mutedChannels, mutedUsers } = req.body;
      const user = await UserService.updatePreferences(userId, { pinnedChannels, mutedChannels, mutedUsers });
      res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
      next(error);
    }
  }
}
