/**
 * Product Search Service
 * 
 * Integrates with Playwright scraping and aggressive caching to search for products
 * and retrieve product details. Implements filtering, curation, and validation.
 */

import { loggingService } from './loggingService';
import { auditLogService } from './auditLogService';
import { productCacheService } from './productCacheService';
import { playwrightScrapingService, type ScrapedProduct } from './playwrightScrapingService';
import { shoppingMetricsService } from './shoppingMetricsService';
import { categoryExtractorService, type CategoryExtraction, type CategoryRequirements } from './categoryExtractorService';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  primeOnly?: boolean;
  minRating?: number;
  category?: string;
  maxResults?: number;  // Maximum products to scrape (default: 10, max: 20)
}

// Re-export ScrapedProduct for use by other modules
export type { ScrapedProduct };

export interface ProductDetails extends ScrapedProduct {
  features?: string[];
  // Note: brand and description are now part of ScrapedProduct
}

export interface CuratedProduct {
  asin: string;
  title: string; // Truncated to 60 chars
  price: number;
  primeEligible: boolean;
  rating: number;
  deliveryEstimate: string;
  selectionMarker: 'A' | 'B' | 'C' | 'D' | 'E';
  imageUrl: string;
  reasoning: string;
  seller?: string;
}

export interface ProductValidation {
  valid: boolean;
  currentPrice: number | null;
  inStock: boolean;
  message: string;
}

export interface UserPreferences {
  brandPreferences?: string[];
  priceRange?: { min?: number; max?: number };
  urgency?: 'normal' | 'urgent';
}

// Price range categories for diversity
type PriceRange = 'low' | 'mid' | 'premium';

interface PriceRangeThresholds {
  low: { max: number };
  mid: { min: number; max: number };
  premium: { min: number };
}

// ============================================================================
// Product Search Service
// ============================================================================

class ProductSearchService {
  constructor() {
    loggingService.info('Product Search Service initialized with Playwright scraping');
  }



