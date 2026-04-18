import prisma from '../utils/prisma';
import { hashPassword, comparePasswords } from '../utils/password';

/**
 * Service layer for user profile management.
 */
export class UserService {
  /**
   * Returns a public user profile by ID.
   */
  static async getPublicProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        banner: true,
        status: true,
        lastSeen: true,
        pinnedChannels: true,
        mutedChannels: true,
        mutedUsers: true,
        createdAt: true,
      },
    });

    if (!user) {
      const error: any = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  /**
   * Updates the authenticated user's profile.
   */
  static async updateProfile(
    userId: string,
    data: { username?: string; bio?: string; avatar?: string; banner?: string }
  ) {
    // If username is being changed, check uniqueness
    if (data.username) {
      const existing = await prisma.user.findFirst({
        where: { username: data.username, NOT: { id: userId } },
      });
      if (existing) {
        const error: any = new Error('Username already taken');
        error.statusCode = 409;
        throw error;
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        banner: true,
        status: true,
        pinnedChannels: true,
        mutedChannels: true,
        mutedUsers: true,
      },
    });
  }

  /**
   * Changes the authenticated user's password.
   */
  static async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.password) {
      const error: any = new Error('Password update not supported for this account type');
      error.statusCode = 400;
      throw error;
    }

    const isMatch = await comparePasswords(currentPassword, user.password);
    if (!isMatch) {
      const error: any = new Error('Current password is incorrect');
      error.statusCode = 401;
      throw error;
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return { success: true };
  }

  /**
   * Updates user online status.
   */
  static async updateStatus(userId: string, status: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: { status: status as any, lastSeen: new Date() },
    });
  }

  /**
   * Updates user preferences.
   */
  static async updatePreferences(
    userId: string,
    data: { pinnedChannels?: string[]; mutedChannels?: string[]; mutedUsers?: string[] }
  ) {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        pinnedChannels: true,
        mutedChannels: true,
        mutedUsers: true,
      },
    });
  }
}
