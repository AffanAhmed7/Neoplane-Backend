import { z } from 'zod';

/**
 * Validation schemas for notification management.
 * Supports bulk operations and paginated message discovery.
 */

export const notificationIdsSchema = z.object({
  notificationIds: z.array(z.string().cuid()).min(1, 'At least one notification ID is required'),
});

export const notificationPaginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('20'),
});