  /**
   * Search Amazon products using category-based caching
   *
   * Flow:
   * 1. Extract category + requirements from user query using LLM
   * 2. Check cache by category (not query hash)
   * 3. If cache has 5+ products for category:
   *    - Filter by requirements (quantity, brand, etc.)
   *    - Return top 3-5 matches
   * 4. Else scrape Amazon:
   *    - Store 10-15 products with category tag
   *    - Filter and return top 3-5
   */
  async searchProducts(
    query: string,
    filters: SearchFilters = {},
    userId?: string
  ): Promise<ScrapedProduct[]> {
    const startTime = Date.now();
    let cacheHit = false;
    let category: string | undefined;

    try {
      // Step 1: Extract category and requirements from query
      const extraction = await categoryExtractorService.extractCategory(query);
      category = extraction.category;

      loggingService.info('Category extracted from query', {
        query,
        category: extraction.category,
        requirements: extraction.requirements,
        confidence: extraction.confidence
      });

      // Step 2: Try category-based cache lookup first (if confidence is high enough)
      if (extraction.confidence >= 0.5 && extraction.category !== 'unknown') {
        const categoryProducts = await productCacheService.getCachedByCategory(
          extraction.category,
          5  // Need at least 5 products in cache
        );

        if (categoryProducts && categoryProducts.length >= 5) {
          cacheHit = true;

          // Filter by user requirements (quantity, brand, etc.)
          let filteredProducts = this.filterByRequirements(
            categoryProducts,
            extraction.requirements
          );

          // Apply price filters from search filters
          filteredProducts = this.applyPriceFilters(filteredProducts, filters);

          // Quality check: If user has no price filter but cached products have low ratings,
          // this suggests cache is from a budget-filtered search - scrape for better quality
          const hasNoPriceFilter = !filters.priceMax && !filters.priceMin;
          const avgRating = filteredProducts.length > 0
            ? filteredProducts.reduce((sum, p) => sum + p.rating, 0) / filteredProducts.length
            : 0;
          const lowQuality = avgRating < 4.0;

          if (hasNoPriceFilter && lowQuality && filteredProducts.length < 10) {
            loggingService.info('Category cache has low-quality products, will scrape for better options', {
              query,
              category: extraction.category,
              avgRating,
              productCount: filteredProducts.length
            });
            // Fall through to scraping
          } else if (filteredProducts.length >= 3) {
            const responseTime = Date.now() - startTime;

            loggingService.info('Returning category-cached results', {
              query,
              category: extraction.category,
              cacheCount: categoryProducts.length,
              filteredCount: filteredProducts.length
            });

            // Record metrics
            await shoppingMetricsService.recordSearchMetric(
              true,
              filteredProducts.length,
              responseTime,
              true,
              query
            );

            // Audit log
            if (userId) {
              await auditLogService.logProductSearch({
                userId,
                query,
                filters,
                resultCount: filteredProducts.length
              });
            }

            return filteredProducts.slice(0, 5);  // Return top 5
          } else {
            // Not enough filtered results - fall through to scraping
            loggingService.info('Category cache insufficient after filtering, will scrape', {
              query,
              category: extraction.category,
              cacheCount: categoryProducts.length,
              filteredCount: filteredProducts.length,
              required: 3
            });
          }
        }
      }

      // Step 3: Fall back to exact query hash cache
      const cachedResults = await productCacheService.getCachedSearch(query, filters);
      if (cachedResults && cachedResults.length > 0) {
        cacheHit = true;
        const responseTime = Date.now() - startTime;

        loggingService.info('Returning hash-cached search results', {
          query,
          resultCount: cachedResults.length
        });

        await shoppingMetricsService.recordSearchMetric(
          true,
          cachedResults.length,
          responseTime,
          true,
          query
        );

        if (userId) {
          await auditLogService.logProductSearch({
            userId,
            query,
            filters,
            resultCount: cachedResults.length
          });
        }

        return cachedResults;
      }

      // Step 4: Cache miss - scrape fresh data
      loggingService.info('Cache miss - scraping fresh data', {
        query,
        category,
        filters
      });

      // Scrape more products for better cache variety (aim for 10-15)
      const products = await playwrightScrapingService.scrapeSearchResults(query, {
        ...filters,
        maxResults: 15  // Get more products for cache variety
      });

      // Apply rating filter
      let filteredProducts = products;
      if (filters.minRating !== undefined && products.length > 0) {
        const ratingFiltered = products.filter(
          p => p.rating !== undefined && p.rating >= filters.minRating!
        );
        if (ratingFiltered.length > 0) {
          filteredProducts = ratingFiltered;
        }
      }

      // Cache all products with category tag for future lookups
      await productCacheService.cacheSearchResults(
        query,
        filters,
        filteredProducts,
        category  // Pass category for cache tagging
      );

      // Audit log
      if (userId) {
        await auditLogService.logProductSearch({
          userId,
          query,
          filters,
          resultCount: filteredProducts.length
        });
      }

      const responseTime = Date.now() - startTime;

      await shoppingMetricsService.recordSearchMetric(
        true,
        filteredProducts.length,
        responseTime,
        cacheHit,
        query
      );

      loggingService.info('Product search completed', {
        query,
        category,
        resultCount: filteredProducts.length,
        responseTime
      });

      // Return top 5 products (cache has all 10-15)
      return filteredProducts.slice(0, 5);

    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      loggingService.error('Product search failed', error as Error, undefined, { query });

      await shoppingMetricsService.recordSearchMetric(
        false,
        0,
        responseTime,
        cacheHit,
        query,
        error.message
      );

      throw new Error(`Product search failed: ${error.message}`);
    }
  }

