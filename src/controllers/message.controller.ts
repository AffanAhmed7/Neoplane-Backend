import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';

/**
 * Controller for managing messages, threads, and reactions.
 * Thin wrapper that validates request and delegates to MessageService.
 */
export class MessageController {
  /**
   * Send a new message in a conversation.
   */
  static async send(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = (req as any).user?.userId;
      const message = await MessageService.sendMessage({
        ...req.body,
        senderId,
      });

      res.status(201).json({
        status: 'success',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get messages for a conversation with pagination.
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user?.userId;
      const { cursor, limit } = req.query as any;

      const messages = await MessageService.getMessages(conversationId, {
        cursor,
        limit: parseInt(limit, 10),
      }, userId);

      res.status(200).json({
        status: 'success',
        results: messages.length,
        data: { messages },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Edit an existing message.
   */
  static async edit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const { content } = req.body;

      const message = await MessageService.editMessage(id, userId, content);

      res.status(200).json({
        status: 'success',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft delete a message.
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      await MessageService.deleteMessage(id, userId);

      res.status(200).json({
        status: 'success',
        message: 'Message deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle an emoji reaction on a message.
   */
  static async react(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const { emoji } = req.body;

      const result = await MessageService.reactToMessage(id, userId, emoji);

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a conversation as read for the user.
   */
  static async read(req: Request, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user?.userId;
      const { lastReadMessageId } = req.body;

      await MessageService.markAsRead(conversationId, userId, lastReadMessageId);

      res.status(200).json({
        status: 'success',
        message: 'Conversation marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle the pinned status of a message.
   */
  static async togglePin(req: Request, res: Response, next: NextFunction) {
    try {
      const { messageId } = req.params;
      const { conversationId } = req.body;
      const userId = (req as any).user?.userId;

      const message = await MessageService.togglePin(messageId, userId, conversationId);

      res.status(200).json({
        status: 'success',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }
}
