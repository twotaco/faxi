/**
 * Playwright Configuration for Amazon.co.jp Scraping
 * 
 * This configuration ensures realistic browser fingerprints and human-like behavior
 * to avoid detection while scraping Amazon product data.
 */

export interface PlaywrightScrapingConfig {
  // Browser configuration
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezone: string;
  headless: boolean;
  
  // Timing configuration
  delayMin: number; // Minimum delay between actions (ms)
  delayMax: number; // Maximum delay between actions (ms)
  
  // Rate limiting
  maxSearchesPerHour: number;
  minDelayBetweenSearches: number; // ms
  maxDelayBetweenSearches: number; // ms
  
  // Retry configuration
  maxRetries: number;
  retryDelayBase: number; // Base delay for exponential backoff (ms)
}

/**
 * Default configuration for MVP
 * Conservative rate limits to avoid detection
 */
export const defaultScrapingConfig: PlaywrightScrapingConfig = {
  // Realistic Chrome user agent for macOS
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Standard desktop viewport
  viewport: {
    width: 1920,
    height: 1080
  },
  
  // Japanese locale and timezone
  locale: 'ja-JP',
  timezone: 'Asia/Tokyo',
  
  // Must run headless in Docker containers (no X server available)
  // Can set PLAYWRIGHT_HEADLESS=false for local debugging with a display
  headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  
  // Human-like delays between actions
  delayMin: 150,
  delayMax: 600,
  
  // Conservative rate limiting for MVP
  maxSearchesPerHour: 30,
  minDelayBetweenSearches: 8000,  // 8 seconds
  maxDelayBetweenSearches: 15000, // 15 seconds
  
  // Retry configuration
  maxRetries: 2,
  retryDelayBase: 8000 // 8s, 16s, 32s with exponential backoff
};

/**
 * Get random delay within configured range
 */
export function getRandomDelay(config: PlaywrightScrapingConfig = defaultScrapingConfig): number {
  return Math.floor(
    Math.random() * (config.delayMax - config.delayMin) + config.delayMin
  );
}

/**
 * Get random delay between searches
 */
export function getRandomSearchDelay(config: PlaywrightScrapingConfig = defaultScrapingConfig): number {
  return Math.floor(
    Math.random() * (config.maxDelayBetweenSearches - config.minDelayBetweenSearches) + 
    config.minDelayBetweenSearches
  );
}

/**
 * Calculate exponential backoff delay for retries
 */
export function getRetryDelay(attemptNumber: number, config: PlaywrightScrapingConfig = defaultScrapingConfig): number {
  return config.retryDelayBase * Math.pow(2, attemptNumber);
}

/**
 * Amazon.co.jp selectors for product scraping
 * These may need updates if Amazon changes their UI
 */
export const AMAZON_SELECTORS = {
  // Search results page
  productCard: '[data-component-type="s-search-result"]',
  title: 'h2 a span',
  price: '.a-price .a-offscreen',
  primeBadge: 'i.a-icon-prime',
  rating: '.a-icon-star-small .a-icon-alt',
  reviewCount: '.a-size-base.s-underline-text',
  seller: '.a-size-base.a-color-secondary',
  deliveryText: '.a-color-base.a-text-bold',
  image: '.s-image',
  productLink: 'h2 a.a-link-normal',
  
  // Product detail page
  productTitle: '#productTitle',
  productPrice: '.a-price .a-offscreen',
  productPrimeBadge: '#priceBadging_feature_div i.a-icon-prime',
  productRating: '#acrPopover .a-icon-alt',
  productReviewCount: '#acrCustomerReviewText',
  productAvailability: '#availability span',
  productSeller: '#sellerProfileTriggerId',
  productDelivery: '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE'
};

/**
 * Environment-specific configuration overrides
 */
export function getScrapingConfig(): PlaywrightScrapingConfig {
  const config = { ...defaultScrapingConfig };
  
  // Override from environment variables if provided
  if (process.env.SCRAPING_HEADLESS) {
    config.headless = process.env.SCRAPING_HEADLESS === 'true';
  }
  
  if (process.env.SCRAPING_MAX_SEARCHES_PER_HOUR) {
    config.maxSearchesPerHour = parseInt(process.env.SCRAPING_MAX_SEARCHES_PER_HOUR, 10);
  }
  
  if (process.env.SCRAPING_MIN_DELAY) {
    config.minDelayBetweenSearches = parseInt(process.env.SCRAPING_MIN_DELAY, 10);
  }
  
  if (process.env.SCRAPING_MAX_DELAY) {
    config.maxDelayBetweenSearches = parseInt(process.env.SCRAPING_MAX_DELAY, 10);
  }
  
  return config;
}
