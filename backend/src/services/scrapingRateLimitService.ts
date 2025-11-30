/**
 * Scraping Rate Limit Service
 * 
 * Manages rate limiting for Amazon scraping to avoid detection and comply with
 * conservative usage patterns. Uses Redis for distributed rate limiting.
 */

import { Redis } from 'ioredis';
import { redis } from '../queue/connection';
import { getScrapingConfig, getRandomSearchDelay } from '../config/playwrightConfig';
import { loggingService } from './loggingService';

export interface RateLimitStatus {
  allowed: boolean;
  searchesInLastHour: number;
  maxSearchesPerHour: number;
  nextAvailableAt?: Date;
  waitTimeMs?: number;
}

export class ScrapingRateLimitService {
  private redis: Redis;
  private config = getScrapingConfig();
  
  // Redis keys
  private readonly SEARCH_COUNT_KEY = 'scraping:search_count';
  private readonly LAST_SEARCH_KEY = 'scraping:last_search';
  private readonly SEARCH_HISTORY_KEY = 'scraping:search_history';
  
  constructor() {
    this.redis = redis.getClient();
  }
  
  /**
   * Check if a scraping request is allowed based on rate limits
   */
  async checkRateLimit(): Promise<RateLimitStatus> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Get searches in the last hour
    const searchHistory = await this.redis.zrangebyscore(
      this.SEARCH_HISTORY_KEY,
      oneHourAgo,
      now
    );
    
    const searchesInLastHour = searchHistory.length;
    
    // Check hourly limit
    if (searchesInLastHour >= this.config.maxSearchesPerHour) {
      // Find the oldest search in the window
      const oldestSearchTime = parseInt(searchHistory[0], 10);
      const nextAvailableAt = new Date(oldestSearchTime + (60 * 60 * 1000));
      const waitTimeMs = nextAvailableAt.getTime() - now;
      
      loggingService.warn('Hourly rate limit reached', {
        searchesInLastHour,
        maxSearchesPerHour: this.config.maxSearchesPerHour,
        nextAvailableAt
      });
      
      return {
        allowed: false,
        searchesInLastHour,
        maxSearchesPerHour: this.config.maxSearchesPerHour,
        nextAvailableAt,
        waitTimeMs
      };
    }
    
    // Check minimum delay between searches
    const lastSearchTime = await this.redis.get(this.LAST_SEARCH_KEY);
    if (lastSearchTime) {
      const timeSinceLastSearch = now - parseInt(lastSearchTime, 10);
      const minDelay = this.config.minDelayBetweenSearches;
      
      if (timeSinceLastSearch < minDelay) {
        const waitTimeMs = minDelay - timeSinceLastSearch;
        const nextAvailableAt = new Date(now + waitTimeMs);
        
        loggingService.debug('Minimum delay not met', {
          timeSinceLastSearch,
          minDelay,
          waitTimeMs
        });
        
        return {
          allowed: false,
          searchesInLastHour,
          maxSearchesPerHour: this.config.maxSearchesPerHour,
          nextAvailableAt,
          waitTimeMs
        };
      }
    }
    
    return {
      allowed: true,
      searchesInLastHour,
      maxSearchesPerHour: this.config.maxSearchesPerHour
    };
  }
  
  /**
   * Record a scraping request
   */
  async recordSearch(): Promise<void> {
    const now = Date.now();
    
    // Add to search history (sorted set with timestamp as score)
    await this.redis.zadd(this.SEARCH_HISTORY_KEY, now, now.toString());
    
    // Update last search time
    await this.redis.set(this.LAST_SEARCH_KEY, now.toString());
    
    // Clean up old entries (older than 1 hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    await this.redis.zremrangebyscore(this.SEARCH_HISTORY_KEY, 0, oneHourAgo);
    
    loggingService.debug('Recorded search', { timestamp: now });
  }
  
  /**
   * Wait for rate limit to allow next request
   * Returns the actual wait time in milliseconds
   */
  async waitForRateLimit(): Promise<number> {
    const status = await this.checkRateLimit();
    
    if (status.allowed) {
      // Add random delay even when allowed to appear more human
      const randomDelay = getRandomSearchDelay(this.config);
      await this.sleep(randomDelay);
      return randomDelay;
    }
    
    // Wait until rate limit allows
    if (status.waitTimeMs) {
      loggingService.info('Waiting for rate limit', {
        waitTimeMs: status.waitTimeMs,
        nextAvailableAt: status.nextAvailableAt
      });
      
      await this.sleep(status.waitTimeMs);
      return status.waitTimeMs;
    }
    
    return 0;
  }
  
  /**
   * Get current rate limit status for monitoring
   */
  async getStatus(): Promise<RateLimitStatus> {
    return await this.checkRateLimit();
  }
  
  /**
   * Reset rate limits (for testing/admin purposes)
   */
  async reset(): Promise<void> {
    await this.redis.del(this.SEARCH_COUNT_KEY);
    await this.redis.del(this.LAST_SEARCH_KEY);
    await this.redis.del(this.SEARCH_HISTORY_KEY);
    
    loggingService.info('Rate limits reset');
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const scrapingRateLimitService = new ScrapingRateLimitService();
