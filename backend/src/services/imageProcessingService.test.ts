import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageProcessingService } from './imageProcessingService';
import { redis } from '../queue/connection';
import axios from 'axios';
import sharp from 'sharp';

// Mock axios for security validation tests
vi.mock('axios');

describe('ImageProcessingService Security Tests', () => {
  let service: ImageProcessingService;
  const redisClient = redis.getClient();

  beforeEach(async () => {
    service = new ImageProcessingService(redisClient);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test keys
    const keys = await redisClient.keys('image:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  describe('URL Domain Whitelist Validation', () => {
    it('should allow images from Amazon domains', () => {
      const allowedUrls = [
        'https://images-na.ssl-images-amazon.com/images/I/test.jpg',
        'https://m.media-amazon.com/images/I/test.jpg',
        'https://images-fe.ssl-images-amazon.com/images/I/test.jpg',
        'https://subdomain.images-na.ssl-images-amazon.com/test.jpg',
      ];

      allowedUrls.forEach((url) => {
        expect(service.isAllowedImageUrl(url)).toBe(true);
      });
    });

    it('should reject images from non-whitelisted domains', () => {
      const disallowedUrls = [
        'https://evil.com/malicious.jpg',
        'https://example.com/image.png',
        'http://localhost:8080/test.jpg',
        'https://not-amazon.com/fake.jpg',
      ];

      disallowedUrls.forEach((url) => {
        expect(service.isAllowedImageUrl(url)).toBe(false);
      });
    });

    it('should reject malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'ftp://images-na.ssl-images-amazon.com/test.jpg',
        '//images-na.ssl-images-amazon.com/test.jpg',
        '',
      ];

      malformedUrls.forEach((url) => {
        expect(service.isAllowedImageUrl(url)).toBe(false);
      });
    });

    it('should reject URLs before attempting download', async () => {
      const disallowedUrl = 'https://evil.com/malicious.jpg';

      await expect(service.downloadImage(disallowedUrl)).rejects.toThrow(
        'Image URL not from allowed domain'
      );

      // Verify axios was never called
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('Content-Type Validation', () => {
    it('should reject non-image content types', async () => {
      const allowedUrl = 'https://images-na.ssl-images-amazon.com/test.jpg';

      // Mock axios to return non-image content
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: Buffer.from('not an image'),
        headers: {
          'content-type': 'text/html',
        },
      });

      await expect(service.downloadImage(allowedUrl)).rejects.toThrow('Invalid content type');
    });

    it('should accept valid image content types', async () => {
      const allowedUrl = 'https://images-na.ssl-images-amazon.com/test.jpg';

      // Create a valid test image
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      // Mock axios to return valid image
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: testImage,
        headers: {
          'content-type': 'image/png',
        },
      });

      const result = await service.downloadImage(allowedUrl);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('Size Limit Validation', () => {
    it('should configure axios with 2MB size limit', async () => {
      const allowedUrl = 'https://images-na.ssl-images-amazon.com/test.jpg';

      // Create a small test image
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      // Mock axios to return valid image
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: testImage,
        headers: {
          'content-type': 'image/png',
        },
      });

      await service.downloadImage(allowedUrl);

      // Verify axios was called with correct size limit
      expect(axios.get).toHaveBeenCalledWith(
        allowedUrl,
        expect.objectContaining({
          maxContentLength: 2 * 1024 * 1024, // 2MB
        })
      );
    });
  });

  describe('Timeout Configuration', () => {
    it('should configure axios with 5-second timeout', async () => {
      const allowedUrl = 'https://images-na.ssl-images-amazon.com/test.jpg';

      // Create a small test image
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      // Mock axios to return valid image
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: testImage,
        headers: {
          'content-type': 'image/png',
        },
      });

      await service.downloadImage(allowedUrl);

      // Verify axios was called with correct timeout
      expect(axios.get).toHaveBeenCalledWith(
        allowedUrl,
        expect.objectContaining({
          timeout: 5000, // 5 seconds
        })
      );
    });

    it('should handle timeout errors gracefully', async () => {
      const allowedUrl = 'https://images-na.ssl-images-amazon.com/test.jpg';

      // Mock axios to simulate timeout
      const timeoutError = new Error('timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      vi.mocked(axios.get).mockRejectedValueOnce(timeoutError);

      await expect(service.downloadImage(allowedUrl)).rejects.toThrow(
        'Image download timeout after 5000ms'
      );
    });
  });
});
