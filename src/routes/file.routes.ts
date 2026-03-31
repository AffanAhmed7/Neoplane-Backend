import { Router } from 'express';
import multer from 'multer';
import { FileController } from '../controllers/file.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { uploadUrlSchema } from '../utils/validators/file.validator';

/**
 * Routes for file management and media uploads.
 * Includes direct S3 presigned URL generation and server-side processing.
 */

const router = Router();

// Multer memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 1. Get Presigned Upload URL (Frontend direct upload)
router.get('/upload-url', authMiddleware, validateRequest(uploadUrlSchema), FileController.getUploadUrl);

// 2. Server-side Upload (Optional multipart upload)
router.post('/upload', authMiddleware, upload.single('file'), FileController.upload);

export default router;
