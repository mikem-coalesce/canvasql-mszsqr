import { Request, Response } from 'express'; // v4.18.0
import { AuthUtils } from '@auth/utils'; // v1.0.0
import ProjectService from '../../services/project.service';
import { validateCreateProject, validateUpdateProject } from '../validators/project.validator';
import APIError from '../../core/errors/APIError';
import { WorkspaceRole } from '../../core/interfaces/workspace.interface';
import { IProject, ICreateProjectDTO, IUpdateProjectDTO } from '../../core/interfaces/project.interface';

/**
 * Controller class handling project-related HTTP requests with comprehensive
 * security, validation, and error handling capabilities.
 */
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly authUtils: AuthUtils
  ) {}

  /**
   * Creates a new project with enhanced validation and authorization
   * @param req Express request object containing project data
   * @param res Express response object
   * @returns Promise resolving to HTTP response
   */
  async createProject(req: Request, res: Response): Promise<Response> {
    try {
      // Validate user authentication
      const userId = this.authUtils.getUserIdFromToken(req);
      if (!userId) {
        throw APIError.unauthorized('Authentication required');
      }

      // Validate workspace access
      const { workspaceId } = req.body;
      const hasAccess = await this.authUtils.validateWorkspaceAccess(
        workspaceId,
        userId,
        WorkspaceRole.EDITOR
      );
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient workspace permissions');
      }

      // Validate request data
      const validatedData = await validateCreateProject(req.body);

      // Create project
      const project = await this.projectService.create(validatedData);

      // Return success response
      return res.status(201).json({
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internalServer('Failed to create project', { error });
    }
  }

  /**
   * Updates an existing project with validation and access control
   * @param req Express request object containing update data
   * @param res Express response object
   * @returns Promise resolving to HTTP response
   */
  async updateProject(req: Request, res: Response): Promise<Response> {
    try {
      // Validate user authentication
      const userId = this.authUtils.getUserIdFromToken(req);
      if (!userId) {
        throw APIError.unauthorized('Authentication required');
      }

      const projectId = req.params.id;

      // Check project existence
      const existingProject = await this.projectService.findById(projectId);
      if (!existingProject) {
        throw APIError.notFound('Project not found');
      }

      // Validate workspace access
      const hasAccess = await this.authUtils.validateWorkspaceAccess(
        existingProject.workspaceId,
        userId,
        WorkspaceRole.EDITOR
      );
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient project permissions');
      }

      // Validate update data
      const validatedData = await validateUpdateProject(req.body);

      // Update project
      const updatedProject = await this.projectService.update(projectId, validatedData);

      // Return success response
      return res.status(200).json({
        message: 'Project updated successfully',
        data: updatedProject
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internalServer('Failed to update project', { error });
    }
  }

  /**
   * Deletes a project with proper authorization checks
   * @param req Express request object
   * @param res Express response object
   * @returns Promise resolving to HTTP response
   */
  async deleteProject(req: Request, res: Response): Promise<Response> {
    try {
      // Validate user authentication
      const userId = this.authUtils.getUserIdFromToken(req);
      if (!userId) {
        throw APIError.unauthorized('Authentication required');
      }

      const projectId = req.params.id;

      // Check project existence
      const project = await this.projectService.findById(projectId);
      if (!project) {
        throw APIError.notFound('Project not found');
      }

      // Validate workspace access with admin rights
      const hasAccess = await this.authUtils.validateWorkspaceAccess(
        project.workspaceId,
        userId,
        WorkspaceRole.ADMIN
      );
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient permissions to delete project');
      }

      // Delete project
      await this.projectService.delete(projectId);

      // Return success response
      return res.status(204).send();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internalServer('Failed to delete project', { error });
    }
  }

  /**
   * Retrieves project details with access control
   * @param req Express request object
   * @param res Express response object
   * @returns Promise resolving to HTTP response
   */
  async getProject(req: Request, res: Response): Promise<Response> {
    try {
      // Validate user authentication
      const userId = this.authUtils.getUserIdFromToken(req);
      if (!userId) {
        throw APIError.unauthorized('Authentication required');
      }

      const projectId = req.params.id;

      // Get project with access check
      const project = await this.projectService.findById(projectId);
      if (!project) {
        throw APIError.notFound('Project not found');
      }

      // Validate workspace access
      const hasAccess = await this.authUtils.validateWorkspaceAccess(
        project.workspaceId,
        userId,
        WorkspaceRole.VIEWER
      );
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient permissions to view project');
      }

      // Return success response
      return res.status(200).json({
        data: project
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internalServer('Failed to retrieve project', { error });
    }
  }

  /**
   * Retrieves all projects in a workspace with authorization
   * @param req Express request object
   * @param res Express response object
   * @returns Promise resolving to HTTP response
   */
  async getWorkspaceProjects(req: Request, res: Response): Promise<Response> {
    try {
      // Validate user authentication
      const userId = this.authUtils.getUserIdFromToken(req);
      if (!userId) {
        throw APIError.unauthorized('Authentication required');
      }

      const { workspaceId } = req.params;

      // Validate workspace access
      const hasAccess = await this.authUtils.validateWorkspaceAccess(
        workspaceId,
        userId,
        WorkspaceRole.VIEWER
      );
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient workspace permissions');
      }

      // Get workspace projects
      const projects = await this.projectService.findByWorkspace(workspaceId);

      // Return success response
      return res.status(200).json({
        data: projects
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internalServer('Failed to retrieve workspace projects', { error });
    }
  }
}

export default ProjectController;