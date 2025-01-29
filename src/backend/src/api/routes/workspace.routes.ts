import { Router } from 'express'; // ^4.17.1
import { rateLimit } from 'express-rate-limit'; // ^6.7.0
import createHttpError from 'http-errors'; // ^2.0.0

// Internal imports
import WorkspaceController from '../controllers/workspace.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createWorkspaceSchema, updateWorkspaceSchema } from '../validators/workspace.validator';
import { UserRole } from '../../core/interfaces/auth.interface';

/**
 * Configure workspace routes with security middleware and rate limiting
 * Implements role-based access control and request validation
 */
const router = Router();

// Rate limiting configurations
const standardLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const writeLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 50, // 50 write requests per window
  message: 'Too many write requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const deleteLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 delete requests per window
  message: 'Too many delete requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Initialize workspace controller
const workspaceController = new WorkspaceController();

/**
 * GET /workspaces
 * Retrieve all workspaces for authenticated user
 * Rate limit: 100 requests per minute
 */
router.get(
  '/workspaces',
  standardLimit,
  authenticate,
  async (req, res, next) => {
    try {
      const response = await workspaceController.getByUser(req, res);
      return response;
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /workspaces/:id
 * Retrieve specific workspace by ID with access control
 * Rate limit: 100 requests per minute
 */
router.get(
  '/workspaces/:id',
  standardLimit,
  authenticate,
  async (req, res, next) => {
    try {
      const response = await workspaceController.getById(req, res);
      return response;
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /workspaces
 * Create new workspace with validation
 * Requires OWNER or ADMIN role
 * Rate limit: 50 requests per minute
 */
router.post(
  '/workspaces',
  writeLimit,
  authenticate,
  validate(createWorkspaceSchema),
  authorize([UserRole.OWNER, UserRole.ADMIN]),
  async (req, res, next) => {
    try {
      const response = await workspaceController.create(req, res);
      return response;
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /workspaces/:id
 * Update existing workspace with validation
 * Requires OWNER or ADMIN role
 * Rate limit: 50 requests per minute
 */
router.put(
  '/workspaces/:id',
  writeLimit,
  authenticate,
  validate(updateWorkspaceSchema),
  authorize([UserRole.OWNER, UserRole.ADMIN]),
  async (req, res, next) => {
    try {
      const response = await workspaceController.update(req, res);
      return response;
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /workspaces/:id
 * Delete workspace with owner-only access
 * Requires OWNER role
 * Rate limit: 20 requests per minute
 */
router.delete(
  '/workspaces/:id',
  deleteLimit,
  authenticate,
  authorize([UserRole.OWNER]),
  async (req, res, next) => {
    try {
      const response = await workspaceController.delete(req, res);
      return response;
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Error handling middleware
 * Formats and logs errors before sending response
 */
router.use((error: any, req: any, res: any, next: any) => {
  console.error('Workspace Route Error:', error);

  if (error.isJoi || error.type === 'validation') {
    return res.status(400).json({
      status: 400,
      message: 'Validation Error',
      errors: error.details || error.message
    });
  }

  if (error instanceof createHttpError.HttpError) {
    return res.status(error.status).json({
      status: error.status,
      message: error.message
    });
  }

  return res.status(500).json({
    status: 500,
    message: 'Internal Server Error'
  });
});

export default router;