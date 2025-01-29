import express, { Router } from 'express'; // ^4.18.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import compression from 'compression'; // ^1.7.4
import helmet from 'helmet'; // ^7.0.0
import { DiagramController } from '../controllers/diagram.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createDiagramSchema, updateDiagramSchema } from '../validators/diagram.validator';
import errorHandler from '../middlewares/error.middleware';
import { UserRole } from '../../core/types/auth.types';
import { Counter, register } from 'prom-client'; // ^14.0.0
import { enhancedLogger as logger } from '../../core/utils/logger.util';

/**
 * Metrics for monitoring diagram operations
 */
const diagramOperationsCounter = new Counter({
  name: 'diagram_operations_total',
  help: 'Total number of diagram operations',
  labelNames: ['operation', 'status']
});

/**
 * Initializes and configures diagram routes with comprehensive security controls
 * @param diagramController - Instance of DiagramController for handling diagram operations
 * @returns Configured Express router for diagram endpoints
 */
export function initializeDiagramRoutes(diagramController: DiagramController): Router {
  const router = express.Router();

  // Apply security headers
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:']
      }
    }
  }));

  // Enable response compression
  router.use(compression());

  // Configure rate limiting based on user roles
  const standardRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later'
  });

  const restrictedRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // More restrictive for sensitive operations
    message: 'Too many requests for sensitive operations'
  });

  // Create new diagram
  router.post('/diagrams',
    standardRateLimit,
    authenticate,
    authorize([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR]),
    validate(createDiagramSchema),
    async (req, res, next) => {
      try {
        logger.info('Creating new diagram', { userId: req.user?.id });
        const result = await diagramController.create(req, res, next);
        diagramOperationsCounter.inc({ operation: 'create', status: 'success' });
        return result;
      } catch (error) {
        diagramOperationsCounter.inc({ operation: 'create', status: 'error' });
        next(error);
      }
    }
  );

  // Update existing diagram
  router.put('/diagrams/:id',
    standardRateLimit,
    authenticate,
    authorize([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR]),
    validate(updateDiagramSchema),
    async (req, res, next) => {
      try {
        logger.info('Updating diagram', { diagramId: req.params.id, userId: req.user?.id });
        const result = await diagramController.update(req, res, next);
        diagramOperationsCounter.inc({ operation: 'update', status: 'success' });
        return result;
      } catch (error) {
        diagramOperationsCounter.inc({ operation: 'update', status: 'error' });
        next(error);
      }
    }
  );

  // Delete diagram
  router.delete('/diagrams/:id',
    restrictedRateLimit,
    authenticate,
    authorize([UserRole.OWNER, UserRole.ADMIN]),
    async (req, res, next) => {
      try {
        logger.info('Deleting diagram', { diagramId: req.params.id, userId: req.user?.id });
        const result = await diagramController.delete(req, res, next);
        diagramOperationsCounter.inc({ operation: 'delete', status: 'success' });
        return result;
      } catch (error) {
        diagramOperationsCounter.inc({ operation: 'delete', status: 'error' });
        next(error);
      }
    }
  );

  // Get diagram by ID
  router.get('/diagrams/:id',
    standardRateLimit,
    authenticate,
    authorize([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER]),
    async (req, res, next) => {
      try {
        logger.info('Retrieving diagram', { diagramId: req.params.id, userId: req.user?.id });
        const result = await diagramController.getById(req, res, next);
        diagramOperationsCounter.inc({ operation: 'get', status: 'success' });
        return result;
      } catch (error) {
        diagramOperationsCounter.inc({ operation: 'get', status: 'error' });
        next(error);
      }
    }
  );

  // Get all diagrams for a project
  router.get('/projects/:projectId/diagrams',
    standardRateLimit,
    authenticate,
    authorize([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER]),
    async (req, res, next) => {
      try {
        logger.info('Retrieving project diagrams', { projectId: req.params.projectId, userId: req.user?.id });
        const result = await diagramController.getByProject(req, res, next);
        diagramOperationsCounter.inc({ operation: 'list', status: 'success' });
        return result;
      } catch (error) {
        diagramOperationsCounter.inc({ operation: 'list', status: 'error' });
        next(error);
      }
    }
  );

  // Metrics endpoint for monitoring
  router.get('/metrics',
    authenticate,
    authorize([UserRole.ADMIN]),
    async (_, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error('Error retrieving metrics', { error });
        res.status(500).end();
      }
    }
  );

  // Apply error handling middleware
  router.use(errorHandler);

  return router;
}

export default initializeDiagramRoutes;