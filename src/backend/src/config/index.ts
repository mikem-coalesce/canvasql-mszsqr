/**
 * Central configuration module that consolidates and exports all application configuration settings
 * Implements comprehensive validation and type safety for all configuration components
 * @version 1.0.0
 */

import { config as dotenv } from 'dotenv'; // ^16.0.0
import { authConfig } from './auth.config';
import getCorsConfig from './cors.config';
import { getDatabaseConfig } from './database.config';
import redis from './redis.config';
import { websocketConfig, validateWebSocketConfig } from './websocket.config';

// Load environment variables
dotenv();

// Global configuration constants
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_NAME = process.env.APP_NAME || 'ERD Visualization Tool';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

/**
 * Comprehensive interface defining the consolidated application configuration
 */
export interface AppConfig {
  readonly environment: string;
  readonly appName: string;
  readonly version: string;
  readonly auth: typeof authConfig;
  readonly cors: ReturnType<typeof getCorsConfig>;
  readonly database: ReturnType<typeof getDatabaseConfig>;
  readonly redis: typeof redis;
  readonly websocket: typeof websocketConfig;
  readonly validateConfigurations: () => boolean;
}

/**
 * Comprehensive validation of all configuration settings with detailed error reporting
 * @throws Error with detailed message if validation fails
 * @returns true if all configurations are valid
 */
const validateConfigurations = (): boolean => {
  // Validate required environment variables
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'DATABASE_URL'
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  }

  // Validate production-specific requirements
  if (NODE_ENV === 'production') {
    if (!process.env.ALLOWED_ORIGINS) {
      throw new Error('ALLOWED_ORIGINS must be set in production environment');
    }
    if (!process.env.REDIS_PASSWORD) {
      throw new Error('REDIS_PASSWORD must be set in production environment');
    }
  }

  // Validate WebSocket configuration
  validateWebSocketConfig(websocketConfig);

  // Validate Redis connection
  redis.client.ping().catch((error) => {
    throw new Error(`Redis connection failed: ${error.message}`);
  });

  // Validate database configuration
  const dbConfig = getDatabaseConfig();
  if (!dbConfig.url) {
    throw new Error('Invalid database configuration: missing URL');
  }

  // Log validation success for audit purposes
  console.info('[Config] All configurations validated successfully');

  return true;
};

/**
 * Consolidated configuration object with comprehensive validation and security features
 */
export const config: AppConfig = {
  environment: NODE_ENV,
  appName: APP_NAME,
  version: APP_VERSION,
  auth: authConfig,
  cors: getCorsConfig(),
  database: getDatabaseConfig(),
  redis: redis,
  websocket: websocketConfig,
  validateConfigurations
};

// Prevent modification of the config object
Object.freeze(config);

// Validate all configurations on initialization
try {
  config.validateConfigurations();
} catch (error) {
  console.error('[Config] Configuration validation failed:', error);
  process.exit(1);
}

export default config;