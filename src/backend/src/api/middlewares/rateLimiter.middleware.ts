import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { Redis } from 'ioredis'; // ^5.0.0
import { APIError } from '../core/errors/APIError';
import redis from '../config/redis.config';

// Configuration constants
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const MAX_REQUESTS = 100; // Maximum requests per window
const RATE_LIMIT_PREFIX = 'ratelimit:v1:';
const LOCAL_CACHE_TTL = 1000; // Local cache TTL in milliseconds

// Local memory cache for performance optimization
const localCache = new Map<string, { count: number; expires: number }>();

/**
 * Generates a unique Redis key for rate limiting
 * @param identifier - User ID or IP address
 * @returns Formatted Redis key
 */
const generateRateLimitKey = (identifier: string): string => {
  const env = process.env.NODE_ENV || 'development';
  return `${RATE_LIMIT_PREFIX}${env}:${identifier}`;
};

/**
 * Handles Redis fallback behavior in case of failures
 * @param error - Redis error
 * @throws APIError if rate limiting cannot be enforced
 */
const handleRedisFallback = async (error: Error): Promise<void> => {
  console.error('[RateLimit] Redis error:', error);
  
  // Check if Redis is completely down
  try {
    await redis.client.ping();
  } catch (pingError) {
    // Fall back to local memory cache if Redis is unavailable
    console.warn('[RateLimit] Redis unavailable, using local cache fallback');
    return;
  }
  
  throw APIError.internalServer('Rate limiting service temporarily unavailable');
};

/**
 * Express middleware that implements distributed rate limiting using Redis
 * with atomic operations and sliding window approach
 */
const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get identifier from auth token or IP address
    const identifier = (req.user?.id || req.ip).toString();
    const key = generateRateLimitKey(identifier);

    // Check local cache first
    const cached = localCache.get(key);
    if (cached && cached.expires > Date.now()) {
      if (cached.count >= MAX_REQUESTS) {
        throw APIError.badRequest('Rate limit exceeded', {
          retryAfter: cached.expires - Date.now(),
          limit: MAX_REQUESTS,
          remaining: 0
        });
      }
    }

    // Start Redis transaction for atomic operations
    const multi = redis.client.multi();
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean old requests and add new request atomically
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, `${now}`);
    multi.zcard(key);
    multi.pexpire(key, RATE_LIMIT_WINDOW);

    // Execute transaction
    const [, , requestCount] = await multi.exec() as [any, any, [null | Error, number]];
    
    if (!requestCount || requestCount[0]) {
      throw requestCount[0] || new Error('Redis transaction failed');
    }

    const count = requestCount[1];
    const remaining = Math.max(0, MAX_REQUESTS - count);
    const reset = now + RATE_LIMIT_WINDOW;

    // Update local cache
    localCache.set(key, {
      count,
      expires: reset
    });

    // Clean up expired cache entries
    setTimeout(() => {
      if (localCache.get(key)?.expires <= Date.now()) {
        localCache.delete(key);
      }
    }, LOCAL_CACHE_TTL);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(reset / 1000));

    // Check if limit exceeded
    if (count > MAX_REQUESTS) {
      throw APIError.badRequest('Rate limit exceeded', {
        retryAfter: RATE_LIMIT_WINDOW,
        limit: MAX_REQUESTS,
        remaining: 0
      });
    }

    // Log rate limit status for monitoring
    if (count > MAX_REQUESTS * 0.8) {
      console.warn(`[RateLimit] High usage for ${identifier}: ${count}/${MAX_REQUESTS}`);
    }

    next();
  } catch (error) {
    if (error instanceof Error && !(error instanceof APIError)) {
      await handleRedisFallback(error);
    }
    next(error);
  }
};

export default rateLimiter;