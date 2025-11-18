import { Request, Response, NextFunction } from 'express';
import { redis } from '../queue/connection';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

/**
 * Simple rate limiter using Redis
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator ? keyGenerator(req) : `rate-limit:${req.ip}:${req.path}`;
      const client = redis.getClient();

      // Get current count
      const current = await client.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again later.`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Increment counter
      const newCount = await client.incr(key);
      
      // Set expiry on first request
      if (newCount === 1) {
        await client.expire(key, Math.ceil(windowMs / 1000));
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

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
