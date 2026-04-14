import prisma from '../utils/prisma';
import { hashPassword, comparePasswords } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { Prisma, User } from '@prisma/client';
import admin from '../utils/firebase-admin';

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

    // Generate tokens for auto-login
    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Store refresh token in DB
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
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validates credentials and issues a set of Access + Refresh JWT tokens.
   */
  static async loginUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const error: any = new Error('No account found with this email');
      error.statusCode = 404;
      throw error;
    }

    if (!user.password || !(await comparePasswords(password, user.password))) {
      const error: any = new Error('Incorrect password. Please try again.');
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
   * authenticates a user via Google (Firebase ID Token).
   * Verifies token, upserts user, and returns NeoPlane JWTs.
   */
  static async googleLogin(idToken: string) {
    if (!admin) {
      throw new Error('Firebase Admin is not initialized');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { email, uid, picture } = decodedToken;

      if (!email) {
        const error: any = new Error('Email not provided by Google');
        error.statusCode = 400;
        throw error;
      }

      // 1. Try to find user by firebaseUid
      let user = await prisma.user.findUnique({ where: { firebaseUid: uid } });

      if (!user) {
        // 2. Try to find user by email (account linking)
        user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // Link existing email account to Google
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              firebaseUid: uid,
              provider: 'google',
              avatar: picture || user.avatar,
            },
          });
        } else {
          // Reject new users via Google
          const error: any = new Error('No account found for this Google email. Please register first.');
          error.statusCode = 404;
          throw error;
        }
      }

      // Generate NeoPlane tokens
      const accessToken = generateAccessToken({ userId: user.id });
      const refreshToken = generateRefreshToken({ userId: user.id });

      // Update refresh token and status
      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken,
          status: 'ONLINE',
        },
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
        accessToken,
        refreshToken,
      };
    } catch (err: any) {
      console.error('Google Login Error:', err.message);
      const error: any = new Error(err.message || 'Invalid Google ID token');
      error.statusCode = 401;
      throw error;
    }
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

  /**
   * Retrieves a user by their ID, excluding sensitive fields.
   */
  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
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
}
