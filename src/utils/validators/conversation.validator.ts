import { z } from 'zod';
import { ConversationType } from '@prisma/client';

/**
 * Validation schemas for conversation-related endpoints.
 * Ensures strict request body validation, particularly for participant counts.
 */

export const createConversationSchema = z.object({
  name: z.string().optional(),
  type: z.nativeEnum(ConversationType),
  participantIds: z.array(z.string()).min(1, 'At least one other participant is required'),
}).refine((data) => {
  // Logic for DIRECT: Exactly 2 participants (Self + 1 other)
  // Logic for GROUP/CHANNEL: 2 or more participants (Self + 1 or more)
  if (data.type === ConversationType.DIRECT) {
    return data.participantIds.length === 1; // 1 other + 1 self
  }
  return data.participantIds.length >= 1; // 1 other + 1 self = 2+
}, {
  message: 'DIRECT conversations must have exactly 2 participants, GROUP/CHANNEL must have at least 2.',
  path: ['participantIds'],
});

export const updateConversationSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
});

export const addParticipantSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['MEMBER', 'ADMIN']).default('MEMBER'),
});

export const conversationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const participantUserIdParamSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
});
