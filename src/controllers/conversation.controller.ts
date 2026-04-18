import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/conversation.service';

/**
 * Controller for managing conversations and participants.
 * Thin wrapper that validates request and delegates to ConversationService.
 */
export class ConversationController {
  /**
   * Create a new conversation and its participants.
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, type, participantIds, description, category, heroImage, isPrivate, parentId } = req.body;
      const createdBy = (req as any).user?.userId;

      const conversation = await ConversationService.createConversation({
        name,
        type,
        createdBy,
        participantIds,
        description,
        category,
        heroImage,
        isPrivate,
        parentId,
      });

      res.status(201).json({
        status: 'success',
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all conversations for the authenticated user.
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const conversations = await ConversationService.listUserConversations(userId);

      res.status(200).json({
        status: 'success',
        results: conversations.length,
        data: { conversations },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a conversation by its ID.
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const conversation = await ConversationService.getConversationById(id, userId);

      res.status(200).json({
        status: 'success',
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add a new participant to a conversation.
   */
  static async addParticipant(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // Conversation ID
      const { userId, role } = req.body;
      const requesterId = (req as any).user?.userId;

      const conversation = await ConversationService.addParticipant(id, userId, requesterId, role);

      res.status(200).json({
        status: 'success',
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a participant from a conversation.
   */
  static async removeParticipant(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params; // Conversation ID and Target User ID
      const requesterId = (req as any).user?.userId;

      await ConversationService.removeParticipant(id, userId, requesterId);

      res.status(200).json({
        status: 'success',
        message: 'Participant removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const requesterId = (req as any).user?.userId;

      const conversation = await ConversationService.updateConversation(id, requesterId, req.body);

      res.status(200).json({
        status: 'success',
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Explore public conversations.
   */
  static async explore(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      const { category, query, sortBy } = req.query;

      const conversations = await ConversationService.exploreConversations(userId, {
        category: category as string,
        query: query as string,
        sortBy: sortBy as string,
      });

      res.status(200).json({
        status: 'success',
        results: conversations.length,
        data: { conversations },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join a public conversation.
   */
  static async join(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      const conversation = await ConversationService.joinConversation(id, userId);

      res.status(200).json({
        status: 'success',
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a conversation.
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const requesterId = (req as any).user?.userId;

      await ConversationService.deleteConversation(id, requesterId);

      res.status(204).json({
        status: 'success',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a participant's role.
   */
  static async updateParticipantRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params;
      const { role } = req.body;
      const requesterId = (req as any).user?.userId;

      const participant = await ConversationService.updateParticipantRole(id, userId, requesterId, role);

      res.status(200).json({
        status: 'success',
        data: { participant },
      });
    } catch (error) {
      next(error);
    }
  }
}
