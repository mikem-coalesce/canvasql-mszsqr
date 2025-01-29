import http from 'http';
import process from 'process';
import winston from 'winston';
import { Counter, register } from 'prom-client';
import app from './app';
import { config } from './config';
import { WebSocketServer } from './websocket/websocket.server';
import { logger } from './core/utils/logger.util';

// Server metrics
const serverMetrics = {
  activeConnections: new Counter({
    name: 'server_active_connections',
    help: 'Number of active server connections'
  }),
  requestDuration: new Counter({
    name: 'server_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status']
  })
};

/**
 * Custom error type for server-specific errors with enhanced context
 */
interface ServerError extends Error {
  code: string;
  fatal: boolean;
  timestamp: Date;
  context: Record<string, unknown>;
}

/**
 * Initializes and starts the HTTP and WebSocket servers with proper error handling
 * and monitoring capabilities
 */
async function startServer(): Promise<void> {
  try {
    // Validate all configurations
    config.validateConfigurations();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket server
    const wss = new WebSocketServer(server);
    await wss.start();

    // Setup health check endpoint
    setupHealthCheck(server);

    // Configure connection tracking
    server.on('connection', (socket) => {
      serverMetrics.activeConnections.inc();
      socket.on('close', () => {
        serverMetrics.activeConnections.dec();
      });
    });

    // Start server listening
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server started in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown(server);

  } catch (error) {
    handleServerError(error as Error);
  }
}

/**
 * Handles server startup and runtime errors with proper logging and monitoring
 */
function handleServerError(error: Error): void {
  const serverError: ServerError = {
    ...error,
    code: 'SERVER_ERROR',
    fatal: true,
    timestamp: new Date(),
    context: {
      nodeEnv: process.env.NODE_ENV,
      errorName: error.name,
      errorStack: error.stack
    }
  };

  logger.error('Server error occurred:', {
    error: serverError,
    fatal: serverError.fatal,
    timestamp: serverError.timestamp
  });

  if (serverError.fatal) {
    process.exit(1);
  }
}

/**
 * Configures health check endpoints and monitoring
 */
function setupHealthCheck(server: http.Server): void {
  app.get('/health', (_, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      connections: server.connections,
      memoryUsage: process.memoryUsage()
    };
    res.json(health);
  });

  app.get('/metrics', async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      res.status(500).end();
    }
  });
}

/**
 * Configures graceful shutdown with connection draining and cleanup
 */
function setupGracefulShutdown(server: http.Server): void {
  // Shutdown timeout (default 10 seconds)
  const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000');

  async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`${signal} received - initiating graceful shutdown`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      // Wait for existing connections to complete
      const shutdownTimeout = setTimeout(() => {
        logger.warn('Shutdown timeout reached - forcing exit');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);

      // Cleanup resources
      await Promise.all([
        // Close database connections
        app.get('prisma')?.$disconnect(),
        // Close Redis connections
        app.get('redis')?.quit(),
        // Clear metrics
        register.clear()
      ]);

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

// Start the server
startServer().catch(handleServerError);

export default app;