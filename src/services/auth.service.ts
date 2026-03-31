import prisma from '../utils/prisma';
import { hashPassword, comparePasswords } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { Prisma, User } from '@prisma/client';

/**
 * Service layer for authentication business logic.
 * Handles registration, login, token rotation, and secure sessions.
 */
export class AuthService {
  /**
   * Registers a new user with a hashed password.
   */
  static async registerUser(data: { username: string; email: string; password: string }) {
    // Check for duplicate user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      const error: any = new Error('User with this email or username already exists');
      error.statusCode = 409;
      throw error;
    }

    // Hash password and save
    const hashedPassword = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Validates credentials and issues a set of Access + Refresh JWT tokens.
   */
  static async loginUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await comparePasswords(password, user.password))) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Store refresh token in DB for rotation/revocation
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken,
        status: 'ONLINE'
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Exchanges a valid refresh token for a fresh access token.
   */
  static async refreshToken(token: string) {
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });

      if (!user || user.refreshToken !== token) {
        throw new Error(); // Caught below
      }

      const accessToken = generateAccessToken({ userId: user.id });
      return { accessToken };
    } catch {
      const error: any = new Error('Invalid or expired refresh token');
      error.statusCode = 403;
      throw error;
    }
  }

  /**
   * Securely logs out the user by clearing their refresh token.
   */
  static async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        refreshToken: null,
        status: 'OFFLINE'
      },
    });
  }
}
