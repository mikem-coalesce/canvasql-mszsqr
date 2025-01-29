import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Counter, register } from 'prom-client';
import { validateConfigurations, cors, securityConfig } from './config';
import router from './api/routes';
import { WebSocketServer } from './websocket/websocket.server';
import { logger } from './core/utils/logger.util';

// Global constants
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '1mb';

// Initialize metrics
const httpRequestDuration = new Counter({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

/**
 * Initializes and configures the Express application with comprehensive middleware stack,
 * security features, and monitoring
 */
export function initializeApp(): Express {
  // Validate all configurations on startup
  validateConfigurations();

  const app = express();

  // Security middleware configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors());

  // Request compression
  app.use(compression());

  // Request logging with correlation IDs
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false
  }));

  // Body parsing middleware
  app.use(express.json({ limit: MAX_REQUEST_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_SIZE }));

  // Request correlation ID
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Request timing middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      httpRequestDuration.inc({
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode
      }, duration / 1000);
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (_, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Metrics endpoint
  app.get('/metrics', async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error collecting metrics', { error });
      res.status(500).end();
    }
  });

  // Mount API routes
  app.use('/api/v1', router);

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    logger.error('Application error:', {
      error: err,
      requestId: req.id,
      path: req.path
    });

    res.status(err.status || 500).json({
      status: err.status || 500,
      message: NODE_ENV === 'development' ? err.message : 'Internal Server Error',
      requestId: req.id
    });
  });

  return app;
}

/**
 * Starts the HTTP and WebSocket servers with security and monitoring
 */
export async function startServer(app: Express): Promise<void> {
  try {
    // Create HTTP server
    const server = require('http').createServer(app);

    // Initialize WebSocket server
    const wss = new WebSocketServer(server);
    await wss.start();

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Server started in ${NODE_ENV} mode on port ${PORT}`);
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info('Shutting down server...');
      server.close(() => {
        logger.info('Server shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

export default initializeApp();