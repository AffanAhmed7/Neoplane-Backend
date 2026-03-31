import { z } from 'zod';
import { MessageType } from '@prisma/client';

/**
 * Validation schemas for searching messages, users, and files.
 * Enforces query length and optional filters for context searching.
 */

export const messageSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  conversationId: z.string().cuid().optional(),
  type: z.nativeEnum(MessageType).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('20'),
});

export const userSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

export const fileSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('20'),
});
