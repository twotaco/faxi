import { db } from '../database/connection';
import { createHash } from 'crypto';

export interface Product {
  id: string;
  externalProductId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  availability?: string;
  estimatedDelivery?: string;
  specifications?: any;
  reviewsSummary?: any;
  complementaryProducts?: string[];
  bundleDeals?: any[];
  cachedAt: Date;
  expiresAt: Date;
}

export interface SearchResult {
  id: string;
  queryHash: string;
  queryText: string;
  results: any[];
  cachedAt: Date;
  expiresAt: Date;
}

export interface CreateProductData {
  externalProductId: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  availability?: string;
  estimatedDelivery?: string;
  specifications?: any;
  reviewsSummary?: any;
  complementaryProducts?: string[];
  bundleDeals?: any[];
}

export class ProductCacheRepository {
  /**
   * Find product by external ID
   */
  async findByExternalId(externalProductId: string): Promise<Product | null> {
    const result = await db.query<Product>(
      `SELECT id, external_product_id as "externalProductId", name, description,
              price, currency, image_url as "imageUrl", availability,
              estimated_delivery as "estimatedDelivery", specifications,
              reviews_summary as "reviewsSummary", complementary_products as "complementaryProducts",
              bundle_deals as "bundleDeals", cached_at as "cachedAt", expires_at as "expiresAt"
       FROM product_cache 
       WHERE external_product_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [externalProductId]
    );

    const product = result.rows[0];
    if (product) {
      // Parse JSON fields
      product.specifications = typeof product.specifications === 'string' 
        ? JSON.parse(product.specifications as string) : product.specifications;
      product.reviewsSummary = typeof product.reviewsSummary === 'string' 
        ? JSON.parse(product.reviewsSummary as string) : product.reviewsSummary;
      product.complementaryProducts = typeof product.complementaryProducts === 'string' 
        ? JSON.parse(product.complementaryProducts as string) : product.complementaryProducts;
      product.bundleDeals = typeof product.bundleDeals === 'string' 
        ? JSON.parse(product.bundleDeals as string) : product.bundleDeals;
    }

    return product || null;
  }

  /**
   * Cache product data
   */
  async cache(data: CreateProductData): Promise<Product> {
    const result = await db.query<Product>(
      `INSERT INTO product_cache (
        external_product_id, name, description, price, currency, image_url,
        availability, estimated_delivery, specifications, reviews_summary,
        complementary_products, bundle_deals
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (external_product_id) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         image_url = EXCLUDED.image_url,
         availability = EXCLUDED.availability,
         estimated_delivery = EXCLUDED.estimated_delivery,
         specifications = EXCLUDED.specifications,
         reviews_summary = EXCLUDED.reviews_summary,
         complementary_products = EXCLUDED.complementary_products,
         bundle_deals = EXCLUDED.bundle_deals,
         cached_at = CURRENT_TIMESTAMP,
         expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour'
       RETURNING id, external_product_id as "externalProductId", name, description,
                 price, currency, image_url as "imageUrl", availability,
                 estimated_delivery as "estimatedDelivery", specifications,
                 reviews_summary as "reviewsSummary", complementary_products as "complementaryProducts",
                 bundle_deals as "bundleDeals", cached_at as "cachedAt", expires_at as "expiresAt"`,
      [
        data.externalProductId,
        data.name,
        data.description || null,
        data.price,
        data.currency || 'JPY',
        data.imageUrl || null,
        data.availability || null,
        data.estimatedDelivery || null,
        data.specifications ? JSON.stringify(data.specifications) : null,
        data.reviewsSummary ? JSON.stringify(data.reviewsSummary) : null,
        data.complementaryProducts ? JSON.stringify(data.complementaryProducts) : null,
        data.bundleDeals ? JSON.stringify(data.bundleDeals) : null
      ]
    );

    const product = result.rows[0];
    // Parse JSON fields
    product.specifications = typeof product.specifications === 'string' 
      ? JSON.parse(product.specifications as string) : product.specifications;
    product.reviewsSummary = typeof product.reviewsSummary === 'string' 
      ? JSON.parse(product.reviewsSummary as string) : product.reviewsSummary;
    product.complementaryProducts = typeof product.complementaryProducts === 'string' 
      ? JSON.parse(product.complementaryProducts as string) : product.complementaryProducts;
    product.bundleDeals = typeof product.bundleDeals === 'string' 
      ? JSON.parse(product.bundleDeals as string) : product.bundleDeals;

    return product;
  }

  /**
   * Find multiple products by external IDs
   */
  async findByExternalIds(externalProductIds: string[]): Promise<Product[]> {
    if (externalProductIds.length === 0) {
      return [];
    }

    const placeholders = externalProductIds.map((_, index) => `$${index + 1}`).join(', ');
    
    const result = await db.query<Product>(
      `SELECT id, external_product_id as "externalProductId", name, description,
              price, currency, image_url as "imageUrl", availability,
              estimated_delivery as "estimatedDelivery", specifications,
              reviews_summary as "reviewsSummary", complementary_products as "complementaryProducts",
              bundle_deals as "bundleDeals", cached_at as "cachedAt", expires_at as "expiresAt"
       FROM product_cache 
       WHERE external_product_id IN (${placeholders}) AND expires_at > CURRENT_TIMESTAMP`,
      externalProductIds
    );

    return result.rows.map(product => {
      // Parse JSON fields
      product.specifications = typeof product.specifications === 'string' 
        ? JSON.parse(product.specifications as string) : product.specifications;
      product.reviewsSummary = typeof product.reviewsSummary === 'string' 
        ? JSON.parse(product.reviewsSummary as string) : product.reviewsSummary;
      product.complementaryProducts = typeof product.complementaryProducts === 'string' 
        ? JSON.parse(product.complementaryProducts as string) : product.complementaryProducts;
      product.bundleDeals = typeof product.bundleDeals === 'string' 
        ? JSON.parse(product.bundleDeals as string) : product.bundleDeals;
      return product;
    });
  }

  /**
   * Generate query hash for search caching
   */
  generateQueryHash(query: string, maxResults?: number): string {
    const searchKey = `${query.toLowerCase().trim()}:${maxResults || 5}`;
    return createHash('sha256').update(searchKey).digest('hex');
  }

  /**
   * Find cached search results
   */
  async findSearchResults(queryHash: string): Promise<SearchResult | null> {
    const result = await db.query<SearchResult>(
      `SELECT id, query_hash as "queryHash", query_text as "queryText", results,
              cached_at as "cachedAt", expires_at as "expiresAt"
       FROM search_cache 
       WHERE query_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [queryHash]
    );

    const searchResult = result.rows[0];
    if (searchResult) {
      searchResult.results = typeof searchResult.results === 'string' 
        ? JSON.parse(searchResult.results as string) : searchResult.results;
    }

    return searchResult || null;
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(query: string, results: any[]): Promise<SearchResult> {
    const queryHash = this.generateQueryHash(query);
    
    const result = await db.query<SearchResult>(
      `INSERT INTO search_cache (query_hash, query_text, results)
       VALUES ($1, $2, $3)
       ON CONFLICT (query_hash) 
       DO UPDATE SET 
         query_text = EXCLUDED.query_text,
         results = EXCLUDED.results,
         cached_at = CURRENT_TIMESTAMP,
         expires_at = CURRENT_TIMESTAMP + INTERVAL '30 minutes'
       RETURNING id, query_hash as "queryHash", query_text as "queryText", results,
                 cached_at as "cachedAt", expires_at as "expiresAt"`,
      [queryHash, query, JSON.stringify(results)]
    );

    const searchResult = result.rows[0];
    searchResult.results = typeof searchResult.results === 'string' 
      ? JSON.parse(searchResult.results as string) : searchResult.results;

    return searchResult;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpired(): Promise<{ products: number; searches: number }> {
    const productResult = await db.query(
      `DELETE FROM product_cache WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    
    const searchResult = await db.query(
      `DELETE FROM search_cache WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    
    return {
      products: productResult.rowCount || 0,
      searches: searchResult.rowCount || 0
    };
  }
}

export const productCacheRepository = new ProductCacheRepository();