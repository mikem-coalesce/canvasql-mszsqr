import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Counter, register } from 'prom-client';

// Import route handlers
import authRouter from './auth.routes';
import workspaceRouter from './workspace.routes';
import projectRouter from './project.routes';
import diagramRouter from './diagram.routes';

// Import middlewares
import { rateLimiter } from '../middlewares/rateLimiter.middleware';
import { errorHandler } from '../middlewares/error.middleware';
import { enhancedLogger as logger } from '../../core/utils/logger.util';

// API metrics
const apiRequestCounter = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'path', 'status']
});

// CORS configuration
const CORS_OPTIONS = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://erd.example.com']
    : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token'
  ],
  credentials: true,
  maxAge: 86400
};

/**
 * Configures and returns the main Express router with comprehensive middleware chain
 * and all API routes
 */
export function configureRoutes(): Router {
  const router = express.Router();

  // Security middleware
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:']
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

  // CORS middleware
  router.use(cors(CORS_OPTIONS));

  // Response compression
  router.use(compression());

  // Request correlation ID
  router.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Request logging
  router.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Metrics collection
  router.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      apiRequestCounter.inc({
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode
      });
      logger.debug('API Request', {
        method: req.method,
        path: req.path,
        duration: Date.now() - start,
        status: res.statusCode
      });
    });
    next();
  });

  // Rate limiting
  router.use(rateLimiter);

  // Health check endpoint
  router.get('/health', (_, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Metrics endpoint
  router.get('/metrics', async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      logger.error('Error collecting metrics', { error });
      res.status(500).end();
    }
  });

  // API Documentation endpoint
  router.get('/docs', (_, res) => {
    res.redirect('/api-docs');
  });

  // Mount route handlers
  router.use('/auth', authRouter);
  router.use('/workspaces', workspaceRouter);
  router.use('/projects', projectRouter);
  router.use('/diagrams', diagramRouter);

  // API version deprecation check
  router.use((req, res, next) => {
    const apiVersion = req.headers['api-version'];
    if (apiVersion && apiVersion < 'v1') {
      logger.warn('Deprecated API version used', { version: apiVersion });
      res.setHeader('X-API-Deprecated', 'true');
    }
    next();
  });

  // Global error handling
  router.use(errorHandler);

  return router;
}

export default configureRoutes();