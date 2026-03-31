import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';

/**
 * Controller for managing search across messages, users, and files.
 * Thin wrapper that validates request and delegates to SearchService.
 */

export class SearchController {
  /**
   * Search for messages with full-text search and filters.
   */
  static async messages(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, conversationId, type, limit } = req.query as any;
      const userId = (req as any).user.userId;

      const results = await SearchService.searchMessages({
        query,
        userId,
        conversationId,
        type,
        limit: parseInt(limit, 10),
      });

      res.status(200).json({
        status: 'success',
        results: results.length,
        data: { messages: results },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search for users by username or email.
   */
  static async users(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = req.query as any;

      const results = await SearchService.searchUsers(query);

      res.status(200).json({
        status: 'success',
        results: results.length,
        data: { users: results },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search for files and media metadata.
   */
  static async files(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, limit } = req.query as any;
      const userId = (req as any).user.userId;

      const results = await SearchService.searchFiles({
        query,
        userId,
        limit: parseInt(limit, 10),
      });

      res.status(200).json({
        status: 'success',
        results: results.length,
        data: { files: results },
      });
    } catch (error) {
      next(error);
    }
  }
}
