import prisma from '../utils/prisma';
import { ConversationType, ParticipantRole, ChannelInviteStatus } from '@prisma/client';
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
    const inviteeIds = allParticipants.filter(id => id !== createdBy);

    // 2. Perform atomic creation of conversation with ONLY the creator as participant
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
            create: type === 'DIRECT'
              // For DMs, add all participants immediately (no invite needed)
              ? allParticipants.map((userId) => ({
                  userId,
                  role: userId === createdBy ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
                }))
              // For channels/groups, only add the creator
              : [{ userId: createdBy, role: ParticipantRole.ADMIN }],
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
                  status: true,
                },
              },
            },
          },
        },
      });

      return newConversation;
    });

    // 3. For non-DIRECT conversations, send invites to the other participants
    if (type !== 'DIRECT' && inviteeIds.length > 0) {
      try {
        const io = getIO();
        for (const inviteeId of inviteeIds) {
          const invite = await prisma.channelInvite.create({
            data: {
              conversationId: conversation.id,
              inviterId: createdBy,
              inviteeId,
            },
            include: {
              conversation: { select: { id: true, name: true, type: true, heroImage: true } },
              inviter: { select: { id: true, username: true, avatar: true } },
            },
          });
          // Real-time push invite to the invitee
          io.to(`user:${inviteeId}`).emit('channel_invite:received', invite);
        }
      } catch (err) {
        console.error('[ConversationService] Failed to create invites:', err);
      }
    }

    // 4. Notify creator (and DM participants) about the new conversation
    try {
      const io = getIO();
      const notifyIds = type === 'DIRECT' ? allParticipants : [createdBy];
      notifyIds.forEach((userId) => {
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
                status: true,
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
      where: {
        ...where,
        isHidden: false,
      },
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
   * Returns a publicly accessible preview of a conversation.
   */
  static async getConversationPreview(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        heroImage: true,
        category: true,
        isPublic: true,
        isPrivate: true,
        _count: {
          select: { participants: true }
        }
      }
    });

    if (!conversation) {
      const error: any = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    return conversation;
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

    if (conversation.isPrivate && !conversation.isPublic) {
      // Check for existing request
      const existingRequest = await prisma.joinRequest.findUnique({
        where: { userId_conversationId: { userId, conversationId } }
      });

      if (existingRequest) {
        if (existingRequest.status === 'PENDING') {
          const error: any = new Error('Your join request is still pending approval');
          error.statusCode = 400;
          throw error;
        }
      }

      const request = await prisma.joinRequest.upsert({
        where: { userId_conversationId: { userId, conversationId } },
        update: { status: 'PENDING' },
        create: { userId, conversationId }
      });

      // Notify admins
      try {
        const io = getIO();
        const admins = await prisma.conversationParticipant.findMany({
          where: { conversationId, role: ParticipantRole.ADMIN },
          select: { userId: true }
        });
        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, avatar: true }
        });

        admins.forEach(admin => {
          io.to(`user:${admin.userId}`).emit('join_request:received', {
            request,
            user,
            conversation: { id: conversation.id, name: conversation.name }
          });
        });
      } catch (err) {
        console.error('[ConversationService] Join request notification failed:', err);
      }

      return { status: 'pending', request };
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

    const updated = await prisma.conversation.update({
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
              select: { id: true, username: true, avatar: true, status: true },
            },
          },
        },
      },
    });

    return { status: 'joined', conversation: updated };
  }

  /**
   * Retrieves Join Requests for a conversation.
   */
  static async getJoinRequests(conversationId: string, requesterId: string) {
    const isMember = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: requesterId, conversationId } }
    });

    if (!isMember || isMember.role !== ParticipantRole.ADMIN) {
      const error: any = new Error('Only admins can view join requests');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.joinRequest.findMany({
      where: { conversationId, status: 'PENDING' },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Approves or Declines a join request.
   */
  static async resolveJoinRequest(requestId: string, requesterId: string, status: 'APPROVED' | 'DECLINED') {
    const request = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { conversation: true }
    });

    if (!request) {
      const error: any = new Error('Join request not found');
      error.statusCode = 404;
      throw error;
    }

    const requester = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: requesterId, conversationId: request.conversationId } }
    });

    if (!requester || (requester.role !== ParticipantRole.ADMIN && request.conversation.creatorId !== requesterId)) {
      const error: any = new Error('Only admins can resolve join requests');
      error.statusCode = 403;
      throw error;
    }

    if (status === 'APPROVED') {
      const [updatedRequest] = await prisma.$transaction([
        prisma.joinRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED' }
        }),
        prisma.conversationParticipant.create({
          data: {
            userId: request.userId,
            conversationId: request.conversationId,
            role: ParticipantRole.MEMBER
          }
        })
      ]);

      const conv = await this.getConversationById(request.conversationId, request.userId);
      try {
        const io = getIO();
        io.to(`user:${request.userId}`).emit('conversation:new', conv);
      } catch (err) {
        console.error('[ConversationService] Notification for approval failed:', err);
      }

      return updatedRequest;
    } else {
      return await prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' }
      });
    }
  }

  /**
   * Sends a channel invite to a user instead of directly adding them.
   * Requirement: Only admins or the creator can invite members.
   */
  static async inviteParticipant(conversationId: string, userId: string, requesterId: string) {
    const conversation = await this.getConversationById(conversationId, requesterId);

    // 1. Authorization check
    const requester = conversation.participants.find((p) => p.userId === requesterId);
    const isAuthorized = requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

    if (!isAuthorized) {
      const error: any = new Error('Insufficient permissions to invite participants');
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
      const error: any = new Error('User is already a member of this channel');
      error.statusCode = 400;
      throw error;
    }

    // 3. Check if invite already exists
    const existingInvite = await prisma.channelInvite.findUnique({
      where: {
        inviteeId_conversationId: { inviteeId: userId, conversationId },
      },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      const error: any = new Error('An invite has already been sent to this user');
      error.statusCode = 400;
      throw error;
    }

    // 4. Upsert the invite (in case they previously declined, allow re-invite)
    const invite = await prisma.channelInvite.upsert({
      where: {
        inviteeId_conversationId: { inviteeId: userId, conversationId },
      },
      update: { status: ChannelInviteStatus.PENDING, inviterId: requesterId },
      create: {
        conversationId,
        inviterId: requesterId,
        inviteeId: userId,
      },
      include: {
        conversation: { select: { id: true, name: true, type: true, heroImage: true } },
        inviter: { select: { id: true, username: true, avatar: true } },
      },
    });

    // 5. Real-time push invite to the invitee
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('channel_invite:received', invite);
    } catch (err) {
      console.error('[ConversationService] Socket emission failed:', err);
    }

    return invite;
  }

  /**
   * Accepts a channel invite — adds the user as a participant and notifies the room.
   */
  static async acceptInvite(inviteId: string, userId: string) {
    const invite = await prisma.channelInvite.findUnique({
      where: { id: inviteId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: { id: true, username: true, avatar: true, status: true } } } },
          },
        },
      },
    });

    if (!invite || invite.inviteeId !== userId) {
      const error: any = new Error('Invite not found or does not belong to you');
      error.statusCode = 404;
      throw error;
    }

    if (invite.status !== 'PENDING') {
      const error: any = new Error('This invite has already been responded to');
      error.statusCode = 400;
      throw error;
    }

    // 1. Accept the invite and add the participant atomically
    const [updatedInvite, _participant] = await prisma.$transaction([
      prisma.channelInvite.update({
        where: { id: inviteId },
        data: { status: ChannelInviteStatus.ACCEPTED },
      }),
      prisma.conversationParticipant.create({
        data: {
          userId,
          conversationId: invite.conversationId,
          role: ParticipantRole.MEMBER,
        },
      }),
    ]);

    // 2. Fetch the full conversation to send to the new member
    const fullConversation = await prisma.conversation.findUnique({
      where: { id: invite.conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, avatar: true, status: true } },
          },
        },
      },
    });

    // 3. Notify via socket: send the full conversation to the new member
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('conversation:new', fullConversation);
      // Also notify existing members that a new participant joined
      io.to(`conversation:${invite.conversationId}`).emit('channel_invite:accepted', {
        conversationId: invite.conversationId,
        user: { id: userId },
      });
    } catch (err) {
      console.error('[ConversationService] Socket emission failed:', err);
    }

    return { invite: updatedInvite, conversation: fullConversation };
  }

  /**
   * Declines a channel invite.
   */
  static async declineInvite(inviteId: string, userId: string) {
    const invite = await prisma.channelInvite.findUnique({ where: { id: inviteId } });

    if (!invite || invite.inviteeId !== userId) {
      const error: any = new Error('Invite not found or does not belong to you');
      error.statusCode = 404;
      throw error;
    }

    if (invite.status !== 'PENDING') {
      const error: any = new Error('This invite has already been responded to');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.channelInvite.update({
      where: { id: inviteId },
      data: { status: ChannelInviteStatus.DECLINED },
    });
  }

  /**
   * Returns all pending invites for a user.
   */
  static async getPendingInvites(userId: string) {
    return await prisma.channelInvite.findMany({
      where: { inviteeId: userId, status: ChannelInviteStatus.PENDING },
      include: {
        conversation: { select: { id: true, name: true, type: true, heroImage: true } },
        inviter: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Removes a participant from a conversation.
   * Requirement: Only admins or the creator can remove members.
   */
  static async removeParticipant(conversationId: string, targetUserId: string, requesterId: string) {
    const conversation = await this.getConversationById(conversationId, requesterId);

    // Authorization check: allow if self-leave OR admin/creator
    const requester = conversation.participants.find((p) => p.userId === requesterId);
    const isAuthorized = targetUserId === requesterId || requester?.role === ParticipantRole.ADMIN || conversation.creatorId === requesterId;

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

    // Notify all participants about the removal
    try {
      const io = getIO();
      // 1. Notify the removed user
      io.to(`user:${targetUserId}`).emit('conversation:removed', { id: conversationId });
      // 2. Notify the room (others)
      io.to(`conversation:${conversationId}`).emit('participant:left', { conversationId, userId: targetUserId });
    } catch (err) {
      console.error('[ConversationService] removeParticipant socket emission failed:', err);
    }

    return { success: true };
  }

  /**
   * Updates conversation metadata (name, description, heroImage, isPublic, isHidden, isPrivate).
   * Requirement: Only admins or the creator can update.
   */
  static async updateConversation(conversationId: string, requesterId: string, data: { name?: string; description?: string; heroImage?: string; isPublic?: boolean; isHidden?: boolean; isPrivate?: boolean }) {
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
