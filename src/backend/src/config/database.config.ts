import { PrismaClient } from '@prisma/client'; // ^5.0.0
import { config } from 'dotenv'; // ^16.0.0

// Load environment variables
config();

// Global configuration constants
const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
const MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS || 10);
const CONNECTION_TIMEOUT = Number(process.env.DB_CONNECTION_TIMEOUT || 5000);

/**
 * Enhanced interface for database configuration with comprehensive options
 */
interface DatabaseConfig {
  url: string;
  logLevel: string[];
  errorFormat: string;
  maxConnections: number;
  poolTimeout: number;
  retryAttempts: number;
  ssl: boolean;
  logQueries: boolean;
  connectionTimeout: number;
}

/**
 * Returns enhanced database configuration with comprehensive settings
 * @returns {DatabaseConfig} Complete database configuration object
 */
export const getDatabaseConfig = (): DatabaseConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Validate essential configuration
  if (!DATABASE_URL) {
    throw new Error('Database URL is required');
  }

  return {
    url: DATABASE_URL,
    logLevel: isDevelopment ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
    maxConnections: MAX_CONNECTIONS,
    poolTimeout: 30, // seconds
    retryAttempts: 3,
    ssl: process.env.NODE_ENV === 'production',
    logQueries: isDevelopment,
    connectionTimeout: CONNECTION_TIMEOUT
  };
};

/**
 * Creates and configures a Prisma client instance with enhanced error handling
 * and connection management
 */
const createPrismaClient = (): PrismaClient => {
  const config = getDatabaseConfig();
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.url,
      },
    },
    log: config.logLevel as any[],
    errorFormat: config.errorFormat as any,
    __internal: {
      engine: {
        connectionTimeout: config.connectionTimeout,
      },
    },
  });

  // Configure connection event handling
  prisma.$on('query', (e: any) => {
    if (config.logQueries) {
      console.log('Query: ' + e.query);
      console.log('Duration: ' + e.duration + 'ms');
    }
  });

  // Configure error event handling
  prisma.$on('error', (e: any) => {
    console.error('Database error:', e);
  });

  // Handle graceful shutdown
  const handleShutdown = async () => {
    try {
      await prisma.$disconnect();
      console.log('Database connection closed gracefully');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnection:', err);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  return prisma;
};

// Create singleton instance
const prisma = createPrismaClient();

// Verify database connection on startup
prisma.$connect()
  .then(() => {
    console.log('Database connection established successfully');
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

export default prisma;