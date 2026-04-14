import prisma from '../utils/prisma';
import { ConversationType, ParticipantRole } from '@prisma/client';

/**
 * Service layer for managing conversations and participants.
 * Handles atomic creation, permission-based updates, and participant management.
 */
export class ConversationService {
  /**
   * Creates a new conversation with initial participants using a transaction.
   */
  static async createConversation(data: {
    name?: string;
    type: ConversationType;
    createdBy: string;
    participantIds: string[];
  }) {
    const { name, type, createdBy, participantIds } = data;

    // 1. Ensure all participant IDs are unique and include the creator
    const allParticipants = Array.from(new Set([...participantIds, createdBy]));

    // 2. Perform atomic creation of conversation and its participants
    const conversation = await prisma.$transaction(async (tx) => {
      const newConversation = await tx.conversation.create({
        data: {
          name,
          type,
          creatorId: createdBy,
          participants: {
            create: allParticipants.map((userId) => ({
              userId,
              role: userId === createdBy ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
            })),
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      return newConversation;
    });

    return conversation;
  }

  /**
   * Retrieves a conversation by its ID, verifying that the requester is a participant.
   */
  static async getConversationById(id: string, requesterId: string) {
    const isMember = await this.validateMembership(id, requesterId);
    if (!isMember) {
      const error: any = new Error('You do not have permission to view this conversation');
      error.statusCode = 403;
      throw error;
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                status: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { username: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      const error: any = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    return conversation;
  }

  /**
   * Lists all conversations for a user, sorted by the most recent activity.
   */
  static async listUserConversations(userId: string) {
    return await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Adds a new participant to an existing conversation.
   * Requirement: Only admins or the creator can add members.
   */
  static async addParticipant(conversationId: string, userId: string, requesterId: string, role: ParticipantRole = ParticipantRole.MEMBER) {
    const conversation = await this.getConversationById(conversationId, requesterId);

    // 1. Authorization check
    const requester = conversation.participants.find((p) => p.userId === requesterId);
    const isAuthorized = requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

    if (!isAuthorized) {
      const error: any = new Error('Insufficient permissions to add participants');
      error.statusCode = 403;
      throw error;
    }

    // 2. Check if participant already exists
    const existing = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });

    if (existing) {
      const error: any = new Error('User is already a participant in this conversation');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        participants: {
          create: { userId, role },
        },
      },
      include: {
        participants: true,
      },
    });
  }

  /**
   * Removes a participant from a conversation.
   * Requirement: Only admins or the creator can remove members.
   */
  static async removeParticipant(conversationId: string, targetUserId: string, requesterId: string) {
    const conversation = await this.getConversationById(conversationId, requesterId);

    // Authorization check
    const requester = conversation.participants.find((p) => p.userId === requesterId);
    const isAuthorized = requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

    if (!isAuthorized) {
      const error: any = new Error('Insufficient permissions to remove participants');
      error.statusCode = 403;
      throw error;
    }

    await prisma.conversationParticipant.delete({
      where: {
        userId_conversationId: {
          userId: targetUserId,
          conversationId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Updates conversation metadata (name, avatar).
   * Requirement: Only admins or the creator can update.
   */
  static async updateConversation(conversationId: string, requesterId: string, data: { name?: string; avatar?: string }) {
    const conversation = await this.getConversationById(conversationId, requesterId);

    // Authorization check
    const requester = conversation.participants.find((p) => p.userId === requesterId);
    const isAuthorized = requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

    if (!isAuthorized) {
      const error: any = new Error('Insufficient permissions to update conversation');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.conversation.update({
      where: { id: conversationId },
      data,
    });
  }

  /**
   * Internal helper to check if a user is a participant in a conversation.
   */
  static async validateMembership(conversationId: string, userId: string): Promise<boolean> {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });
    return !!participant;
  }
}
