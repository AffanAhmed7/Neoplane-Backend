import { z } from 'zod';

/**
 * Validation schemas for authentication endpoints.
 * Ensures strict request body validation before processing.
 */

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long').max(30, 'Username too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
