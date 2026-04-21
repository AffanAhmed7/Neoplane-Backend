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
      // Use validated data which includes Zod defaults and transformations
      const { query, conversationId, type, limit } = (req as any).validatedData || req.query;
      const userId = (req as any).user.userId;

      const results = await SearchService.searchMessages({
        query,
        userId,
        conversationId,
        type,
        limit: Number(limit) || 20,
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
      const { query } = (req as any).validatedData || req.query;

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
      const { query, limit } = (req as any).validatedData || req.query;
      const userId = (req as any).user.userId;

      const results = await SearchService.searchFiles({
        query,
        userId,
        limit: Number(limit) || 20,
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
