import { Request, Response } from 'express'; // ^4.18.0
import { injectable } from 'tsyringe';
import WorkspaceService from '../../services/workspace.service';
import { validateCreateWorkspace, validateUpdateWorkspace } from '../validators/workspace.validator';
import APIError from '../../core/errors/APIError';
import { ValidationError } from '../../core/errors/ValidationError';
import { ICreateWorkspaceDTO, IUpdateWorkspaceDTO, WorkspaceRole } from '../../core/interfaces/workspace.interface';

@injectable()
export default class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Creates a new workspace with validated data and proper error handling
   * @param req Express request object containing workspace creation data
   * @param res Express response object
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      // Extract authenticated user ID from request
      const userId = req.user?.id;
      if (!userId) {
        throw APIError.forbidden('Authentication required');
      }

      // Validate request body
      const validatedData: ICreateWorkspaceDTO = await validateCreateWorkspace(req.body);

      // Create workspace using service
      const workspaceResponse = await this.workspaceService.create(userId, validatedData);

      // Return successful response
      return res.status(201).json({
        message: 'Workspace created successfully',
        data: workspaceResponse
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json(error.toJSON());
      }
      if (error instanceof APIError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      throw error;
    }
  }

  /**
   * Updates an existing workspace with validation and access control
   * @param req Express request object containing workspace update data
   * @param res Express response object
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      // Extract and validate workspace ID
      const workspaceId = req.params.id;
      if (!workspaceId) {
        throw APIError.badRequest('Workspace ID is required');
      }

      // Extract authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        throw APIError.forbidden('Authentication required');
      }

      // Validate request body
      const validatedData: IUpdateWorkspaceDTO = await validateUpdateWorkspace(req.body);

      // Verify user has admin access
      const hasAccess = await this.workspaceService.validateAccess(
        workspaceId,
        userId,
        WorkspaceRole.ADMIN
      );
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient permissions to update workspace');
      }

      // Update workspace using service
      const workspaceResponse = await this.workspaceService.update(
        workspaceId,
        userId,
        validatedData
      );

      // Return successful response
      return res.status(200).json({
        message: 'Workspace updated successfully',
        data: workspaceResponse
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json(error.toJSON());
      }
      if (error instanceof APIError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      throw error;
    }
  }

  /**
   * Deletes a workspace with owner-only access control
   * @param req Express request object containing workspace ID
   * @param res Express response object
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      // Extract and validate workspace ID
      const workspaceId = req.params.id;
      if (!workspaceId) {
        throw APIError.badRequest('Workspace ID is required');
      }

      // Extract authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        throw APIError.forbidden('Authentication required');
      }

      // Verify user has owner access
      const hasAccess = await this.workspaceService.validateAccess(
        workspaceId,
        userId,
        WorkspaceRole.OWNER
      );
      if (!hasAccess) {
        throw APIError.forbidden('Only workspace owner can delete workspace');
      }

      // Delete workspace using service
      await this.workspaceService.delete(workspaceId, userId);

      // Return successful response
      return res.status(204).send();
    } catch (error) {
      if (error instanceof APIError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      throw error;
    }
  }

  /**
   * Retrieves a workspace by ID with access control
   * @param req Express request object containing workspace ID
   * @param res Express response object
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      // Extract and validate workspace ID
      const workspaceId = req.params.id;
      if (!workspaceId) {
        throw APIError.badRequest('Workspace ID is required');
      }

      // Extract authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        throw APIError.forbidden('Authentication required');
      }

      // Verify user has at least viewer access
      const hasAccess = await this.workspaceService.validateAccess(
        workspaceId,
        userId,
        WorkspaceRole.VIEWER
      );
      if (!hasAccess) {
        throw APIError.forbidden('No access to workspace');
      }

      // Retrieve workspace using service
      const workspaceResponse = await this.workspaceService.findById(workspaceId, userId);

      // Return successful response
      return res.status(200).json({
        data: workspaceResponse
      });
    } catch (error) {
      if (error instanceof APIError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      throw error;
    }
  }

  /**
   * Retrieves all workspaces accessible to the authenticated user
   * @param req Express request object
   * @param res Express response object
   */
  async getByUser(req: Request, res: Response): Promise<Response> {
    try {
      // Extract authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        throw APIError.forbidden('Authentication required');
      }

      // Retrieve workspaces using service
      const workspaces = await this.workspaceService.findByUser(userId);

      // Return successful response
      return res.status(200).json({
        data: workspaces
      });
    } catch (error) {
      if (error instanceof APIError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      throw error;
    }
  }
}