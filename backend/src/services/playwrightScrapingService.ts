/**
 * Playwright Scraping Service
 * 
 * Handles all Playwright-based scraping of Amazon.co.jp for product search and details.
 * Implements anti-detection measures and robust error handling.
 */

import { chromium, Browser, Page, ElementHandle } from 'playwright';
import { getScrapingConfig, AMAZON_SELECTORS, getRandomDelay } from '../config/playwrightConfig';
import { scrapingRateLimitService } from './scrapingRateLimitService';
import { loggingService } from './loggingService';
import { db } from '../database/connection';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

export interface ScrapedProduct {
  asin: string;
  productName: string;     // Short product name without brand
  brand: string;           // Manufacturer/brand name
  quantity: string;        // Size/amount (e.g., "300mL", "2個セット")
  description: string;     // Brief description for order form
  title: string;           // Raw Amazon title for reference
  price: number;
  currency: 'JPY';
  primeEligible: boolean;
  rating: number;
  reviewCount: number;
  seller: string;
  deliveryEstimate: string;
  imageUrl: string;
  productUrl: string;
  scrapedAt: Date;
}

export interface SearchFilters {
  priceMin?: number;
  priceMax?: number;
  primeOnly?: boolean;
  minRating?: number;
  category?: string;
  maxResults?: number;  // Maximum products to scrape (default: 10, max: 20)
}

