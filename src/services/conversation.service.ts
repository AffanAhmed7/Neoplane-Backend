import prisma from '../utils/prisma';
import { ConversationType, ParticipantRole } from '@prisma/client';
import { getIO } from '../sockets/index';

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
    description?: string;
    category?: string;
    heroImage?: string;
    isPrivate?: boolean;
    parentId?: string;
  }) {
    const { name, type, createdBy, participantIds, description, category, heroImage, isPrivate, parentId } = data;

    // Authorization check for groups (parentId)
    if (parentId) {
      const parentChannel = await prisma.conversation.findUnique({
        where: { id: parentId },
        include: {
          participants: {
            where: { userId: createdBy }
          }
        }
      });

      if (!parentChannel) {
        const error: any = new Error('Parent channel not found');
        error.statusCode = 404;
        throw error;
      }

      const requester = parentChannel.participants[0];
      const isAuthorized = requester?.role === ParticipantRole.ADMIN || parentChannel.creatorId === createdBy;

      if (!isAuthorized) {
        const error: any = new Error('Insufficient permissions to create groups in this channel');
        error.statusCode = 403;
        throw error;
      }
    }

    // 1. Ensure all participant IDs are unique and include the creator
    const allParticipants = Array.from(new Set([...participantIds, createdBy]));

    // 2. Perform atomic creation of conversation and its participants
    const conversation = await prisma.$transaction(async (tx) => {
      const newConversation = await tx.conversation.create({
        data: {
          name,
          type,
          description,
          category,
          heroImage,
          isPrivate: isPrivate ?? false,
          creatorId: createdBy,
          parentId,
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

    // Notify all participants about the new conversation so they can join the room and update their lists
    try {
      const io = getIO();
      allParticipants.forEach((userId) => {
        // We emit to each user's private room
        io.to(`user:${userId}`).emit('conversation:new', conversation);
      });
    } catch (err) {
      console.error('[ConversationService] Socket emission failed:', err);
    }

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
   * Explores public channels.
   */
  static async exploreConversations(userId: string, options: { category?: string; query?: string; sortBy?: string }) {
    const { category, query, sortBy } = options;

    const where: any = {
      isPrivate: false,
      type: 'CHANNEL',
    };

    if (category) {
      where.category = category;
    }

    if (query) {
      where.name = {
        contains: query,
        mode: 'insensitive',
      };
    }

    return await prisma.conversation.findMany({
      where,
      include: {
        _count: {
          select: { participants: true },
        },
      },
      orderBy: sortBy === 'members' ? {
        participants: { _count: 'desc' },
      } : {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Allows a user to join a public conversation.
   */
  static async joinConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      const error: any = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    if (conversation.isPrivate) {
      const error: any = new Error('Cannot join private conversation');
      error.statusCode = 403;
      throw error;
    }

    // Check if already a member
    const existing = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });

    if (existing) {
      const error: any = new Error('User is already a participant');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        participants: {
          create: { userId, role: ParticipantRole.MEMBER },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
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
   * Updates conversation metadata (name, description, heroImage).
   * Requirement: Only admins or the creator can update.
   */
  static async updateConversation(conversationId: string, requesterId: string, data: { name?: string; description?: string; heroImage?: string }) {
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
   * Deletes a conversation and all its participants/messages.
   * Requirement: Only admins or the creator can delete.
   */
  static async deleteConversation(id: string, requesterId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          where: { userId: requesterId }
        }
      }
    });

    if (!conversation) {
      const error: any = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    const requester = conversation.participants[0];
    const isAuthorized = requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

    if (!isAuthorized) {
      const error: any = new Error('Insufficient permissions to delete this conversation');
      error.statusCode = 403;
      throw error;
    }

    // Capture participants before deletion for notification
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: id },
      select: { userId: true }
    });

    await prisma.conversation.delete({
      where: { id }
    });

    // Notify all participants about the deletion
    try {
      const io = getIO();
      participants.forEach((p) => {
        io.to(`user:${p.userId}`).emit('conversation:deleted', { id });
      });
    } catch (err) {
      console.error('[ConversationService] Socket deletion emission failed:', err);
    }

    return { success: true };
  }

  /**
   * Updates a participant's role in a conversation.
   * Requirement: Only admins or the creator can update roles.
   */
  static async updateParticipantRole(conversationId: string, targetUserId: string, requesterId: string, role: ParticipantRole) {
    const conversation = await this.getConversationById(conversationId, requesterId);

    // Authorization check
    const requester = conversation.participants.find((p) => p.userId === requesterId);
    const isAuthorized = requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

    if (!isAuthorized) {
      const error: any = new Error('Insufficient permissions to update participant roles');
      error.statusCode = 403;
      throw error;
    }

    const updatedParticipant = await prisma.conversationParticipant.update({
      where: {
        userId_conversationId: {
          userId: targetUserId,
          conversationId,
        },
      },
      data: { role },
      include: {
        user: {
          select: { id: true, username: true, avatar: true, status: true }
        }
      }
    });

    // Notify participants about the role change
    try {
      const io = getIO();
      io.to(`conversation:${conversationId}`).emit('participant:updated', { 
        conversationId, 
        participant: updatedParticipant 
      });
    } catch (err) {
      console.error('[ConversationService] Socket updated emission failed:', err);
    }

    return updatedParticipant;
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
