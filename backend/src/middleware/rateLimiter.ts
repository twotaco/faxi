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

