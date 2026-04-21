import prisma from '../utils/prisma';
import { MessageType } from '@prisma/client';

/**
 * Service layer for searching messages, users, and files.
 * Uses Prisma's PostgreSQL full-text search preview feature.
 */

export class SearchService {
  /**
   * Searches messages across all conversations the user belongs to.
   * Strictly enforces participation context and supports type filters.
   */
  static async searchMessages(data: {
    query: string;
    userId: string;
    conversationId?: string;
    type?: MessageType;
    limit: number;
  }) {
    const { query, userId, conversationId, type, limit } = data;

    // Ensure limit is a valid positive integer
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

    // Transform query for PostgreSQL tsvector (simple space-separated words)
    // Prisma's 'search' operator handles basic word matching.
    const searchString = query.trim().split(/\s+/).join(' | ');

    return await prisma.message.findMany({
      where: {
        // Enforce conversation participation
        conversation: {
          participants: {
            some: { userId },
          },
        },
        // Optional conversation filter
        ...(conversationId && { conversationId }),
        // Optional type filter
        ...(type && { type }),
        // Full-text search on content
        content: {
          search: searchString,
        },
        isDeleted: false,
      },
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
        reactions: true,
        _count: {
          select: { replies: true },
        },
      },
    });
  }

  /**
   * Searches for users by username or email.
   * Used for adding participants to conversations or finding contacts.
   */
  static async searchUsers(query: string) {
    return await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
      },
    });
  }

  /**
   * Searches for shared files/media across conversations the user belongs to.
   */
  static async searchFiles(data: { query: string; userId: string; limit: number }) {
    const { query, userId, limit } = data;

    // Ensure limit is a valid positive integer
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

    return await prisma.message.findMany({
      where: {
        conversation: {
          participants: {
            some: { userId },
          },
        },
        type: {
          in: [MessageType.IMAGE, MessageType.FILE],
        },
        OR: [
          { fileName: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
        isDeleted: false,
      },
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true },
        },
      },
    });
  }
}
