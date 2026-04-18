import { z } from 'zod';

/**
 * Validation schemas for file management.
 * Enforces strict MIME types and size limits for media uploads.
 */

export const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-zip-compressed', 'text/plain', 'video/mp4', 'video/quicktime'
];
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'FileName is required'),
  contentType: z.enum(ALLOWED_MIME_TYPES as [string, ...string[]]),
});

export const fileDownloadSchema = z.object({
  fileId: z.string().cuid(),
});
