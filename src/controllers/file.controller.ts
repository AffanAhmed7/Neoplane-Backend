import { Request, Response, NextFunction } from 'express';
import { FileService } from '../services/file.service';

/**
 * Controller for managing file uploads and media metadata.
 * Thin wrapper that delegates to FileService and Multer.
 */

export class FileController {
  /**
   * Generates a 2-hour presigned PUT URL for a secure client-side upload.
   */
  static async getUploadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName, contentType } = req.query as any;

      const result = await FileService.generateUploadUrl(fileName, contentType);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      console.error('[FileController] getUploadUrl FAILED:', error.message, error);
      next(error);
    }
  }

  /**
   * Handles server-side direct uploads (e.g. for small assets or thumbnails).
   * Validates size and type using FileService.
   */
  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;

      if (!file) {
        const error: any = new Error('No file uploaded');
        error.statusCode = 400;
        throw error;
      }

      // 1. Initial manual validation
      FileService.validateFile({ mimetype: file.mimetype, size: file.size });

      // 2. Upload to S3
      const result = await FileService.uploadFile(file.buffer, file.originalname, file.mimetype);

      // 3. Optional: Thumbnail generation for images
      let thumbnail = null;
      if (file.mimetype.startsWith('image/')) {
        const thumbBuffer = await FileService.generateThumbnail(file.buffer);
        if (thumbBuffer) {
          thumbnail = await FileService.uploadFile(thumbBuffer, `thumb-${file.originalname}`, file.mimetype);
        }
      }

      res.status(201).json({
        status: 'success',
        data: {
          ...result,
          thumbnail: thumbnail?.publicUrl,
        },
      });
    } catch (error: any) {
      console.error('[FileController] upload FAILED:', error.message, error);
      next(error);
    }
  }
}
