import { Server, Socket } from 'socket.io';
import { MessageService } from '../services/message.service';
import { MessageType } from '@prisma/client';

/**
 * Handlers for real-time chat events.
 * Integrates directly with MessageService to persist data before broadcasting.
 */
export const registerChatHandlers = (io: Server, socket: Socket) => {
  /**
   * Handle sending a new message.
   * Broadcasts to all users in the conversation room.
   */
  socket.on('message:send', async (data: any, callback: Function) => {
    try {
      const senderId = (socket as any).user.userId;
      const message = await MessageService.sendMessage({
        ...data,
        senderId,
      });

      // Broadcast to the conversation room
      io.to(`conversation:${data.conversationId}`).emit('message:new', message);

      // Acknowledge success to the sender
      callback({ status: 'success', data: message });
    } catch (error: any) {
      callback({ status: 'error', message: error.message });
    }
  });

  /**
   * Handle editing an existing message.
   */
  socket.on('message:edit', async (data: any, callback: Function) => {
    try {
      const userId = (socket as any).user.userId;
      const { messageId, content } = data;
      
      const updatedMessage = await MessageService.editMessage(messageId, userId, content);

      // Broadcast the update
      io.to(`conversation:${updatedMessage.conversationId}`).emit('message:updated', updatedMessage);

      callback({ status: 'success', data: updatedMessage });
    } catch (error: any) {
      callback({ status: 'error', message: error.message });
    }
  });

  /**
   * Handle soft deleting a message.
   */
  socket.on('message:delete', async (data: any, callback: Function) => {
    try {
      const userId = (socket as any).user.userId;
      const { messageId } = data;

      const result = await MessageService.deleteMessage(messageId, userId);

      // Broadcast deletion event (we send the ID so frontend can hide/update it)
      // Note: MessageService.deleteMessage doesn't return the full message by default, 
      // but we need the conversationId to broadcast.
      // In a production app, we'd fetch the message first or have the service return it.
      
      // For now, assume the client provides the conversationId for broadcasting
      io.to(`conversation:${data.conversationId}`).emit('message:deleted', { messageId });

      callback({ status: 'success' });
    } catch (error: any) {
      callback({ status: 'error', message: error.message });
    }
  });

  /**
   * Handle toggling a reaction on a message.
   */
  socket.on('message:react', async (data: any, callback: Function) => {
    try {
      const userId = (socket as any).user.userId;
      const { messageId, emoji, conversationId } = data;

      const result = await MessageService.reactToMessage(messageId, userId, emoji);

      // Broadcast reaction update
      io.to(`conversation:${conversationId}`).emit('message:reaction_updated', {
        messageId,
        userId,
        emoji,
        action: result.action,
      });

      callback({ status: 'success', data: result });
    } catch (error: any) {
      callback({ status: 'error', message: error.message });
    }
  });

  /**
   * Handle 'conversation:read' updating read receipts.
   */
  socket.on('conversation:read', async (data: { conversationId: string; lastReadMessageId: string }, callback: Function) => {
    try {
      const userId = (socket as any).user.userId;
      const { conversationId, lastReadMessageId } = data;

      await MessageService.markAsRead(conversationId, userId, lastReadMessageId);

      // Broadcast read receipt to room
      socket.to(`conversation:${conversationId}`).emit('conversation:read', {
        conversationId,
        userId,
        lastReadMessageId,
      });

      if (callback) callback({ status: 'success' });
    } catch (error: any) {
      if (callback) callback({ status: 'error', message: error.message });
    }
  });

  /**
   * Handle toggling a message's pinned status in real-time.
   */
  socket.on('message:pin', async (data: { messageId: string; conversationId: string }, callback: Function) => {
    try {
      const userId = (socket as any).user.userId;
      const { messageId, conversationId } = data;

      const pinnedMessage = await MessageService.togglePin(messageId, userId, conversationId);

      // Broadcast the pinned status update to the conversation room
      io.to(`conversation:${conversationId}`).emit('message:pinned_updated', {
        messageId,
        isPinned: pinnedMessage.isPinned,
      });

      if (callback) callback({ status: 'success', data: pinnedMessage });
    } catch (error: any) {
      if (callback) callback({ status: 'error', message: error.message });
    }
  });
};
