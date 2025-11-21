import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { Readable } from 'stream';

class S3Storage {
  private client: S3Client;
  private bucket: string;
  private static instance: S3Storage;

  private constructor() {
    this.client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
    this.bucket = config.s3.bucket;
  }

  public static getInstance(): S3Storage {
    if (!S3Storage.instance) {
      S3Storage.instance = new S3Storage();
    }
    return S3Storage.instance;
  }

  /**
   * Upload a file to S3
   */
  public async uploadFile(
    key: string,
    data: Buffer | Readable,
    contentType?: string
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      });

      await this.client.send(command);
      return `s3://${this.bucket}/${key}`;
    } catch (error) {
      console.error('S3 upload error:', { key, error });
      throw error;
    }
  }

  /**
   * Download a file from S3
   */
  public async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      const stream = response.Body as Readable;
      
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      console.error('S3 download error:', { key, error });
      throw error;
    }
  }

  /**
   * Get a presigned URL for temporary access
   */
  public async getPresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error('S3 presigned URL error:', { key, error });
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  public async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  public async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('S3 delete error:', { key, error });
      throw error;
    }
  }

  /**
   * Generate a storage key for fax images
   */
  public generateFaxKey(faxId: string, extension: string = 'tiff'): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `faxes/${year}/${month}/${day}/${faxId}.${extension}`;
  }

  /**
   * Health check for S3 connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: 'health-check',
      });

      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('S3 health check timeout')), 3000);
      });

      await Promise.race([
        this.client.send(command),
        timeoutPromise
      ]);
      return true;
    } catch (error: any) {
      // NotFound is acceptable for health check
      if (error.name === 'NotFound') {
        return true;
      }
      console.error('S3 health check failed:', error.message || error);
      return false;
    }
  }
}

export const s3Storage = S3Storage.getInstance();
