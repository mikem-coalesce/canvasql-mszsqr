import { Redis } from 'ioredis'; // ^5.0.0
import redis from '../config/redis.config';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

const compress = promisify(gzip);
const decompress = promisify(gunzip);

/**
 * Service class providing Redis caching functionality with configurable TTL,
 * compression, and performance optimization for the ERD visualization system.
 */
export class CacheService {
  private readonly redisClient: Redis;
  private readonly defaultTTL: number = 86400; // 24 hours in seconds
  private readonly compressionThreshold: number = 1024 * 1024; // 1MB
  private readonly maxMemoryUsage: number = 80; // 80% memory threshold

  private readonly metrics = {
    hits: 0,
    misses: 0,
    compressionRatio: 0,
    memoryUsage: 0,
  };

  constructor() {
    this.redisClient = redis.client;
    this.initializeErrorHandling();
    this.startMetricsCollection();
  }

  /**
   * Sets a value in cache with optional TTL and automatic compression
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL in seconds
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (!key) {
        throw new Error('Cache key is required');
      }

      await this.checkMemoryUsage();
      
      let serializedValue = JSON.stringify(value);
      let finalValue = serializedValue;
      
      // Compress if value size exceeds threshold
      if (serializedValue.length > this.compressionThreshold) {
        const compressed = await compress(Buffer.from(serializedValue));
        finalValue = compressed.toString('base64');
        finalValue = `compressed:${finalValue}`;
      }

      if (ttl) {
        await this.redisClient.setex(key, ttl, finalValue);
      } else {
        await this.redisClient.setex(key, this.defaultTTL, finalValue);
      }
    } catch (error) {
      console.error('[CacheService] Error setting cache:', error);
      throw error;
    }
  }

  /**
   * Retrieves and deserializes a value from cache with type safety
   * @param key Cache key
   * @returns Typed cached value or null if not found
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      if (!key) {
        throw new Error('Cache key is required');
      }

      const value = await this.redisClient.get(key);
      
      if (!value) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      
      // Handle compressed values
      if (value.startsWith('compressed:')) {
        const compressedData = Buffer.from(value.slice(11), 'base64');
        const decompressed = await decompress(compressedData);
        return JSON.parse(decompressed.toString());
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[CacheService] Error getting cache:', error);
      throw error;
    }
  }

  /**
   * Sets multiple hash fields with efficient batch operations
   * @param key Hash key
   * @param fields Object containing field-value pairs
   * @param ttl Optional TTL in seconds
   */
  public async setHash(key: string, fields: Record<string, any>, ttl?: number): Promise<void> {
    try {
      if (!key || !fields) {
        throw new Error('Hash key and fields are required');
      }

      await this.checkMemoryUsage();

      const pipeline = this.redisClient.pipeline();
      
      // Process each field
      for (const [field, value] of Object.entries(fields)) {
        let serializedValue = JSON.stringify(value);
        
        if (serializedValue.length > this.compressionThreshold) {
          const compressed = await compress(Buffer.from(serializedValue));
          serializedValue = `compressed:${compressed.toString('base64')}`;
        }
        
        pipeline.hset(key, field, serializedValue);
      }

      if (ttl) {
        pipeline.expire(key, ttl);
      } else {
        pipeline.expire(key, this.defaultTTL);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[CacheService] Error setting hash:', error);
      throw error;
    }
  }

  /**
   * Efficiently clears all keys under a namespace with memory optimization
   * @param namespace Namespace to clear
   */
  public async clearNamespace(namespace: string): Promise<void> {
    try {
      if (!namespace) {
        throw new Error('Namespace is required');
      }

      const pattern = `${namespace}:*`;
      let cursor = '0';
      const pipeline = this.redisClient.pipeline();
      let deletedKeys = 0;

      do {
        const [newCursor, keys] = await this.redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100'
        );
        
        cursor = newCursor;
        
        if (keys.length > 0) {
          pipeline.del(...keys);
          deletedKeys += keys.length;
        }

        if (pipeline.length >= 1000) {
          await pipeline.exec();
          pipeline.clear();
        }
      } while (cursor !== '0');

      if (pipeline.length > 0) {
        await pipeline.exec();
      }

      console.info(`[CacheService] Cleared ${deletedKeys} keys from namespace: ${namespace}`);
    } catch (error) {
      console.error('[CacheService] Error clearing namespace:', error);
      throw error;
    }
  }

  /**
   * Initializes error handling and circuit breaker
   */
  private initializeErrorHandling(): void {
    this.redisClient.on('error', (error: Error) => {
      console.error('[CacheService] Redis error:', error);
    });

    this.redisClient.on('reconnecting', (delay: number) => {
      console.warn(`[CacheService] Reconnecting to Redis in ${delay}ms`);
    });
  }

  /**
   * Starts collection of cache metrics
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      try {
        const info = await this.redisClient.info('memory');
        const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
        const maxMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');
        
        this.metrics.memoryUsage = (usedMemory / maxMemory) * 100;
      } catch (error) {
        console.error('[CacheService] Error collecting metrics:', error);
      }
    }, 60000); // Collect metrics every minute
  }

  /**
   * Checks if memory usage is within acceptable limits
   */
  private async checkMemoryUsage(): Promise<void> {
    if (this.metrics.memoryUsage > this.maxMemoryUsage) {
      throw new Error('Redis memory usage exceeds threshold');
    }
  }
}