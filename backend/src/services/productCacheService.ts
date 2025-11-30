/**
 * Product Cache Service
 *
 * Provides PostgreSQL-backed caching for scraped Amazon product data.
 * Uses category-based caching to maximize cache hits across similar queries.
 *
 * Cache TTLs:
 * - Search results: 24 hours
 * - Product details: 24 hours
 *
 * Architecture:
 * - Products are stored by ASIN with category tag
 * - Lookups can be by exact query OR by category
 * - Category lookups enable "shampoo 500ml" to use "shampoo" cache
 */

import { db } from '../database/connection';
import { loggingService } from './loggingService';
import { monitoringService } from './monitoringService';
import type { ScrapedProduct, SearchFilters } from './playwrightScrapingService';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface CacheMetrics {
  hits: number;
  misses: number;
  invalidations: number;
}

// ============================================================================
// Product Cache Service
// ============================================================================

class ProductCacheService {
  private readonly DEFAULT_MAX_AGE_HOURS = 24; // 24 hours for category-based caching
  
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    invalidations: 0
  };

  /**
   * Generate MD5 hash for search query + filters
   */
  private getQueryHash(query: string, filters: SearchFilters): string {
    const filterKey = JSON.stringify({
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      primeOnly: filters.primeOnly,
      minRating: filters.minRating,
      category: filters.category
    });
    
    return crypto
      .createHash('md5')
      .update(query + filterKey)
      .digest('hex');
  }

  /**
   * Get cached search results
   */
  async getCachedSearch(
    query: string,
    filters: SearchFilters = {},
    maxAgeHours: number = this.DEFAULT_MAX_AGE_HOURS
  ): Promise<ScrapedProduct[] | null> {
    try {
      const queryHash = this.getQueryHash(query, filters);
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      // Get most recent search cache entry
      const searchResult = await db.query(
        `SELECT product_asins, scraped_at
         FROM product_search_cache
         WHERE query_hash = $1 AND scraped_at >= $2
         ORDER BY scraped_at DESC
         LIMIT 1`,
        [queryHash, cutoffTime]
      );
      
      if (searchResult.rows.length === 0) {
        this.metrics.misses++;
        this.recordCacheMetric('miss', 'search');
        loggingService.debug('Cache miss for product search', { query, queryHash });
        return null;
      }
      
      const { product_asins } = searchResult.rows[0];
      
      // Get product details for all ASINs
      const products = await db.query(
        `SELECT asin, title, price, currency, prime_eligible, rating, review_count,
                seller, delivery_estimate, image_url, product_url, scraped_at
         FROM product_cache
         WHERE asin = ANY($1) AND scraped_at >= $2
         ORDER BY array_position($1, asin)`,
        [product_asins, cutoffTime]
      );
      
      if (products.rows.length !== product_asins.length) {
        // Some products are missing or expired, return null to trigger fresh scrape
        this.metrics.misses++;
        this.recordCacheMetric('miss', 'search');
        loggingService.debug('Partial cache miss - some products expired', {
          query,
          expected: product_asins.length,
          found: products.rows.length
        });
        return null;
      }
      
      this.metrics.hits++;
      this.recordCacheMetric('hit', 'search');
      loggingService.debug('Cache hit for product search', {
        query,
        queryHash,
        productCount: products.rows.length
      });
      
      return products.rows.map(row => ({
        asin: row.asin,
        productName: row.product_name || '',
        brand: row.brand || '',
        quantity: row.quantity || '',
        description: row.description || '',
        title: row.title,
        price: parseFloat(row.price),
        currency: row.currency,
        primeEligible: row.prime_eligible,
        rating: row.rating ? parseFloat(row.rating) : 0,
        reviewCount: row.review_count || 0,
        seller: row.seller,
        deliveryEstimate: row.delivery_estimate,
        imageUrl: row.image_url,
        productUrl: row.product_url,
        scrapedAt: new Date(row.scraped_at)
      }));
      
    } catch (error) {
      loggingService.error('Failed to get cached search results', error as Error, undefined, { query });
      return null; // Fail gracefully
    }
  }

  /**
   * Cache search results with optional category tagging
   */
  async cacheSearchResults(
    query: string,
    filters: SearchFilters,
    products: ScrapedProduct[],
    category?: string
  ): Promise<void> {
    try {
      const queryHash = this.getQueryHash(query, filters);
      const productAsins = products.map(p => p.asin);
      const scrapedAt = new Date();

      // Cache individual products first (with category tag)
      for (const product of products) {
        await this.cacheProduct(product, category);
      }

      // Cache search results
      await db.query(
        `INSERT INTO product_search_cache
         (query_hash, query_text, filters, product_asins, result_count, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          queryHash,
          query,
          JSON.stringify(filters),
          productAsins,
          products.length,
          scrapedAt
        ]
      );

      loggingService.debug('Cached search results', {
        query,
        queryHash,
        category,
        resultCount: products.length
      });

    } catch (error) {
      loggingService.error('Failed to cache search results', error as Error, undefined, { query });
      // Don't throw - caching failure shouldn't break the search
    }
  }

  /**
   * Get cached product details
   */
  async getCachedProduct(
    asin: string,
    maxAgeHours: number = this.DEFAULT_MAX_AGE_HOURS
  ): Promise<ScrapedProduct | null> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      const result = await db.query(
        `SELECT asin, title, price, currency, prime_eligible, rating, review_count,
                seller, delivery_estimate, image_url, product_url, scraped_at
         FROM product_cache
         WHERE asin = $1 AND scraped_at >= $2
         ORDER BY scraped_at DESC
         LIMIT 1`,
        [asin, cutoffTime]
      );
      
      if (result.rows.length === 0) {
        this.metrics.misses++;
        this.recordCacheMetric('miss', 'product');
        loggingService.debug('Cache miss for product', { asin });
        return null;
      }
      
      this.metrics.hits++;
      this.recordCacheMetric('hit', 'product');
      
      const row = result.rows[0];
      loggingService.debug('Cache hit for product', { asin });

      return {
        asin: row.asin,
        productName: row.product_name || '',
        brand: row.brand || '',
        quantity: row.quantity || '',
        description: row.description || '',
        title: row.title,
        price: parseFloat(row.price),
        currency: row.currency,
        primeEligible: row.prime_eligible,
        rating: row.rating ? parseFloat(row.rating) : 0,
        reviewCount: row.review_count || 0,
        seller: row.seller,
        deliveryEstimate: row.delivery_estimate,
        imageUrl: row.image_url,
        productUrl: row.product_url,
        scrapedAt: new Date(row.scraped_at)
      };

    } catch (error) {
      loggingService.error('Failed to get cached product', error as Error, undefined, { asin });
      return null;
    }
  }

  /**
   * Get cached products by category
   * This is the main method for category-based cache lookups
   */
  async getCachedByCategory(
    category: string,
    minProducts: number = 5,
    maxAgeHours: number = this.DEFAULT_MAX_AGE_HOURS
  ): Promise<ScrapedProduct[] | null> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

      // Get products by category, ordered by rating (best first)
      const result = await db.query(
        `SELECT asin, title, price, currency, prime_eligible, rating, review_count,
                seller, delivery_estimate, image_url, product_url, scraped_at,
                category, product_name, brand, quantity, description
         FROM product_cache
         WHERE category = $1 AND scraped_at >= $2
         ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
         LIMIT 15`,
        [category.toLowerCase(), cutoffTime]
      );

      if (result.rows.length < minProducts) {
        this.metrics.misses++;
        this.recordCacheMetric('miss', 'category');
        loggingService.debug('Category cache miss - insufficient products', {
          category,
          found: result.rows.length,
          required: minProducts
        });
        return null;
      }

      this.metrics.hits++;
      this.recordCacheMetric('hit', 'category');
      loggingService.debug('Category cache hit', {
        category,
        productCount: result.rows.length
      });

      return result.rows.map(row => ({
        asin: row.asin,
        productName: row.product_name || '',
        brand: row.brand || '',
        quantity: row.quantity || '',
        description: row.description || '',
        title: row.title,
        price: parseFloat(row.price),
        currency: 'JPY' as const,
        primeEligible: row.prime_eligible,
        rating: row.rating ? parseFloat(row.rating) : 0,
        reviewCount: row.review_count || 0,
        seller: row.seller,
        deliveryEstimate: row.delivery_estimate,
        imageUrl: row.image_url,
        productUrl: row.product_url,
        scrapedAt: new Date(row.scraped_at)
      }));

    } catch (error) {
      loggingService.error('Failed to get cached products by category', error as Error, undefined, { category });
      return null;
    }
  }

  /**
   * Cache a single product with category and structured fields
   */
  async cacheProduct(product: ScrapedProduct, category?: string): Promise<void> {
    try {
      await db.query(
        `INSERT INTO product_cache
         (asin, title, price, currency, prime_eligible, rating, review_count,
          seller, delivery_estimate, image_url, product_url, scraped_at,
          category, product_name, brand, quantity, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (asin)
         DO UPDATE SET
           title = EXCLUDED.title,
           price = EXCLUDED.price,
           prime_eligible = EXCLUDED.prime_eligible,
           rating = EXCLUDED.rating,
           review_count = EXCLUDED.review_count,
           seller = EXCLUDED.seller,
           delivery_estimate = EXCLUDED.delivery_estimate,
           image_url = EXCLUDED.image_url,
           product_url = EXCLUDED.product_url,
           scraped_at = EXCLUDED.scraped_at,
           category = COALESCE(EXCLUDED.category, product_cache.category),
           product_name = COALESCE(EXCLUDED.product_name, product_cache.product_name),
           brand = COALESCE(EXCLUDED.brand, product_cache.brand),
           quantity = COALESCE(EXCLUDED.quantity, product_cache.quantity),
           description = COALESCE(EXCLUDED.description, product_cache.description),
           updated_at = CURRENT_TIMESTAMP`,
        [
          product.asin,
          product.title,
          product.price,
          product.currency,
          product.primeEligible,
          product.rating,
          product.reviewCount,
          product.seller,
          product.deliveryEstimate,
          product.imageUrl,
          product.productUrl,
          product.scrapedAt,
          category?.toLowerCase() || null,
          product.productName || null,
          product.brand || null,
          product.quantity || null,
          product.description || null
        ]
      );

      loggingService.debug('Cached product', { asin: product.asin, category });

    } catch (error) {
      loggingService.error('Failed to cache product', error as Error, undefined, { asin: product.asin });
    }
  }

  /**
   * Invalidate product cache
   * Deletes cached product data for a specific ASIN
   */
  async invalidateProduct(asin: string): Promise<void> {
    try {
      const result = await db.query(
        `DELETE FROM product_cache WHERE asin = $1`,
        [asin]
      );
      
      if (result.rowCount && result.rowCount > 0) {
        this.metrics.invalidations++;
        this.recordCacheMetric('invalidation', 'product');
        loggingService.info('Invalidated product cache', { asin });
      }
    } catch (error) {
      loggingService.error('Failed to invalidate product cache', error as Error, undefined, { asin });
    }
  }

  /**
   * Clean expired cache entries
   * Removes products and searches older than specified hours
   */
  async cleanExpiredCache(maxAgeHours: number = 24): Promise<number> {
    try {
      const result = await db.query(
        `SELECT clean_expired_product_cache($1)`,
        [maxAgeHours]
      );

      const deletedCount = result.rows[0].clean_expired_product_cache;
      loggingService.info('Cleaned expired cache', { deletedCount, maxAgeHours });

      return deletedCount;
    } catch (error) {
      loggingService.error('Failed to clean expired cache', error as Error);
      return 0;
    }
  }

  /**
   * Clear all product cache (for testing/debugging)
   */
  async clearAllCache(): Promise<{ products: number; searches: number }> {
    try {
      const productResult = await db.query(`DELETE FROM product_cache`);
      const searchResult = await db.query(`DELETE FROM product_search_cache`);

      const counts = {
        products: productResult.rowCount || 0,
        searches: searchResult.rowCount || 0
      };

      loggingService.info('Cleared all product cache', counts);
      return counts;
    } catch (error) {
      loggingService.error('Failed to clear all cache', error as Error);
      return { products: 0, searches: 0 };
    }
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    if (total === 0) return 0;
    return this.metrics.hits / total;
  }

  /**
   * Record cache metric to monitoring service
   */
  private recordCacheMetric(type: 'hit' | 'miss' | 'invalidation', cacheType: 'search' | 'product' | 'category'): void {
    monitoringService.recordMetric('product_cache_operations', 1, {
      type,
      cache_type: cacheType
    });
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0
    };
  }
}

// Export singleton instance
export const productCacheService = new ProductCacheService();
