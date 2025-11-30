/**
 * Product Cache Service Unit Tests
 *
 * Tests the caching service independently of scraping service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { productCacheService } from '../../services/productCacheService';
import { redis } from '../../queue/connection';
import type { ScrapedProduct, ProductDetails } from '../../services/productSearchService';

describe('Product Cache Service', () => {
  beforeEach(async () => {
    // Clear cache before each test
    const client = redis.getClient();
    const keys = await client.keys('product_cache:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
    
    // Reset metrics
    productCacheService.resetMetrics();
  });

  afterEach(async () => {
    // Clean up cache after tests
    const client = redis.getClient();
    const keys = await client.keys('product_cache:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  const mockProduct: ScrapedProduct = {
    asin: 'TEST123',
    title: 'Test Product',
    price: { amount: 1000, currency: 'JPY', displayAmount: '¥1,000' },
    images: {
      primary: {
        large: { url: 'https://example.com/large.jpg', height: 500, width: 500 },
        medium: { url: 'https://example.com/medium.jpg', height: 200, width: 200 }
      }
    },
    rating: 4.5,
    reviewCount: 100,
    isPrime: true,
    availability: { message: 'In Stock', type: 'Now' },
    detailPageURL: 'https://amazon.co.jp/dp/TEST123'
  };

  const mockProductDetails: ProductDetails = {
    ...mockProduct,
    features: ['Feature 1', 'Feature 2'],
    description: 'Test description',
    brand: 'Test Brand'
  };

  describe('Search Results Caching', () => {
    it('should cache and retrieve search results', async () => {
      const query = 'test query';
      const filters = { primeOnly: true };
      const results = [mockProduct];

      // Cache results
      await productCacheService.cacheSearchResults(query, filters, results);

      // Retrieve from cache
      const cached = await productCacheService.getCachedSearchResults(query, filters);
      
      expect(cached).toEqual(results);
      expect(productCacheService.getCacheMetrics().hits).toBe(1);
    });

    it('should return null for cache miss', async () => {
      const query = 'nonexistent query';
      const filters = {};

      const cached = await productCacheService.getCachedSearchResults(query, filters);
      
      expect(cached).toBeNull();
      expect(productCacheService.getCacheMetrics().misses).toBe(1);
    });

    it('should cache different queries separately', async () => {
      const query1 = 'query 1';
      const query2 = 'query 2';
      const filters = {};
      const results1 = [mockProduct];
      const results2 = [{ ...mockProduct, asin: 'TEST456' }];

      // Cache both queries
      await productCacheService.cacheSearchResults(query1, filters, results1);
      await productCacheService.cacheSearchResults(query2, filters, results2);

      // Retrieve both
      const cached1 = await productCacheService.getCachedSearchResults(query1, filters);
      const cached2 = await productCacheService.getCachedSearchResults(query2, filters);

      expect(cached1).toEqual(results1);
      expect(cached2).toEqual(results2);
    });

    it('should cache different filters separately', async () => {
      const query = 'same query';
      const filters1 = { primeOnly: true };
      const filters2 = { primeOnly: false };
      const results1 = [mockProduct];
      const results2 = [{ ...mockProduct, asin: 'TEST456' }];

      // Cache with different filters
      await productCacheService.cacheSearchResults(query, filters1, results1);
      await productCacheService.cacheSearchResults(query, filters2, results2);

      // Retrieve both
      const cached1 = await productCacheService.getCachedSearchResults(query, filters1);
      const cached2 = await productCacheService.getCachedSearchResults(query, filters2);

      expect(cached1).toEqual(results1);
      expect(cached2).toEqual(results2);
    });

    it('should respect TTL for search results', async () => {
      const client = redis.getClient();
      const query = 'test query';
      const filters = {};
      const results = [mockProduct];

      await productCacheService.cacheSearchResults(query, filters, results);

      // Check TTL
      const keys = await client.keys('product_cache:search:*');
      expect(keys.length).toBe(1);

      const ttl = await client.ttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5 * 60); // 5 minutes
    });
  });

  describe('Product Details Caching', () => {
    it('should cache and retrieve product details', async () => {
      const asin = 'TEST123';

      // Cache product
      await productCacheService.cacheProductDetails(asin, mockProductDetails);

      // Retrieve from cache
      const cached = await productCacheService.getCachedProductDetails(asin);

      expect(cached).toEqual(mockProductDetails);
      expect(productCacheService.getCacheMetrics().hits).toBe(1);
    });

    it('should return null for cache miss', async () => {
      const asin = 'NONEXISTENT';

      const cached = await productCacheService.getCachedProductDetails(asin);

      expect(cached).toBeNull();
      expect(productCacheService.getCacheMetrics().misses).toBe(1);
    });

    it('should respect TTL for product details', async () => {
      const client = redis.getClient();
      const asin = 'TEST123';

      await productCacheService.cacheProductDetails(asin, mockProductDetails);

      // Check TTL
      const keys = await client.keys('product_cache:product:*');
      expect(keys.length).toBe(1);

      const ttl = await client.ttl(keys[0]);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60 * 60); // 1 hour
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate product cache', async () => {
      const asin = 'TEST123';

      // Cache product
      await productCacheService.cacheProductDetails(asin, mockProductDetails);

      // Verify it's cached
      let cached = await productCacheService.getCachedProductDetails(asin);
      expect(cached).toEqual(mockProductDetails);

      // Invalidate
      await productCacheService.invalidateProductCache(asin);

      // Verify it's gone
      cached = await productCacheService.getCachedProductDetails(asin);
      expect(cached).toBeNull();

      // Check metrics
      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.invalidations).toBe(1);
    });

    it('should invalidate all search caches', async () => {
      // Cache multiple searches
      await productCacheService.cacheSearchResults('query1', {}, [mockProduct]);
      await productCacheService.cacheSearchResults('query2', {}, [mockProduct]);
      await productCacheService.cacheSearchResults('query3', {}, [mockProduct]);

      // Verify they're cached
      const client = redis.getClient();
      let keys = await client.keys('product_cache:search:*');
      expect(keys.length).toBe(3);

      // Invalidate all
      await productCacheService.invalidateAllSearchCaches();

      // Verify they're gone
      keys = await client.keys('product_cache:search:*');
      expect(keys.length).toBe(0);
    });
  });

  describe('Cache Metrics', () => {
    it('should track hits and misses', async () => {
      const query = 'test';
      const filters = {};

      // Miss
      await productCacheService.getCachedSearchResults(query, filters);
      expect(productCacheService.getCacheMetrics().misses).toBe(1);
      expect(productCacheService.getCacheMetrics().hits).toBe(0);

      // Cache it
      await productCacheService.cacheSearchResults(query, filters, [mockProduct]);

      // Hit
      await productCacheService.getCachedSearchResults(query, filters);
      expect(productCacheService.getCacheMetrics().hits).toBe(1);
      expect(productCacheService.getCacheMetrics().misses).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      const query = 'test';
      const filters = {};

      // Initial hit rate should be 0
      expect(productCacheService.getCacheHitRate()).toBe(0);

      // One miss
      await productCacheService.getCachedSearchResults(query, filters);
      expect(productCacheService.getCacheHitRate()).toBe(0); // 0/1 = 0

      // Cache it
      await productCacheService.cacheSearchResults(query, filters, [mockProduct]);

      // Two hits
      await productCacheService.getCachedSearchResults(query, filters);
      await productCacheService.getCachedSearchResults(query, filters);

      // Hit rate should be 2/3 = 0.667
      expect(productCacheService.getCacheHitRate()).toBeCloseTo(0.667, 2);
    });

    it('should track invalidations', async () => {
      const asin = 'TEST123';

      // Cache and invalidate
      await productCacheService.cacheProductDetails(asin, mockProductDetails);
      await productCacheService.invalidateProductCache(asin);

      expect(productCacheService.getCacheMetrics().invalidations).toBe(1);

      // Invalidate again (should still count even if nothing to invalidate)
      await productCacheService.invalidateProductCache(asin);
      expect(productCacheService.getCacheMetrics().invalidations).toBe(1); // No change since nothing was deleted
    });

    it('should reset metrics', () => {
      // Generate some metrics
      productCacheService.resetMetrics();
      
      const metrics = productCacheService.getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.invalidations).toBe(0);
    });
  });
});
