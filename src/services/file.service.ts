import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { s3Client, BUCKET_NAME, region } from '../config/s3';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../utils/validators/file.validator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service layer for file management, uploading to S3, and media processing.
 * Supports direct client uploads via presigned URLs and server-side thumbnail generation.
 */

export class FileService {
  /**
   * Generates a presigned PUT URL for direct client-side upload to S3.
   * Expires in 2 hours (7200 seconds).
   */
  static async generateUploadUrl(fileName: string, contentType: string) {
    const fileKey = `uploads/${uuidv4()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });

    return {
      uploadUrl,
      fileKey,
      publicUrl: `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileKey}`,
    };
  }

  /**
   * Validates file buffer metadata against allowed types and maximum size.
   */
  static validateFile(file: { mimetype: string; size: number }) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const error: any = new Error('Unsupported file type');
      error.statusCode = 400;
      throw error;
    }

    if (file.size > MAX_FILE_SIZE) {
      const error: any = new Error('File size exceeds 25MB limit');
      error.statusCode = 400;
      throw error;
    }

    return true;
  }

  /**
   * Generates a 200x200 thumbnail buffer for images using Sharp.
   */
  static async generateThumbnail(fileBuffer: Buffer) {
    try {
      return await sharp(fileBuffer)
        .resize(200, 200, { fit: 'cover' })
        .toBuffer();
    } catch (error) {
      console.error('[FileService] Thumbnail generation failed:', error);
      return null; // Return null if not an image or processing fails
    }
  }

  /**
   * Uploads a raw buffer to S3 (useful for server-side generated thumbnails or avatars).
   */
  static async uploadFile(buffer: Buffer, fileName: string, contentType: string) {
    const fileKey = `processed/${uuidv4()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    return {
      fileKey,
      publicUrl: `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileKey}`,
    };
  }

  /**
   * Generates a temporary signed URL for viewing a private S3 object.
   * Links expire by default in 3600 seconds (1 hour).
   */
  static async getSignedUrlForRead(fileUrl: string) {
    if (!fileUrl) return null;

    try {
      // 1. Extract the file key from the absolute S3 URL
      // Format: https://bucket.s3.region.amazonaws.com/uploads/guid-name.png
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length < 2) return fileUrl; // Not an S3 URL or already processed

      const fileKey = urlParts[1];

      // 2. Generate the GET command
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });

      // 3. Return the signed URL (expires in 1 hour)
      return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      console.error('[FileService] Signing URL failed:', error);
      return fileUrl; // Fallback to raw URL
    }
  }
}