export class PlaywrightScrapingService {
  private browser: Browser | null = null;
  private config = getScrapingConfig();
  private logger = loggingService;
  private genAI: GoogleGenerativeAI;
  private extractionModel: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    // Use gemini-2.5-flash-lite for fast extraction
    this.extractionModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
  }
  
  /**
   * Initialize browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.info('Launching Chromium browser', {
        headless: this.config.headless
      });
      
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox'
        ]
      });
    }
    
    return this.browser;
  }
  
  /**
   * Create a new page with realistic configuration
   */
  private async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: this.config.userAgent,
      viewport: this.config.viewport,
      locale: this.config.locale,
      timezoneId: this.config.timezone,
      // Additional anti-detection measures
      extraHTTPHeaders: {
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    const page = await context.newPage();
    
    // Remove webdriver flag
    await page.addInitScript(() => {
      // @ts-ignore - accessing window in browser context
      Object.defineProperty(window.navigator, 'webdriver', {
        get: () => false
      });
    });
    
    return page;
  }
  
  /**
   * Scrape Amazon search results
   */
  async scrapeSearchResults(
    query: string,
    filters: SearchFilters = {}
  ): Promise<ScrapedProduct[]> {
    const startTime = Date.now();
    let page: Page | null = null;
    
    try {
      // Wait for rate limit
      await scrapingRateLimitService.waitForRateLimit();
      
      // Record this search
      await scrapingRateLimitService.recordSearch();
      
      this.logger.info('Starting product search scrape', { query, filters });
      
      page = await this.createPage();
      
      // Build search URL
      const searchUrl = this.buildSearchUrl(query, filters);
      
      // Navigate to search results
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Random delay to appear human
      await this.randomDelay();
      
      // Wait for product cards to load
      await page.waitForSelector(AMAZON_SELECTORS.productCard, { timeout: 10000 });
      
      // Get all product cards
      const productCards = await page.$$(AMAZON_SELECTORS.productCard);
      
      this.logger.info('Found product cards', { count: productCards.length });
      
      // Parse products (configurable, default 10, max 20)
      const products: ScrapedProduct[] = [];
      const requestedMax = Math.min(filters.maxResults || 10, 20);
      const maxProducts = Math.min(productCards.length, requestedMax);
      
      for (let i = 0; i < maxProducts; i++) {
        try {
          const product = await this.parseProductCard(productCards[i], page);
          if (product) {
            products.push(product);
          }
        } catch (error) {
          this.logger.warn('Failed to parse product card', { index: i, error });
        }
      }
      
      const duration = Date.now() - startTime;
      
      // Record metrics
      await this.recordMetric('search', true, duration, { query, resultCount: products.length });
      
      this.logger.info('Search scrape completed', {
        query,
        productsFound: products.length,
        durationMs: duration
      });
      
      return products;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordMetric('search', false, duration, { query, error: String(error) });
      
      this.logger.error('Search scrape failed', error as Error, undefined, { query });
      throw error;
      
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Scrape multiple search queries in parallel using page pooling
   * This is more efficient than sequential searches for multi-product requests
   * @param queries Array of product search queries (max 5)
   * @param filters Common filters to apply to all searches
   * @returns Map of query → scraped products
   */
  async scrapeMultipleSearches(
    queries: string[],
    filters: SearchFilters = {}
  ): Promise<Map<string, ScrapedProduct[]>> {
    const startTime = Date.now();
    const results = new Map<string, ScrapedProduct[]>();

    // Limit to 5 queries max for safety
    const limitedQueries = queries.slice(0, 5);

    if (limitedQueries.length === 0) {
      return results;
    }

    // For single query, just use the regular method
    if (limitedQueries.length === 1) {
      const products = await this.scrapeSearchResults(limitedQueries[0], filters);
      results.set(limitedQueries[0], products);
      return results;
    }

    this.logger.info('Starting parallel product searches', {
      queryCount: limitedQueries.length,
      queries: limitedQueries
    });

    // Wait for rate limit (single check for entire batch)
    await scrapingRateLimitService.waitForRateLimit();

    // Record this as a batch search
    await scrapingRateLimitService.recordSearch();

    // Create page pool - one page per query
    const pages: Page[] = [];
    try {
      // Create all pages in parallel
      const pagePromises = limitedQueries.map(() => this.createPage());
      const createdPages = await Promise.all(pagePromises);
      pages.push(...createdPages);

      // Execute all searches in parallel
      const searchPromises = limitedQueries.map(async (query, index) => {
        const page = pages[index];
        try {
          const products = await this.scrapeWithPage(page, query, filters);
          return { query, products, success: true };
        } catch (error) {
          this.logger.warn('Parallel search failed for query', { query, error: String(error) });
          return { query, products: [], success: false };
        }
      });

      const searchResults = await Promise.all(searchPromises);

      // Build results map
      for (const result of searchResults) {
        results.set(result.query, result.products);
      }

      const duration = Date.now() - startTime;
      const totalProducts = Array.from(results.values()).reduce((sum, p) => sum + p.length, 0);

      // Record batch metric
      await this.recordMetric('batch_search', true, duration, {
        queryCount: limitedQueries.length,
        totalProducts,
        queries: limitedQueries
      });

      this.logger.info('Parallel searches completed', {
        queryCount: limitedQueries.length,
        totalProducts,
        durationMs: duration
      });

      return results;

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordMetric('batch_search', false, duration, {
        queryCount: limitedQueries.length,
        error: String(error)
      });

      this.logger.error('Parallel searches failed', error as Error);
      throw error;

    } finally {
      // Close all pages in the pool
      await Promise.all(pages.map(page => page.close().catch(() => {})));
    }
  }

  /**
   * Execute a search on a pre-created page (used for parallel searches)
   */
  private async scrapeWithPage(
    page: Page,
    query: string,
    filters: SearchFilters
  ): Promise<ScrapedProduct[]> {
    const searchUrl = this.buildSearchUrl(query, filters);

    // Navigate to search results
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Random delay to appear human
    await this.randomDelay();

    // Wait for product cards to load
    await page.waitForSelector(AMAZON_SELECTORS.productCard, { timeout: 10000 });

    // Get all product cards
    const productCards = await page.$$(AMAZON_SELECTORS.productCard);

    this.logger.info('Found product cards for query', { query, count: productCards.length });

    // Parse products (limited to 5 per query for multi-search to save space on fax)
    const products: ScrapedProduct[] = [];
    const maxProducts = Math.min(productCards.length, filters.maxResults || 5);

    for (let i = 0; i < maxProducts; i++) {
      try {
        const product = await this.parseProductCard(productCards[i], page);
        if (product) {
          products.push(product);
        }
      } catch (error) {
        this.logger.warn('Failed to parse product card in parallel search', { query, index: i, error });
      }
    }

    return products;
  }

  /**
   * Parse a single product card element using Gemini LLM for robust extraction
   */
  private async parseProductCard(
    card: ElementHandle,
    page: Page
  ): Promise<ScrapedProduct | null> {
    try {
      // Extract ASIN from data attribute (this is reliable)
      const asin = await card.getAttribute('data-asin');
      if (!asin) {
        return null;
      }

      // Extract price using CSS selector FIRST (this works reliably)
      // Amazon hides price in .a-offscreen for screen readers - LLM can't see it
      const priceElement = await card.$(AMAZON_SELECTORS.price);
      const priceText = priceElement ? (await priceElement.textContent()) || '' : '';
      const extractedPrice = this.parsePrice(priceText);

      // Get raw HTML of the product card
      const rawHtml = await card.evaluate((el) => el.outerHTML);

      // Use Gemini to extract product data from HTML (price already extracted via CSS)
      const extractedData = await this.extractProductDataWithLLM(rawHtml, asin);

      if (!extractedData) {
        this.logger.warn('LLM extraction failed, falling back to selectors', { asin });
        return this.parseProductCardWithSelectors(card, asin);
      }

      return {
        asin,
        productName: extractedData.productName || '',
        brand: extractedData.brand || '',
        quantity: extractedData.quantity || '',
        description: extractedData.description || '',
        title: extractedData.title || '',
        price: extractedPrice,  // Use CSS-extracted price, not LLM
        currency: 'JPY',
        primeEligible: extractedData.primeEligible || false,
        rating: extractedData.rating || 0,
        reviewCount: extractedData.reviewCount || 0,
        seller: extractedData.seller || 'Unknown',
        deliveryEstimate: extractedData.deliveryEstimate || '',
        imageUrl: extractedData.imageUrl || '',
        productUrl: `https://www.amazon.co.jp/dp/${asin}`,
        scrapedAt: new Date()
      };

    } catch (error) {
      this.logger.warn('Failed to parse product card', { error });
      return null;
    }
  }

  /**
   * Use Gemini LLM to extract product data from raw HTML
   * Note: Price is extracted via CSS selector separately (LLM can't see .a-offscreen elements)
   */
  private async extractProductDataWithLLM(
    html: string,
    asin: string
  ): Promise<{
    productName: string;
    brand: string;
    quantity: string;
    description: string;
    title: string;
    primeEligible: boolean;
    rating: number;
    reviewCount: number;
    seller: string;
    deliveryEstimate: string;
    imageUrl: string;
  } | null> {
    try {
      // Note: Price is NOT extracted here - it's extracted via CSS selector in parseProductCard
      // Amazon hides price in .a-offscreen elements which the LLM cannot see
      const prompt = `Extract product information from this Amazon Japan product card HTML.

HTML:
${html.substring(0, 8000)}

Extract these fields as JSON:
- productName: Short product name without brand (e.g., "薬用シャンプー" not the full Amazon title)
- brand: The manufacturer/brand name (e.g., "加美乃素", "花王", "P&G")
- quantity: Size/amount (e.g., "300mL", "2個セット", "480ml")
- title: The full Amazon product title as-is
- primeEligible: true if Prime badge/logo visible, false otherwise
- rating: Star rating 1-5 (e.g., 4.3)
- reviewCount: Number of reviews as integer
- seller: The seller name if visible
- deliveryEstimate: Delivery time estimate if shown
- imageUrl: The product image URL
- description: A brief 1-2 sentence description suitable for an order form (~30-50 words max in Japanese)

Return ONLY valid JSON, no markdown or explanation:`;

      const result = await this.extractionModel.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response
      const extracted = JSON.parse(responseText);

      this.logger.debug('LLM extracted product data', {
        asin,
        productName: extracted.productName?.substring(0, 30),
        brand: extracted.brand
      });

      return {
        productName: extracted.productName || '',
        brand: extracted.brand || '',
        quantity: extracted.quantity || '',
        description: extracted.description || '',
        title: extracted.title || '',
        primeEligible: Boolean(extracted.primeEligible),
        rating: typeof extracted.rating === 'number' ? extracted.rating : parseFloat(extracted.rating) || 0,
        reviewCount: typeof extracted.reviewCount === 'number' ? extracted.reviewCount : parseInt(extracted.reviewCount) || 0,
        seller: extracted.seller || 'Unknown',
        deliveryEstimate: extracted.deliveryEstimate || '',
        imageUrl: extracted.imageUrl || ''
      };

    } catch (error) {
      this.logger.warn('LLM extraction error', { asin, error: String(error) });
      return null;
    }
  }

  /**
   * Fallback: Parse product card using CSS selectors (original method)
   */
  private async parseProductCardWithSelectors(
    card: ElementHandle,
    asin: string
  ): Promise<ScrapedProduct | null> {
    try {
      // Extract title
      const titleElement = await card.$(AMAZON_SELECTORS.title);
      const title = titleElement ? (await titleElement.textContent()) || '' : '';

      // Extract price
      const priceElement = await card.$(AMAZON_SELECTORS.price);
      const priceText = priceElement ? (await priceElement.textContent()) || '' : '';
      const price = this.parsePrice(priceText);

      // Check Prime eligibility
      const primeBadge = await card.$(AMAZON_SELECTORS.primeBadge);
      const primeEligible = primeBadge !== null;

      // Extract rating
      const ratingElement = await card.$(AMAZON_SELECTORS.rating);
      const ratingText = ratingElement ? (await ratingElement.getAttribute('textContent')) || '' : '';
      const rating = this.parseRating(ratingText);

      // Extract review count
      const reviewElement = await card.$(AMAZON_SELECTORS.reviewCount);
      const reviewText = reviewElement ? (await reviewElement.textContent()) || '' : '';
      const reviewCount = this.parseReviewCount(reviewText);

      // Extract seller (if available)
      const sellerElement = await card.$(AMAZON_SELECTORS.seller);
      const sellerText = sellerElement ? (await sellerElement.textContent()) || '' : '';
      const seller = this.parseSeller(sellerText);

      // Extract delivery estimate
      const deliveryElement = await card.$(AMAZON_SELECTORS.deliveryText);
      const deliveryEstimate = deliveryElement ? (await deliveryElement.textContent()) || '' : '';

      // Extract image URL
      const imageElement = await card.$(AMAZON_SELECTORS.image);
      const imageUrl = imageElement ? (await imageElement.getAttribute('src')) || '' : '';

      return {
        asin,
        productName: '',  // Not available in selector fallback
        brand: '',        // Not available in selector fallback
        quantity: '',     // Not available in selector fallback
        description: '',  // Not available in selector fallback
        title: title?.trim() || '',
        price,
        currency: 'JPY',
        primeEligible,
        rating,
        reviewCount,
        seller,
        deliveryEstimate: deliveryEstimate?.trim() || '',
        imageUrl: imageUrl || '',
        productUrl: `https://www.amazon.co.jp/dp/${asin}`,
        scrapedAt: new Date()
      };

    } catch (error) {
      this.logger.warn('Selector fallback failed', { asin, error });
      return null;
    }
  }
  
  /**
   * Scrape detailed product information from product page
   */
  async scrapeProductDetails(asin: string): Promise<ScrapedProduct | null> {
    const startTime = Date.now();
    let page: Page | null = null;
    
    try {
      this.logger.info('Scraping product details', { asin });
      
      page = await this.createPage();
      
      const productUrl = `https://www.amazon.co.jp/dp/${asin}`;
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      await this.randomDelay();
      
      // Extract product details
      const title = await page.$eval(AMAZON_SELECTORS.productTitle, el => el.textContent?.trim() || '');

      // Try multiple price selectors - Amazon has various price display formats
      const price = await this.extractPriceWithFallbacks(page);
      
      const primeBadge = await page.$(AMAZON_SELECTORS.productPrimeBadge);
      const primeEligible = primeBadge !== null;
      
      const ratingText = await page.$eval(AMAZON_SELECTORS.productRating, el => el.textContent || '').catch(() => '');
      const rating = this.parseRating(ratingText);
      
      const reviewText = await page.$eval(AMAZON_SELECTORS.productReviewCount, el => el.textContent || '').catch(() => '');
      const reviewCount = this.parseReviewCount(reviewText);
      
      const sellerText = await page.$eval(AMAZON_SELECTORS.productSeller, el => el.textContent || '').catch(() => '');
      const seller = this.parseSeller(sellerText);
      
      const deliveryEstimate = await page.$eval(AMAZON_SELECTORS.productDelivery, el => el.textContent?.trim() || '').catch(() => '');
      
      const imageUrl = await page.$eval('.a-dynamic-image', el => el.getAttribute('src') || '').catch(() => '');
      
      const duration = Date.now() - startTime;
      await this.recordMetric('product_detail', true, duration, { asin });
      
      return {
        asin,
        productName: '',  // Not extracted in detail view
        brand: '',        // Not extracted in detail view
        quantity: '',     // Not extracted in detail view
        description: '',  // Not extracted in detail view
        title,
        price,
        currency: 'JPY',
        primeEligible,
        rating,
        reviewCount,
        seller,
        deliveryEstimate,
        imageUrl,
        productUrl,
        scrapedAt: new Date()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordMetric('product_detail', false, duration, { asin, error: String(error) });
      
      this.logger.error('Product detail scrape failed', error as Error, undefined, { asin });
      return null;
      
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
  
  /**
   * Build Amazon search URL with filters
   */
  private buildSearchUrl(query: string, filters: SearchFilters): string {
    const params = new URLSearchParams();
    params.set('k', query);
    
    if (filters.priceMin) {
      params.set('low-price', filters.priceMin.toString());
    }
    
    if (filters.priceMax) {
      params.set('high-price', filters.priceMax.toString());
    }
    
    if (filters.category) {
      params.set('i', filters.category);
    }
    
    // Prime filter
    if (filters.primeOnly) {
      params.set('prime', 'true');
    }
    
    return `https://www.amazon.co.jp/s?${params.toString()}`;
  }
  
  /**
   * Extract price from product page using multiple fallback selectors.
   * Amazon displays prices in various formats depending on:
   * - Regular vs sale price
   * - Subscribe & Save options
   * - Prime-exclusive pricing
   * - Bundle/variant pricing
   */
  private async extractPriceWithFallbacks(page: Page): Promise<number> {
    // List of price selectors to try in order of preference
    const priceSelectors = [
      // Primary: Standard price display
      '.a-price .a-offscreen',
      // Fallback 1: Price without .a-offscreen
      '.a-price .a-price-whole',
      // Fallback 2: Core price span (common on product pages)
      '#corePrice_feature_div .a-price .a-offscreen',
      // Fallback 3: Price block variants
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
      // Fallback 4: Newer Amazon UI price displays
      '.priceToPay .a-offscreen',
      '.apexPriceToPay .a-offscreen',
      // Fallback 5: Subscribe & save base price
      '#corePrice_feature_div .a-section .a-offscreen',
      // Fallback 6: Any visible price element
      '[data-a-color="price"] .a-offscreen'
    ];

    for (const selector of priceSelectors) {
      try {
        const priceText = await page.$eval(selector, el => el.textContent?.trim() || '');
        const price = this.parsePrice(priceText);
        if (price > 0) {
          this.logger.debug('Price extracted', { selector, price, priceText });
          return price;
        }
      } catch {
        // Selector not found, try next
        continue;
      }
    }

    // Last resort: Try to find any element with yen symbol and a number
    try {
      const allPrices = await page.$$eval('[class*="price"], [id*="price"]', elements => {
        for (const el of elements) {
          const text = el.textContent || '';
          // Look for yen symbol followed by numbers
          const match = text.match(/[¥￥]\s*([\d,]+)/);
          if (match) {
            return match[0];
          }
        }
        return '';
      });

      if (allPrices) {
        const price = this.parsePrice(allPrices);
        if (price > 0) {
          this.logger.debug('Price extracted via fallback regex', { price, text: allPrices });
          return price;
        }
      }
    } catch {
      // Ignore errors from fallback extraction
    }

    this.logger.warn('Could not extract price from product page');
    return 0;
  }

  /**
   * Parse price from text (e.g., "¥1,234" or "￥764")
   * Preserves decimal places if present in source data
   */
  private parsePrice(priceText: string): number {
    // Remove all non-numeric characters except decimal point
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? 0 : price;
  }
  
  /**
   * Parse rating from text like "5つ星のうち4.3"
   */
  private parseRating(ratingText: string): number {
    const match = ratingText.match(/(\d+\.?\d*)/);
    if (match) {
      const rating = parseFloat(match[1]);
      return isNaN(rating) ? 0 : rating;
    }
    return 0;
  }
  
  /**
   * Parse review count from text
   */
  private parseReviewCount(reviewText: string): number {
    const cleaned = reviewText.replace(/[^0-9]/g, '');
    const count = parseInt(cleaned, 10);
    return isNaN(count) ? 0 : count;
  }
  
  /**
   * Parse seller information
   */
  private parseSeller(sellerText: string): string {
    if (sellerText.includes('Amazon.co.jp')) {
      return 'Amazon.co.jp';
    }
    return sellerText.trim() || 'Unknown';
  }
  
  /**
   * Random delay to appear human
   */
  private async randomDelay(): Promise<void> {
    const delay = getRandomDelay(this.config);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Record scraping metrics
   */
  private async recordMetric(
    metricType: string,
    success: boolean,
    durationMs: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO scraping_metrics (metric_type, success, duration_ms, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          metricType,
          success,
          durationMs,
          metadata.error || null,
          JSON.stringify(metadata)
        ]
      );
    } catch (error) {
      this.logger.error('Failed to record scraping metric', error as Error);
    }
  }
  
  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.info('Browser closed');
    }
  }
}

// Singleton instance
export const playwrightScrapingService = new PlaywrightScrapingService();

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await playwrightScrapingService.close();
});

process.on('SIGINT', async () => {
  await playwrightScrapingService.close();
});
