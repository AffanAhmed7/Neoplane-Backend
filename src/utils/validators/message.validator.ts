import { z } from 'zod';
import { MessageType } from '@prisma/client';

/**
 * Validation schemas for messaging endpoints.
 * Ensures strict typing and checks context (TEXT vs FILE/IMAGE).
 */

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid(),
  content: z.string().optional(),
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  parentId: z.string().cuid().optional(),
}).refine((data) => {
  // If TEXT: content is required
  if (data.type === MessageType.TEXT) {
    return !!data.content && data.content.trim().length > 0;
  }
  // If FILE/IMAGE: fileUrl is required
  if (data.type === MessageType.FILE || data.type === MessageType.IMAGE) {
    return !!data.fileUrl;
  }
  return true;
}, {
  message: 'Necessary content or fileUrl missing for the message type.',
  path: ['content', 'fileUrl'],
});

export const updateMessageSchema = z.object({
  content: z.string().min(1, 'Updated content cannot be empty'),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required'),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
});
