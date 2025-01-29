import Redis from 'ioredis'; // ^5.0.0

/**
 * Comprehensive Redis configuration with support for clustering, sentinels,
 * and security features. All values can be overridden via environment variables.
 */
export const REDIS_CONFIG = {
  // Connection
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'erd:',
  
  // Retry and Timeout Settings
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  connectionTimeout: parseInt(process.env.REDIS_CONN_TIMEOUT || '10000'),
  maxReconnectTime: parseInt(process.env.REDIS_MAX_RECONNECT_TIME || '3600000'),
  
  // Security
  tls: process.env.REDIS_TLS_ENABLED === 'true' 
    ? { rejectUnauthorized: true } 
    : undefined,
  
  // Sentinel Configuration
  sentinels: process.env.REDIS_SENTINEL_ENABLED === 'true' 
    ? [{
        host: process.env.REDIS_SENTINEL_HOST,
        port: parseInt(process.env.REDIS_SENTINEL_PORT || '26379')
      }]
    : undefined,
  sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  
  // Performance and Behavior
  namespaceSeparator: ':',
  lazyConnect: true,
  autoResubscribe: true,
  autoResendUnfulfilledCommands: true,
  connectTimeout: 10000,
  disconnectTimeout: 2000,
  commandTimeout: 5000,
  keepAlive: 10000,
  noDelay: true,
  readOnly: false,
  stringNumbers: true,
  maxLoadingRetryTime: 2000,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
};

/**
 * Creates and configures a new Redis client instance with comprehensive
 * error handling, monitoring, and reconnection strategies.
 */
const createRedisClient = (): Redis => {
  const client = new Redis(REDIS_CONFIG);

  // Error handling
  client.on('error', (error: Error) => {
    console.error('[Redis] Error encountered:', error);
    // Additional error reporting could be added here
  });

  // Connection monitoring
  client.on('connect', () => {
    console.info('[Redis] Client connected');
  });

  client.on('ready', () => {
    console.info('[Redis] Client ready and initialized');
  });

  client.on('reconnecting', (delay: number) => {
    console.warn(`[Redis] Client reconnecting after ${delay}ms`);
  });

  client.on('end', () => {
    console.warn('[Redis] Client connection ended');
  });

  // Performance monitoring
  client.on('monitor', (time: number, args: any[], source: string) => {
    if (process.env.REDIS_MONITOR_ENABLED === 'true') {
      console.debug('[Redis] Command:', { time, args, source });
    }
  });

  // Health check setup
  const healthCheck = async () => {
    try {
      await client.ping();
      return true;
    } catch (error) {
      console.error('[Redis] Health check failed:', error);
      return false;
    }
  };

  // Attach health check method to client instance
  (client as any).healthCheck = healthCheck;

  return client;
};

// Create singleton Redis client instance
const redis = {
  client: createRedisClient()
};

// Prevent modification of the redis object
Object.freeze(redis);

export default redis;