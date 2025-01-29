import { Router } from 'express'; // v4.18.0
import ProjectController from '../controllers/project.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { validateCreateProject, validateUpdateProject } from '../validators/project.validator';
import { UserRole } from '../../core/interfaces/auth.interface';
import rateLimit from 'express-rate-limit'; // v7.1.0

// Base API path constant
const BASE_PATH = '/api/v1';

// Rate limiting configuration - 100 requests per minute
const projectRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per window
  message: 'Too many requests from this IP, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Configures and returns Express router with secured project endpoints
 * Implements CRUD operations with authentication, authorization, and validation
 */
const router = Router();

// Initialize ProjectController instance
const projectController = new ProjectController();

/**
 * GET /workspaces/:workspaceId/projects
 * Retrieves all projects in a workspace
 * Access: OWNER, ADMIN, EDITOR
 */
router.get(
  `${BASE_PATH}/workspaces/:workspaceId/projects`,
  projectRateLimiter,
  authenticate,
  authorize([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR]),
  projectController.getWorkspaceProjects
);

/**
 * POST /workspaces/:workspaceId/projects
 * Creates a new project in a workspace
 * Access: OWNER, ADMIN
 */
router.post(
  `${BASE_PATH}/workspaces/:workspaceId/projects`,
  projectRateLimiter,
  authenticate,
  authorize([UserRole.OWNER, UserRole.ADMIN]),
  validate(validateCreateProject, 'body'),
  projectController.createProject
);

/**
 * GET /projects/:projectId
 * Retrieves a specific project by ID
 * Access: OWNER, ADMIN, EDITOR
 */
router.get(
  `${BASE_PATH}/projects/:projectId`,
  projectRateLimiter,
  authenticate,
  authorize([UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR]),
  projectController.getProject
);

/**
 * PUT /projects/:projectId
 * Updates an existing project
 * Access: OWNER, ADMIN
 */
router.put(
  `${BASE_PATH}/projects/:projectId`,
  projectRateLimiter,
  authenticate,
  authorize([UserRole.OWNER, UserRole.ADMIN]),
  validate(validateUpdateProject, 'body'),
  projectController.updateProject
);

/**
 * DELETE /projects/:projectId
 * Deletes a project
 * Access: OWNER, ADMIN
 */
router.delete(
  `${BASE_PATH}/projects/:projectId`,
  projectRateLimiter,
  authenticate,
  authorize([UserRole.OWNER, UserRole.ADMIN]),
  projectController.deleteProject
);

// Export configured router
export default router;