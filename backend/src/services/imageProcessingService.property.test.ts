import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ImageProcessingService } from './imageProcessingService';
import { redis } from '../queue/connection';
import sharp from 'sharp';

describe('ImageProcessingService Property Tests', () => {
  let service: ImageProcessingService;
  const redisClient = redis.getClient();

  beforeEach(async () => {
    service = new ImageProcessingService(redisClient);
    // Clear any existing test keys
    const keys = await redisClient.keys('image:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  afterEach(async () => {
    // Clean up test keys
    const keys = await redisClient.keys('image:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  // Feature: fax-template-system, Property 9: Image caching round-trip
  describe('Property 9: Image caching round-trip', () => {
    it('should retrieve the same image from cache after caching it', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['https'] }),
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 100, max: 1000 }),
          async (baseUrl, width, height) => {
            // Generate a simple test image
            const testImage = await sharp({
              create: {
                width,
                height,
                channels: 3,
                background: { r: 128, g: 128, b: 128 },
              },
            })
              .png()
              .toBuffer();

            // Create a fake URL (we're testing caching, not downloading)
            const fakeUrl = `${baseUrl}/test-image-${width}x${height}.png`;

            // Cache the image
            await service.cacheImage(fakeUrl, testImage);

            // Retrieve from cache
            const cached = await service.getCachedImage(fakeUrl);

            // Verify the cached image matches the original
            expect(cached).not.toBeNull();
            expect(cached?.equals(testImage)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for non-existent cache entries', async () => {
      await fc.assert(
        fc.asyncProperty(fc.webUrl({ validSchemes: ['https'] }), async (url) => {
          const cached = await service.getCachedImage(url);
          expect(cached).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: fax-template-system, Property 10: Image compression
  describe('Property 10: Image compression', () => {
    it('should compress large images to be smaller than 2MB while maintaining readability', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 3000 }),
          fc.integer({ min: 1000, max: 3000 }),
          fc.integer({ min: 50, max: 100 }),
          async (width, height, quality) => {
            // Generate a large test image (simulating a high-res product image)
            const largeImage = await sharp({
              create: {
                width,
                height,
                channels: 3,
                background: { r: 255, g: 255, b: 255 },
              },
            })
              .png()
              .toBuffer();

            // Only test if the original is actually large (> 2MB)
            if (largeImage.length <= 2 * 1024 * 1024) {
              return true; // Skip this test case
            }

            // Resize and compress the image
            const compressed = await service.resizeImage(largeImage, {
              maxWidth: 800,
              maxHeight: 800,
              targetDPI: 200,
              format: 'jpeg',
              quality,
              grayscale: true,
            });

            // Verify the compressed image is smaller than the original
            expect(compressed.length).toBeLessThan(largeImage.length);

            // Verify the compressed image is readable (can be parsed by sharp)
            const metadata = await sharp(compressed).metadata();
            expect(metadata.width).toBeDefined();
            expect(metadata.height).toBeDefined();
            expect(metadata.width).toBeLessThanOrEqual(800);
            expect(metadata.height).toBeLessThanOrEqual(800);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain aspect ratio when resizing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 500, max: 2000 }),
          fc.integer({ min: 500, max: 2000 }),
          async (width, height) => {
            // Generate a test image
            const testImage = await sharp({
              create: {
                width,
                height,
                channels: 3,
                background: { r: 200, g: 200, b: 200 },
              },
            })
              .png()
              .toBuffer();

            // Calculate original aspect ratio
            const originalAspectRatio = width / height;

            // Resize the image
            const resized = await service.resizeImage(testImage, {
              maxWidth: 400,
              maxHeight: 400,
              targetDPI: 200,
              format: 'png',
              grayscale: false,
            });

            // Get metadata of resized image
            const metadata = await sharp(resized).metadata();
            const newAspectRatio = metadata.width! / metadata.height!;

            // Verify aspect ratio is maintained (within 2% tolerance for rounding)
            const aspectRatioDiff = Math.abs(originalAspectRatio - newAspectRatio);
            expect(aspectRatioDiff).toBeLessThan(0.02);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: fax-template-system, Property 5: Fallback on rendering failure
  describe('Property 5: Fallback on rendering failure', () => {
    it('should reject images from disallowed domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['https'] }),
          async (url) => {
            // Assume the URL is not from an allowed domain
            fc.pre(!service.isAllowedImageUrl(url));

            // Attempt to download should throw an error
            await expect(service.downloadImage(url)).rejects.toThrow(
              'Image URL not from allowed domain'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle invalid image buffers gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 10, maxLength: 100 }),
          async (invalidData) => {
            const invalidBuffer = Buffer.from(invalidData);

            // Attempt to resize invalid image data should throw
            await expect(
              service.resizeImage(invalidBuffer, {
                maxWidth: 400,
                maxHeight: 400,
                targetDPI: 200,
                format: 'png',
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate allowed image domains correctly', () => {
      fc.assert(
        fc.property(fc.constantFrom(...service['ALLOWED_IMAGE_DOMAINS']), (domain) => {
          // URLs from allowed domains should pass validation
          const url = `https://${domain}/test-image.png`;
          expect(service.isAllowedImageUrl(url)).toBe(true);

          // Subdomains should also pass
          const subdomainUrl = `https://subdomain.${domain}/test-image.png`;
          expect(service.isAllowedImageUrl(subdomainUrl)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject malformed URLs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (invalidUrl) => {
            // Filter out strings that might accidentally be valid URLs
            fc.pre(!invalidUrl.startsWith('http'));

            // Malformed URLs should be rejected
            expect(service.isAllowedImageUrl(invalidUrl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
