import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Initialize AWS S3 Client with standard credentials.
 * Used for presigned URLs, direct uploads, and thumbnail generation.
 */

const region = process.env.AWS_REGION || 'us-east-1';

export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'neoplane-uploads';
