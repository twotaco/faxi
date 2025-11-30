import { Request, Response, NextFunction } from 'express';
import { redis } from '../queue/connection';
import { loggingService } from '../services/loggingService';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Simple rate limiter using Redis
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator, skipSuccessfulRequests = false, skipFailedRequests = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator ? keyGenerator(req) : `rate-limit:${req.ip}:${req.path}`;
      const client = redis.getClient();

      // Get current count
      const current = await client.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        loggingService.warn('Rate limit exceeded', {
          key,
          count,
          maxRequests,
          ip: req.ip,
          path: req.path
        });

        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again later.`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Increment counter (unless we're skipping based on response)
      if (!skipSuccessfulRequests && !skipFailedRequests) {
        const newCount = await client.incr(key);
        
        // Set expiry on first request
        if (newCount === 1) {
          await client.expire(key, Math.ceil(windowMs / 1000));
        }

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
      } else {
        // Conditionally increment based on response
        const originalSend = res.send;
        res.send = function(data: any) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (skipSuccessfulRequests && statusCode >= 200 && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400);

          if (!shouldSkip) {
            client.incr(key).then(newCount => {
              if (newCount === 1) {
                client.expire(key, Math.ceil(windowMs / 1000));
              }
              res.setHeader('X-RateLimit-Limit', maxRequests.toString());
              res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
              res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
            }).catch(err => {
              console.error('Rate limiter increment error:', err);
            });
          }

          return originalSend.call(this, data);
        };

        // Add current rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
      }

      next();
    } catch (error) {
      // If rate limiting fails, allow the request through
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

/**
 * Login rate limiter - 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (req) => `rate-limit:login:${req.ip}`,
});

/**
 * Admin dashboard rate limiter - 60 requests per minute per user
 * Applied to all /admin/* endpoints
 */
export const adminDashboardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  keyGenerator: (req) => {
    // Use admin user ID if authenticated, otherwise fall back to IP
    const userId = req.adminUser?.id || req.ip;
    return `rate-limit:admin:${userId}`;
  },
});

/**
 * PA-API rate limiter - 1 request per second per user
 * This is a service-level rate limiter, not middleware
 */
export class PAAPIRateLimiter {
  private requestQueue: Map<string, { count: number; resetAt: number; queue: Array<() => void> }> = new Map();
  private readonly RATE_LIMIT_PER_SECOND = 1;
  private readonly RATE_LIMIT_WINDOW_MS = 1000;
  private metricsKey = 'rate-limit:pa-api:metrics';

  /**
   * Check rate limit and queue request if necessary
   */
  async checkRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    const userLimit = this.requestQueue.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
      // Reset window
      this.requestQueue.set(userId, {
        count: 1,
        resetAt: now + this.RATE_LIMIT_WINDOW_MS,
        queue: []
      });
      
      // Track metrics
      await this.incrementMetrics('allowed');
      return;
    }

    if (userLimit.count >= this.RATE_LIMIT_PER_SECOND) {
      // Queue the request
      const waitTime = userLimit.resetAt - now;
      
      loggingService.info('PA-API rate limit reached, queuing request', {
        userId,
        waitTime,
        queueLength: userLimit.queue.length
      });

      // Track metrics
      await this.incrementMetrics('queued');

      // Wait for the rate limit window to reset
      await new Promise<void>((resolve) => {
        userLimit.queue.push(resolve);
        
        setTimeout(() => {
          // Reset after waiting
          this.requestQueue.set(userId, {
            count: 1,
            resetAt: Date.now() + this.RATE_LIMIT_WINDOW_MS,
            queue: []
          });
          
          // Resolve this request
          resolve();
          
          // Process queued requests
          const queue = userLimit.queue;
          if (queue.length > 0) {
            const next = queue.shift();
            if (next) next();
          }
        }, waitTime);
      });
    } else {
      userLimit.count++;
      await this.incrementMetrics('allowed');
    }
  }

  /**
   * Get rate limit metrics
   */
  async getMetrics(): Promise<{ allowed: number; queued: number; rejected: number }> {
    try {
      const client = redis.getClient();
      const metrics = await client.hgetall(this.metricsKey);
      
      return {
        allowed: parseInt(metrics.allowed || '0', 10),
        queued: parseInt(metrics.queued || '0', 10),
        rejected: parseInt(metrics.rejected || '0', 10)
      };
    } catch (error) {
      loggingService.error('Failed to get PA-API rate limit metrics', error as Error);
      return { allowed: 0, queued: 0, rejected: 0 };
    }
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  async resetMetrics(): Promise<void> {
    try {
      const client = redis.getClient();
      await client.del(this.metricsKey);
    } catch (error) {
      loggingService.error('Failed to reset PA-API rate limit metrics', error as Error);
    }
  }

  /**
   * Increment metrics counter
   */
  private async incrementMetrics(type: 'allowed' | 'queued' | 'rejected'): Promise<void> {
    try {
      const client = redis.getClient();
      await client.hincrby(this.metricsKey, type, 1);
      
      // Set expiry to 24 hours
      await client.expire(this.metricsKey, 24 * 60 * 60);
    } catch (error) {
      // Don't throw, just log
      console.error('Failed to increment PA-API metrics:', error);
    }
  }

  /**
   * Get current queue length for a user
   */
  getQueueLength(userId: string): number {
    const userLimit = this.requestQueue.get(userId);
    return userLimit?.queue.length || 0;
  }

  /**
   * Clear queue for a user (for testing)
   */
  clearQueue(userId: string): void {
    this.requestQueue.delete(userId);
  }
}

// Export singleton instance
export const paApiRateLimiter = new PAAPIRateLimiter();
