import prisma from '../utils/prisma';
import { FriendRequestStatus } from '@prisma/client';
import { getIO } from '../sockets/index';

/**
 * Service layer for the friend system.
 * Handles friend requests, mutual friend creation, and user blocking.
 */
export class FriendService {
  /**
   * Sends a friend request by searching for the user by username.
   */
  static async sendRequest(senderId: string, targetUsername: string) {
    const receiver = await prisma.user.findFirst({ 
      where: { 
        username: { equals: targetUsername, mode: 'insensitive' } 
      } 
    });

    if (!receiver) {
      const error: any = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (receiver.id === senderId) {
      const error: any = new Error('You cannot send a friend request to yourself');
      error.statusCode = 400;
      throw error;
    }

    // Check if already friends
    const existing = await prisma.friend.findUnique({
      where: { userId_friendId: { userId: senderId, friendId: receiver.id } },
    });
    if (existing) {
      const error: any = new Error('You are already friends with this user');
      error.statusCode = 409;
      throw error;
    }

    // Check if request already sent
    const existingRequest = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId: receiver.id } },
    });
    if (existingRequest) {
      const error: any = new Error('Friend request already sent');
      error.statusCode = 409;
      throw error;
    }

    // Check for incoming request (they already sent us one → auto-accept)
    const incoming = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId: receiver.id, receiverId: senderId } },
    });
    if (incoming) {
      return await this.acceptRequest(senderId, incoming.id);
    }

    const request = await prisma.friendRequest.create({
      data: { senderId, receiverId: receiver.id },
      include: {
        receiver: { select: { id: true, username: true, avatar: true } },
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });

    // Emit real-time notification to the receiver
    try {
      const io = getIO();
      io.to(`user:${receiver.id}`).emit('friend_request:received', request);
    } catch (err) {
      console.error('[FriendService] Socket emission failed:', err);
    }

    return request;
  }

  /**
   * Accepts a pending friend request.
   * Atomically creates two Friend rows (bidirectional).
   */
  static async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });

    if (!request || request.receiverId !== userId) {
      const error: any = new Error('Friend request not found or not authorized');
      error.statusCode = 404;
      throw error;
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      const error: any = new Error('This request has already been handled');
      error.statusCode = 400;
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      // Update request status
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.ACCEPTED },
      });

      // Create bidirectional friend rows
      await tx.friend.createMany({
        data: [
          { userId: request.receiverId, friendId: request.senderId },
          { userId: request.senderId, friendId: request.receiverId },
        ],
        skipDuplicates: true,
      });
    });

    const finalRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: { id: true, username: true, avatar: true, status: true } },
        receiver: { select: { id: true, username: true, avatar: true, status: true } },
      },
    });

    // Emit real-time updates to both parties
    try {
      const io = getIO();
      // Notify the sender that their request was accepted
      io.to(`user:${request.senderId}`).emit('friend_request:accepted', {
        request: finalRequest,
        newFriend: finalRequest?.receiver // The receiver is the person who accepted (the new friend of the sender)
      });
      // Notify the receiver (current user) that they now have a new friend (redundant but helpful for sync)
      io.to(`user:${request.receiverId}`).emit('friend_request:updated', finalRequest);
    } catch (err) {
      console.error('[FriendService] Socket emission failed:', err);
    }

    return finalRequest;
  }

  /**
   * Declines or cancels a friend request.
   */
  static async declineRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });

    if (!request) {
      const error: any = new Error('Friend request not found');
      error.statusCode = 404;
      throw error;
    }

    // Both sender (cancel) and receiver (decline) can delete the request
    if (request.senderId !== userId && request.receiverId !== userId) {
      const error: any = new Error('Not authorized');
      error.statusCode = 403;
      throw error;
    }

    await prisma.friendRequest.delete({ where: { id: requestId } });

    // Emit real-time update to the other party
    try {
      const io = getIO();
      const otherId = request.senderId === userId ? request.receiverId : request.senderId;
      io.to(`user:${otherId}`).emit('friend_request:removed', { requestId });
    } catch (err) {
      console.error('[FriendService] Socket emission failed:', err);
    }

    return { success: true };
  }

  /**
   * Removes a friend (deletes both directions).
   */
  static async removeFriend(userId: string, friendId: string) {
    // 1. Delete bidirectional friend rows
    await prisma.friend.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    // 2. Find and "Hide" the DIRECT DM conversation between these users
    const conversation = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        participants: {
          every: {
            userId: { in: [userId, friendId] }
          }
        }
      },
      include: { participants: true }
    });

    if (conversation) {
      // Mark as hidden for both participants
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: conversation.id,
          userId: { in: [userId, friendId] }
        },
        data: { isHidden: true }
      });
    }

    // 3. Emit real-time update to the other party
    try {
      const io = getIO();
      io.to(`user:${friendId}`).emit('friend:removed', { userId });
      if (conversation) {
        // Emit removed to both users so it vanishes from sidebar
        io.to(`user:${userId}`).emit('conversation:removed', { id: conversation.id });
        io.to(`user:${friendId}`).emit('conversation:removed', { id: conversation.id });
      }
    } catch (err) {
      console.error('[FriendService] Socket emission failed:', err);
    }

    return { success: true };
  }

  /**
   * Lists all friends for a user with their current status.
   */
  static async getFriends(userId: string) {
    const friends = await prisma.friend.findMany({
      where: { userId },
      include: {
        friend: {
          select: { id: true, username: true, avatar: true, status: true, lastSeen: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return friends.map((f) => f.friend);
  }

  /**
   * Lists all pending friend requests (incoming and outgoing).
   */
  static async getRequests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: userId, status: FriendRequestStatus.PENDING },
        include: {
          sender: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId, status: FriendRequestStatus.PENDING },
        include: {
          receiver: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { incoming, outgoing };
  }

  /**
   * Checks if two users are friends.
   */
  static async areFriends(userId: string, friendId: string): Promise<boolean> {
    const friend = await prisma.friend.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    return !!friend;
  }
}
