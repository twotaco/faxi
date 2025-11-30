import sharp from 'sharp';
import axios from 'axios';
import type { Redis } from 'ioredis';
import crypto from 'crypto';

/**
 * Options for image processing operations
 * 
 * @property maxWidth - Maximum width in pixels (image will be scaled down if larger)
 * @property maxHeight - Maximum height in pixels (image will be scaled down if larger)
 * @property targetDPI - Target DPI for fax transmission (typically 200 DPI)
 * @property format - Output format ('png' or 'jpeg')
 * @property quality - JPEG quality (1-100, default: 80)
 * @property grayscale - Convert to grayscale for better fax transmission (default: true)
 */
export interface ImageProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  targetDPI: number;
  format: 'png' | 'jpeg';
  quality?: number;
  grayscale?: boolean;
}

/**
 * Image Processing Service
 * 
 * Handles downloading, caching, and processing images for fax generation.
 * Implements security measures including domain whitelisting, size limits,
 * and timeout protection.
 * 
 * @example
 * ```typescript
 * import { ImageProcessingService } from './imageProcessingService';
 * import { redis } from '../queue/connection';
 * 
 * const imageService = new ImageProcessingService(redis.getClient());
 * 
 * // Process and cache an image
 * const processedImage = await imageService.processAndCacheImage(
 *   'https://images-na.ssl-images-amazon.com/product.jpg',
 *   {
 *     maxWidth: 400,
 *     maxHeight: 400,
 *     targetDPI: 200,
 *     format: 'png',
 *     grayscale: true
 *   }
 * );
 * 
 * // Check if URL is allowed
 * const isAllowed = imageService.isAllowedImageUrl(imageUrl);
 * ```
 * 
 * @remarks
 * Security features:
 * - Only allows HTTPS URLs from whitelisted domains
 * - 5-second download timeout to prevent hanging
 * - 2MB size limit to prevent memory issues
 * - Content-type validation to ensure actual images
 * - 24-hour Redis cache to reduce redundant downloads
 * 
 * Performance features:
 * - Automatic caching in Redis with 24-hour TTL
 * - Image compression and resizing for optimal fax transmission
 * - Grayscale conversion for better fax quality
 * 
 * @see {@link ImageProcessingOptions} for processing options
 */
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
   * 
   * @param url - HTTPS URL of the image to download (must be from allowed domain)
   * @returns Buffer containing the downloaded image data
   * @throws {Error} If URL is not from allowed domain
   * @throws {Error} If download times out (5 seconds)
   * @throws {Error} If content type is not an image
   * @throws {Error} If image exceeds 2MB size limit
   * 
   * @example
   * ```typescript
   * const imageBuffer = await imageService.downloadImage(
   *   'https://images-na.ssl-images-amazon.com/product.jpg'
   * );
   * ```
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
   * 
   * @param buffer - Buffer containing the original image data
   * @param options - Processing options (size, DPI, format, quality, grayscale)
   * @returns Buffer containing the processed image data
   * @throws {Error} If image processing fails
   * 
   * @remarks
   * - Images are resized to fit within maxWidth/maxHeight while maintaining aspect ratio
   * - Images are not enlarged if already smaller than max dimensions
   * - Grayscale conversion improves fax transmission quality
   * - PNG uses maximum compression (level 9)
   * - JPEG uses configurable quality (default 80)
   * 
   * @example
   * ```typescript
   * const processed = await imageService.resizeImage(imageBuffer, {
   *   maxWidth: 400,
   *   maxHeight: 400,
   *   targetDPI: 200,
   *   format: 'png',
   *   grayscale: true
   * });
   * ```
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
   * 
   * @param url - Original URL of the image (used as cache key)
   * @param buffer - Processed image buffer to cache
   * @returns Promise that resolves when caching is complete
   * 
   * @remarks
   * - Images are cached for 24 hours (86400 seconds)
   * - Cache key is generated from SHA-256 hash of URL
   * - Images are stored as base64-encoded strings
   * - Caching failures are logged but don't throw errors
   * 
   * @example
   * ```typescript
   * await imageService.cacheImage(imageUrl, processedBuffer);
   * ```
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
   * 
   * @param url - Original URL of the image
   * @returns Buffer containing cached image data, or null if not cached
   * 
   * @remarks
   * - Returns null if image is not in cache or cache has expired
   * - Cache retrieval failures are logged but return null instead of throwing
   * 
   * @example
   * ```typescript
   * const cached = await imageService.getCachedImage(imageUrl);
   * if (cached) {
   *   // Use cached image
   * } else {
   *   // Download and process image
   * }
   * ```
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
   * 
   * Checks cache first, downloads and processes if not cached.
   * This is the primary method to use for image processing in fax generation.
   * 
   * @param url - HTTPS URL of the image to process
   * @param options - Processing options (size, DPI, format, quality, grayscale)
   * @returns Buffer containing the processed image data
   * @throws {Error} If URL is not from allowed domain
   * @throws {Error} If download or processing fails
   * 
   * @remarks
   * Workflow:
   * 1. Check Redis cache for previously processed image
   * 2. If cached, return immediately (fast path)
   * 3. If not cached, download from URL
   * 4. Process image (resize, convert, compress)
   * 5. Cache processed image for future use
   * 6. Return processed image
   * 
   * Performance:
   * - Cached images: ~50ms
   * - Fresh downloads: 1-3 seconds
   * - Timeout after 5 seconds
   * 
   * @example
   * ```typescript
   * const processedImage = await imageService.processAndCacheImage(
   *   'https://images-na.ssl-images-amazon.com/product.jpg',
   *   {
   *     maxWidth: 400,
   *     maxHeight: 400,
   *     targetDPI: 200,
   *     format: 'png',
   *     grayscale: true
   *   }
   * );
   * ```
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
   * 
   * @param url - URL to validate
   * @returns true if URL is from an allowed domain and uses HTTPS, false otherwise
   * 
   * @remarks
   * Security checks:
   * - Must use HTTPS protocol (not HTTP)
   * - Hostname must match or be subdomain of allowed domains
   * 
   * Allowed domains:
   * - images-na.ssl-images-amazon.com
   * - m.media-amazon.com
   * - images-fe.ssl-images-amazon.com
   * 
   * @example
   * ```typescript
   * const isAllowed = imageService.isAllowedImageUrl(
   *   'https://images-na.ssl-images-amazon.com/product.jpg'
   * );
   * // Returns: true
   * 
   * const isNotAllowed = imageService.isAllowedImageUrl(
   *   'http://malicious-site.com/image.jpg'
   * );
   * // Returns: false
   * ```
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