  /**
   * Search for multiple products in parallel
   * Used for multi-product fax requests like "shampoo and crackers"
   *
   * @param queries Array of product search queries (max 5)
   * @param filters Common filters to apply to all searches
   * @param userId User ID for audit logging
   * @returns Map of query → products
   */
  async searchMultipleProducts(
    queries: string[],
    filters: SearchFilters = {},
    userId?: string
  ): Promise<Map<string, ScrapedProduct[]>> {
    const startTime = Date.now();
    const results = new Map<string, ScrapedProduct[]>();

    // Limit to 5 queries
    const limitedQueries = queries.slice(0, 5);

    if (limitedQueries.length === 0) {
      return results;
    }

    loggingService.info('Starting multi-product search', {
      queryCount: limitedQueries.length,
      queries: limitedQueries
    });

    try {
      // For single query, use the standard search
      if (limitedQueries.length === 1) {
        const products = await this.searchProducts(limitedQueries[0], filters, userId);
        results.set(limitedQueries[0], products);
        return results;
      }

      // Use parallel scraping for multiple queries
      const scrapedResults = await playwrightScrapingService.scrapeMultipleSearches(
        limitedQueries,
        {
          ...filters,
          maxResults: filters.maxResults || 5 // Fewer products per query for multi-search
        }
      );

      // Apply rating filter and cache results for each query
      for (const query of limitedQueries) {
        let products = scrapedResults.get(query) || [];

        // Apply rating filter if specified
        if (filters.minRating !== undefined && products.length > 0) {
          const ratingFiltered = products.filter(
            p => p.rating !== undefined && p.rating >= filters.minRating!
          );
          if (ratingFiltered.length > 0) {
            products = ratingFiltered;
          }
        }

        // Cache each query's results with category extraction
        const extraction = await categoryExtractorService.extractCategory(query);
        if (extraction.category) {
          await productCacheService.cacheSearchResults(
            query,
            filters,
            products,
            extraction.category
          );
        }

        // Store filtered results (limit to 3 per query for multi-search)
        results.set(query, products.slice(0, 3));
      }

      const duration = Date.now() - startTime;
      const totalProducts = Array.from(results.values()).reduce((sum, p) => sum + p.length, 0);

      loggingService.info('Multi-product search completed', {
        queryCount: limitedQueries.length,
        totalProducts,
        durationMs: duration
      });

      // Audit log
      if (userId) {
        await auditLogService.logProductSearch({
          userId,
          query: limitedQueries.join(', '),
          filters,
          resultCount: totalProducts
        });
      }

      return results;

    } catch (error: any) {
      loggingService.error('Multi-product search failed', error as Error, undefined, {
        queries: limitedQueries
      });
      throw new Error(`Multi-product search failed: ${error.message}`);
    }
  }

