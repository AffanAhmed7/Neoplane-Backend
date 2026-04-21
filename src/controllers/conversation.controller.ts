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
      const { name, type, participantIds, description, category, heroImage, isPrivate, isPublic, isHidden, parentId } = req.body;
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
        isPublic,
        isHidden,
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
      const id = req.params.id as string;
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
   * Invite a user to a conversation (sends an invite, does not directly add).
   */
  static async addParticipant(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string; // Conversation ID
      const { userId } = req.body;
      const requesterId = (req as any).user?.userId;

      const invite = await ConversationService.inviteParticipant(id, userId, requesterId);

      res.status(200).json({
        status: 'success',
        message: 'Invite sent successfully',
        data: { invite },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept a channel invite.
   */
  static async acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const inviteId = req.params.inviteId as string;
      const userId = (req as any).user?.userId;

      const result = await ConversationService.acceptInvite(inviteId, userId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Decline a channel invite.
   */
  static async declineInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const inviteId = req.params.inviteId as string;
      const userId = (req as any).user?.userId;

      await ConversationService.declineInvite(inviteId, userId);

      res.status(200).json({
        status: 'success',
        message: 'Invite declined',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all pending invites for the current user.
   */
  static async getPendingInvites(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;

      const invites = await ConversationService.getPendingInvites(userId);

      res.status(200).json({
        status: 'success',
        data: { invites },
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
      const id = req.params.id as string;
      const userId = req.params.userId as string;
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
      const id = req.params.id as string;
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
   * Join a public conversation or request to join a private one.
   */
  static async join(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.userId;

      const result = await ConversationService.joinConversation(id, userId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a conversation preview for non-members.
   */
  static async getPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const conversation = await ConversationService.getConversationPreview(id);

      res.status(200).json({
        status: 'success',
        data: { conversation },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List join requests for a conversation (Admin only).
   */
  static async getJoinRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.userId;
      const requests = await ConversationService.getJoinRequests(id, userId);

      res.status(200).json({
        status: 'success',
        data: { requests },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve or Decline a join request (Admin only).
   */
  static async resolveJoinRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.requestId as string;
      const { status } = req.body; // 'APPROVED' | 'DECLINED'
      const userId = (req as any).user?.userId;

      const request = await ConversationService.resolveJoinRequest(requestId, userId, status);

      res.status(200).json({
        status: 'success',
        data: { request },
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
      const id = req.params.id as string;
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
      const id = req.params.id as string;
      const userId = req.params.userId as string;
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

  /**
   * Resolve a pending message request (Accept/Reject).
   */
  static async resolveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { action } = req.body; // 'ACCEPT' | 'REJECT'
      const userId = (req as any).user?.userId;

      const result = await ConversationService.resolveConversationRequest(id, userId, action);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
