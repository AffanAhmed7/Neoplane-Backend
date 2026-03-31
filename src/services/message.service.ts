import prisma from '../utils/prisma';
import { MessageType } from '@prisma/client';
import { NotificationService } from './notification.service';

/**
 * Service layer for managing messages, threads, and reactions.
 */
export class MessageService {
  /**
   * Sends a new message in a conversation.
   * Supports threading via parentId and validates participant status.
   */
  static async sendMessage(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type: MessageType;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    parentId?: string;
  }) {
    const { conversationId, senderId, ...rest } = data;

    // 1. Verify the sender is a participant of the conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: { userId: senderId, conversationId },
      },
    });

    if (!participant) {
      const error: any = new Error('User is not a participant in this conversation');
      error.statusCode = 403;
      throw error;
    }

    // 2. If parentId exists, verify it belongs to the same conversation
    if (rest.parentId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: rest.parentId },
      });

      if (!parentMessage || parentMessage.conversationId !== conversationId) {
        const error: any = new Error('Parent message not found in this conversation');
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Create the message and update conversation 'updatedAt' for sorting
    const message = await prisma.$transaction(async (tx) => {
      const newMessage = await tx.message.create({
        data: {
          conversationId,
          senderId,
          ...rest,
        },
        include: {
          sender: {
            select: { id: true, username: true, avatar: true },
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return newMessage;
    });

    // 4. Trigger Notifications for @mentions
    if (message.content && message.type === MessageType.TEXT) {
      const mentions = message.content.match(/@(\w+)/g);
      if (mentions) {
        const usernames = mentions.map((m) => m.substring(1));
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: usernames } },
          select: { id: true },
        });

        for (const mentionedUser of mentionedUsers) {
          // Avoid notifying self
          if (mentionedUser.id !== senderId) {
            await NotificationService.createNotification({
              userId: mentionedUser.id,
              type: 'mention',
              entityId: message.id,
              senderId,
              conversationId,
            });
          }
        }
      }
    }

    return message;
  }

  /**
   * Retrieves messages for a conversation with cursor-based pagination.
   */
  static async getMessages(conversationId: string, pagination: { cursor?: string; limit: number }) {
    const { cursor, limit } = pagination;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    return messages;
  }

  /**
   * Edits the content of an existing message.
   * Requirement: Only the original sender can edit.
   */
  static async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message || message.senderId !== userId) {
      const error: any = new Error('Unauthorized to edit this message');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        isEdited: true,
      },
    });
  }

  /**
   * Soft deletes a message.
   * Requirement: Only sender or an admin can delete.
   */
  static async deleteMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({ 
      where: { id: messageId },
      include: { conversation: true }
    });

    if (!message) {
      const error: any = new Error('Message not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if user is sender or conversation admin/creator
    const isSender = message.senderId === userId;
    const isCreator = message.conversation.creatorId === userId;

    if (!isSender && !isCreator) {
      const error: any = new Error('Unauthorized to delete this message');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.message.update({
      where: { id: messageId },
      data: {
        content: null,
        fileUrl: null,
        isDeleted: true,
      },
    });
  }

  /**
   * Toggles a reaction on a message for a user.
   */
  static async reactToMessage(messageId: string, userId: string, emoji: string) {
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        userId_messageId_emoji: { userId, messageId, emoji },
      },
    });

    if (existingReaction) {
      await prisma.messageReaction.delete({
        where: { id: existingReaction.id },
      });
      return { action: 'removed' };
    } else {
      const reaction = await prisma.messageReaction.create({
        data: { userId, messageId, emoji },
        include: { message: true },
      });

      // Notify message author of reaction
      if (reaction.message.senderId !== userId) {
        await NotificationService.createNotification({
          userId: reaction.message.senderId,
          type: 'reaction',
          entityId: messageId,
          senderId: userId,
          conversationId: reaction.message.conversationId,
        });
      }

      return { action: 'added' };
    }
  }

  /**
   * Updates the read receipt for a user in a conversation.
   */
  static async markAsRead(conversationId: string, userId: string, lastReadMessageId: string) {
    return await prisma.messageRead.upsert({
      where: {
        userId_conversationId: { userId, conversationId },
      },
      update: {
        lastReadMessageId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        conversationId,
        lastReadMessageId,
      },
    });
  }
}