  /**
   * Apply price and quality filters to products
   */
  private applyPriceFilters(
    products: ScrapedProduct[],
    filters: SearchFilters
  ): ScrapedProduct[] {
    return products.filter(product => {
      // Apply minimum price filter
      if (filters.priceMin !== undefined && product.price < filters.priceMin) {
        return false;
      }

      // Apply maximum price filter
      if (filters.priceMax !== undefined && product.price > filters.priceMax) {
        return false;
      }

      // Apply Prime filter
      if (filters.primeOnly && !product.primeEligible) {
        return false;
      }

      // Apply minimum rating filter
      if (filters.minRating !== undefined && product.rating < filters.minRating) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter products by user requirements (quantity, brand, special needs)
   *
   * Uses string matching to find products that match the specified requirements
   */
  private filterByRequirements(
    products: ScrapedProduct[],
    requirements: CategoryRequirements
  ): ScrapedProduct[] {
    if (!requirements || Object.keys(requirements).length === 0) {
      return products;
    }

    return products.filter(product => {
      let score = 0;
      let requiredMatches = 0;

      // Check quantity requirement
      if (requirements.quantity) {
        requiredMatches++;
        const qty = requirements.quantity.toLowerCase();
        if (
          product.quantity?.toLowerCase().includes(qty) ||
          product.title.toLowerCase().includes(qty) ||
          product.description?.toLowerCase().includes(qty)
        ) {
          score++;
        }
      }

      // Check brand requirement
      if (requirements.brand) {
        requiredMatches++;
        const brand = requirements.brand.toLowerCase();
        if (
          product.brand?.toLowerCase().includes(brand) ||
          product.title.toLowerCase().includes(brand)
        ) {
          score++;
        }
      }

      // Check special requirements (any match counts)
      if (requirements.special && requirements.special.length > 0) {
        requiredMatches++;
        const matchesSpecial = requirements.special.some(special => {
          const s = special.toLowerCase();
          return (
            product.title.toLowerCase().includes(s) ||
            product.description?.toLowerCase().includes(s) ||
            product.productName?.toLowerCase().includes(s)
          );
        });
        if (matchesSpecial) {
          score++;
        }
      }

      // Return products that match at least half the requirements
      // or all products if no requirements were specified
      return requiredMatches === 0 || score >= requiredMatches * 0.5;
    }).sort((a, b) => {
      // Sort by rating (higher first)
      return b.rating - a.rating;
    });
  }

  /**
   * Get detailed product information by ASIN
   * @param forceFresh - If true, bypass cache and scrape fresh data (used before purchase)
   */
  async getProductDetails(
    asin: string,
    userId?: string,
    forceFresh: boolean = false
  ): Promise<ProductDetails> {
    try {
      // Check cache first (unless forceFresh is true)
      if (!forceFresh) {
        const cachedProduct = await productCacheService.getCachedProduct(asin);
        if (cachedProduct) {
          loggingService.info('Returning cached product details', { asin });
          return cachedProduct;
        }
      }

      // Scrape fresh product details
      loggingService.info('Scraping fresh product details', { asin, forceFresh });

      const product = await playwrightScrapingService.scrapeProductDetails(asin);
      
      if (!product) {
        throw new Error('Product not found or failed to scrape');
      }

      // Cache the product details
      await productCacheService.cacheProduct(product);

      loggingService.info('Product details fetched', { asin });

      return product;
      
    } catch (error: any) {
      loggingService.error('Failed to fetch product details', error as Error, undefined, { asin });
      throw new Error(`Failed to fetch product details: ${error.message}`);
    }
  }

  /**
   * Curate products using filtering and LLM-based selection
   * 
   * Applies quality filters and selects 3-5 diverse products with:
   * - Prime eligibility
   * - 3.5+ star rating
   * - Amazon.co.jp seller prioritization
   * - Price range diversity
   * - Truncated titles (60 chars)
   * - Selection markers (A-E)
   */
  async curateProducts(
    products: ScrapedProduct[],
    userQuery: string,
    userPreferences?: UserPreferences
  ): Promise<CuratedProduct[]> {
    try {
      loggingService.info('Curating products', {
        productCount: products.length,
        query: userQuery
      });

      // Step 1: Apply quality filters
      let filteredProducts = this.applyQualityFilters(products);

      if (filteredProducts.length === 0) {
        loggingService.warn('No products passed quality filters', { query: userQuery });
        return [];
      }

      // Step 2: Prioritize Amazon.co.jp sellers
      filteredProducts = this.prioritizeAmazonSellers(filteredProducts);

      // Step 3: Select diverse price range products (3-5 products)
      const selectedProducts = this.selectDiversePriceRange(filteredProducts, userPreferences);

      // Step 4: Truncate titles and assign selection markers
      const curatedProducts = selectedProducts.map((product, index) => {
        const marker = ['A', 'B', 'C', 'D', 'E'][index] as 'A' | 'B' | 'C' | 'D' | 'E';
        
        return {
          asin: product.asin,
          title: this.truncateTitle(product.title, 60),
          price: product.price,
          primeEligible: product.primeEligible,
          rating: product.rating,
          deliveryEstimate: product.deliveryEstimate || this.getDeliveryEstimate(product),
          selectionMarker: marker,
          imageUrl: product.imageUrl,
          seller: product.seller,
          reasoning: this.generateReasoning(product, index, selectedProducts.length)
        };
      });

      loggingService.info('Product curation completed', {
        originalCount: products.length,
        filteredCount: filteredProducts.length,
        curatedCount: curatedProducts.length
      });

      return curatedProducts;
    } catch (error: any) {
      loggingService.error('Product curation failed', error, undefined, { query: userQuery });
      throw new Error(`Product curation failed: ${error.message}`);
    }
  }

  /**
   * Apply quality filters: Prime-eligible and 3.5+ stars
   */
  private applyQualityFilters(products: ScrapedProduct[]): ScrapedProduct[] {
    return products.filter(product => {
      // Must be Prime-eligible
      if (!product.primeEligible) {
        return false;
      }

      // Must have 3.5+ star rating
      if (product.rating < 3.5) {
        return false;
      }

      // Must have a valid price
      if (product.price <= 0) {
        return false;
      }

      return true;
    });
  }

  /**
   * Prioritize products sold by Amazon.co.jp
   * 
   * Products sold by Amazon.co.jp appear first in the list
   */
  private prioritizeAmazonSellers(products: ScrapedProduct[]): ScrapedProduct[] {
    // Sort products: Amazon.co.jp sellers first, then by rating
    return products.sort((a, b) => {
      const aIsAmazon = this.isAmazonSeller(a);
      const bIsAmazon = this.isAmazonSeller(b);

      // Amazon sellers first
      if (aIsAmazon && !bIsAmazon) return -1;
      if (!aIsAmazon && bIsAmazon) return 1;

      // Then by rating (higher first)
      if (a.rating !== b.rating) {
        return b.rating - a.rating;
      }

      // Then by review count (more reviews first)
      return b.reviewCount - a.reviewCount;
    });
  }

  /**
   * Check if product is sold by Amazon.co.jp
   */
  private isAmazonSeller(product: ScrapedProduct): boolean {
    // Check seller field from scraped data
    return product.seller === 'Amazon.co.jp' || 
           product.seller.includes('Amazon') ||
           // Fallback heuristic: Prime + high rating + high review count
           (product.primeEligible && product.rating >= 4.0 && product.reviewCount >= 100);
  }

  /**
   * Select products with diverse price ranges
   * 
   * Ensures representation across low, mid, and premium price points
   * Returns 3-5 products
   */
  private selectDiversePriceRange(
    products: ScrapedProduct[],
    userPreferences?: UserPreferences
  ): ScrapedProduct[] {
    if (products.length === 0) {
      return [];
    }

    // Determine price range thresholds based on the product set
    const prices = products.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Define thresholds (low: bottom 33%, mid: middle 34%, premium: top 33%)
    const thresholds: PriceRangeThresholds = {
      low: { max: minPrice + priceRange * 0.33 },
      mid: { min: minPrice + priceRange * 0.33, max: minPrice + priceRange * 0.67 },
      premium: { min: minPrice + priceRange * 0.67 }
    };

    // Categorize products by price range
    const categorized = {
      low: products.filter(p => p.price <= thresholds.low.max),
      mid: products.filter(p => 
        p.price > thresholds.mid.min && p.price <= thresholds.mid.max
      ),
      premium: products.filter(p => p.price > thresholds.premium.min)
    };

    // Select products ensuring diversity
    const selected: ScrapedProduct[] = [];
    const targetCount = Math.min(5, products.length);

    // Strategy: Pick best from each category, then fill remaining slots
    // Priority: low -> mid -> premium (unless user has price preference)
    const categories: PriceRange[] = ['low', 'mid', 'premium'];
    
    // First pass: Pick one from each category
    for (const category of categories) {
      if (selected.length >= targetCount) break;
      
      const categoryProducts = categorized[category];
      if (categoryProducts.length > 0) {
        // Pick the highest-rated product from this category
        const best = categoryProducts.reduce((prev, curr) => 
          curr.rating > prev.rating ? curr : prev
        );
        selected.push(best);
      }
    }

    // Second pass: Fill remaining slots with highest-rated products
    if (selected.length < targetCount) {
      const remaining = products
        .filter(p => !selected.includes(p))
        .sort((a, b) => b.rating - a.rating);
      
      const slotsToFill = Math.min(targetCount - selected.length, remaining.length);
      selected.push(...remaining.slice(0, slotsToFill));
    }

    // Ensure we have at least 3 products
    const finalCount = Math.max(3, Math.min(5, selected.length));
    return selected.slice(0, finalCount);
  }

  /**
   * Truncate product title to specified length
   */
  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) {
      return title;
    }

    // Truncate at word boundary if possible
    const truncated = title.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      // If we can find a space in the last 20%, use it
      return truncated.substring(0, lastSpace) + '...';
    }

    // Otherwise, hard truncate
    return truncated.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get delivery estimate based on product data
   */
  private getDeliveryEstimate(product: ScrapedProduct): string {
    // Use scraped delivery estimate if available
    if (product.deliveryEstimate) {
      return product.deliveryEstimate;
    }

    // Fallback estimates
    if (product.primeEligible) {
      return '2-3日でお届け'; // 2-3 days delivery
    }

    return '5-7日でお届け'; // 5-7 days delivery
  }

  /**
   * Generate reasoning for why this product was selected
   */
  private generateReasoning(
    product: ScrapedProduct,
    index: number,
    totalCount: number
  ): string {
    const reasons: string[] = [];

    // Rating-based reasoning
    if (product.rating >= 4.5) {
      reasons.push('高評価');
    } else if (product.rating >= 4.0) {
      reasons.push('好評価');
    }

    // Prime eligibility
    if (product.primeEligible) {
      reasons.push('Prime対応');
    }

    // Review count
    if (product.reviewCount >= 1000) {
      reasons.push('多数のレビュー');
    } else if (product.reviewCount >= 100) {
      reasons.push('レビュー多数');
    }

    // Seller
    if (this.isAmazonSeller(product)) {
      reasons.push('Amazon販売');
    }

    // Position-based reasoning
    if (index === 0) {
      reasons.push('おすすめ');
    }

    return reasons.join('、');
  }

  /**
   * Validate product availability and price
   * 
   * This method ALWAYS does a fresh scrape before purchase to ensure accurate data.
   * If the price has changed significantly, it invalidates the cache.
   */
  async validateProduct(asin: string, quotedPrice?: number): Promise<ProductValidation> {
    try {
      // ALWAYS scrape fresh data before purchase (forceFresh = true)
      const product = await this.getProductDetails(asin, undefined, true);

      // Check if price has changed significantly
      if (quotedPrice !== undefined && product.price !== quotedPrice) {
        const priceDifference = Math.abs(product.price - quotedPrice);
        
        // If price changed by more than 50 yen, invalidate cache
        if (priceDifference > 50) {
          loggingService.info('Price changed significantly, invalidating cache', {
            asin,
            quotedPrice,
            currentPrice: product.price,
            difference: priceDifference
          });
          await productCacheService.invalidateProduct(asin);
        }
      }

      // Determine if product is in stock based on delivery estimate
      const inStock = product.deliveryEstimate !== '配送日未定' && 
                      product.deliveryEstimate !== '在庫切れ';

      return {
        valid: inStock && product.price > 0,
        currentPrice: product.price,
        inStock,
        message: product.deliveryEstimate
      };
    } catch (error: any) {
      loggingService.error('Product validation failed', error as Error, undefined, { asin });
      return {
        valid: false,
        currentPrice: null,
        inStock: false,
        message: 'Unable to validate product'
      };
    }
  }

}

// Export singleton instance
export const productSearchService = new ProductSearchService();
