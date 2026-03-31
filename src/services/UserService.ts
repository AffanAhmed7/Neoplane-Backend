import { Prisma, User } from '@prisma/client';
import prisma from '../utils/prisma';

/**
 * Service Layer for User-related business logic.
 * Decouples database operations from controllers.
 */
export class UserService {
  /**
   * Creates a new user in the database.
   * @param data - User creation payload
   */
  static async createUser(data: Prisma.UserCreateInput): Promise<User> {
    try {
      return await prisma.user.create({
        data,
      });
    } catch (error) {
      console.error('[UserService] Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Retrieves a single user by their primary key.
   * @param id - User ID (cuid)
   */
  static async getUserById(id: String): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id: id as string },
      });
    } catch (error) {
      console.error(`[UserService] Failed to fetch user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a single user by their unique email.
   * @param email - User's email address
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      console.error(`[UserService] Failed to fetch user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Updates an existing user's information.
   * @param id - User ID
   * @param data - Fields to update
   */
  static async updateUser(id: String, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      return await prisma.user.update({
        where: { id: id as string },
        data,
      });
    } catch (error) {
      console.error(`[UserService] Failed to update user ${id}:`, error);
      throw error;
    }
  }
}
