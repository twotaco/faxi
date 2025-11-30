import sharp from 'sharp';
import axios from 'axios';
import type { Redis } from 'ioredis';
import crypto from 'crypto';

export interface ImageProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  targetDPI: number;
  format: 'png' | 'jpeg';
  quality?: number;
  grayscale?: boolean;
}

export class ImageProcessingService {
  private redis: Redis;
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours
  private readonly DOWNLOAD_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
  private readonly ALLOWED_IMAGE_DOMAINS = [
    'images-na.ssl-images-amazon.com',
    'm.media-amazon.com',
    'images-fe.ssl-images-amazon.com',
  ];

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Download an image from a URL with timeout and size limits
   */
  async downloadImage(url: string): Promise<Buffer> {
    // Validate URL is from allowed domain
    if (!this.isAllowedImageUrl(url)) {
      throw new Error(`Image URL not from allowed domain: ${url}`);
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.DOWNLOAD_TIMEOUT,
        maxContentLength: this.MAX_IMAGE_SIZE,
        headers: {
          'User-Agent': 'Faxi/1.0 (Fax Bridge Service)',
        },
      });

      // Validate content type
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Image download timeout after ${this.DOWNLOAD_TIMEOUT}ms: ${url}`);
      }
      throw new Error(`Failed to download image from ${url}: ${error.message}`);
    }
  }

  /**
   * Resize and process an image according to options
   */
  async resizeImage(buffer: Buffer, options: ImageProcessingOptions): Promise<Buffer> {
    const { maxWidth, maxHeight, targetDPI, format, quality = 80, grayscale = true } = options;

    try {
      let pipeline = sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .withMetadata({ density: targetDPI });

      if (grayscale) {
        pipeline = pipeline.grayscale();
      }

      if (format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality });
      } else {
        pipeline = pipeline.png({ compressionLevel: 9 });
      }

      return await pipeline.toBuffer();
    } catch (error: any) {
      throw new Error(`Failed to resize image: ${error.message}`);
    }
  }

  /**
   * Cache an image in Redis
   */
  async cacheImage(url: string, buffer: Buffer): Promise<void> {
    const key = this.getCacheKey(url);
    try {
      await this.redis.setex(key, this.CACHE_TTL, buffer.toString('base64'));
    } catch (error: any) {
      console.error(`Failed to cache image for ${url}:`, error);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Retrieve a cached image from Redis
   */
  async getCachedImage(url: string): Promise<Buffer | null> {
    const key = this.getCacheKey(url);
    try {
      const cached = await this.redis.get(key);
      return cached ? Buffer.from(cached, 'base64') : null;
    } catch (error: any) {
      console.error(`Failed to retrieve cached image for ${url}:`, error);
      return null;
    }
  }

  /**
   * Process and cache an image (orchestration method)
   * Checks cache first, downloads and processes if not cached
   */
  async processAndCacheImage(url: string, options: ImageProcessingOptions): Promise<Buffer> {
    // Check cache first
    const cached = await this.getCachedImage(url);
    if (cached) {
      return cached;
    }

    // Download and process
    const downloaded = await this.downloadImage(url);
    const processed = await this.resizeImage(downloaded, options);

    // Cache for future use
    await this.cacheImage(url, processed);

    return processed;
  }

  /**
   * Validate if a URL is from an allowed domain
   */
  isAllowedImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTPS protocol
      if (parsed.protocol !== 'https:') {
        return false;
      }
      
      return this.ALLOWED_IMAGE_DOMAINS.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate a cache key for a URL
   */
  private getCacheKey(url: string): string {
    const hash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 32);
    return `image:${hash}`;
  }
}
