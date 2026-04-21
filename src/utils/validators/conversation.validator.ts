import { z } from 'zod';
import { ConversationType, ParticipantRole } from '@prisma/client';

/**
 * Validation schemas for conversation-related endpoints.
 * Ensures strict request body validation, particularly for participant counts.
 */

export const createConversationSchema = z.object({
  name: z.string().optional(),
  type: z.nativeEnum(ConversationType),
  participantIds: z.array(z.string()),
  description: z.string().optional(),
  category: z.string().optional(),
  heroImage: z.string().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
  parentId: z.string().optional(),
}).refine((data) => {
  // Logic for DIRECT: Exactly 2 participants (Self + 1 other)
  // Logic for GROUP/CHANNEL: 0 or more extra participants (Creator added by service)
  if (data.type === ConversationType.DIRECT) {
    return data.participantIds.length === 1;
  }
  return true; // GROUP/CHANNEL can be created with 0 extra participants
}, {
  message: 'DIRECT conversations must have exactly 2 participants.',
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

export const updateRoleSchema = z.object({
  role: z.nativeEnum(ParticipantRole),
});

export const conversationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const participantUserIdParamSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
});

export const resolveRequestSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
});
