import { injectable } from 'tsyringe';
import { PrismaClient, Prisma } from '@prisma/client';
import { Logger } from 'winston';
import {
  IWorkspaceService,
  IWorkspace,
  ICreateWorkspaceDTO,
  IUpdateWorkspaceDTO,
  IWorkspaceResponse,
  WorkspaceRole,
  WorkspaceSettings
} from '../core/interfaces/workspace.interface';
import APIError from '../core/errors/APIError';

@injectable()
export class WorkspaceService implements IWorkspaceService {
  private readonly defaultSettings: WorkspaceSettings = {
    defaultRole: WorkspaceRole.VIEWER,
    allowPublicSharing: false,
    enableVersionHistory: true,
    maxProjects: 10,
    securityLevel: 'standard'
  };

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {}

  /**
   * Creates a new workspace with default settings and owner role assignment
   * @param userId - ID of the creating user
   * @param data - Workspace creation data
   * @returns Promise resolving to created workspace response
   */
  async create(
    userId: string,
    data: ICreateWorkspaceDTO
  ): Promise<IWorkspaceResponse> {
    this.logger.info('Creating new workspace', { userId, workspaceName: data.name });

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Create workspace with merged settings
        const workspace = await tx.workspace.create({
          data: {
            name: data.name,
            ownerId: userId,
            settings: {
              ...this.defaultSettings,
              ...data.settings
            },
            roles: {
              create: {
                userId,
                role: WorkspaceRole.OWNER
              }
            }
          }
        });

        // Create default project
        const defaultProject = await tx.project.create({
          data: {
            name: 'Default Project',
            workspaceId: workspace.id,
            createdById: userId
          }
        });

        this.logger.info('Workspace created successfully', { 
          workspaceId: workspace.id,
          defaultProjectId: defaultProject.id 
        });

        return {
          workspace,
          projects: [defaultProject],
          userRole: WorkspaceRole.OWNER
        };
      });
    } catch (error) {
      this.logger.error('Failed to create workspace', { error, userId });
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw APIError.badRequest('Failed to create workspace', { cause: error.message });
      }
      throw error;
    }
  }

  /**
   * Updates an existing workspace with role-based access control
   * @param workspaceId - ID of workspace to update
   * @param userId - ID of user performing update
   * @param data - Update data
   * @returns Promise resolving to updated workspace response
   */
  async update(
    workspaceId: string,
    userId: string,
    data: IUpdateWorkspaceDTO
  ): Promise<IWorkspaceResponse> {
    this.logger.info('Updating workspace', { workspaceId, userId });

    try {
      // Verify access rights
      const hasAccess = await this.validateAccess(workspaceId, userId, WorkspaceRole.ADMIN);
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient permissions to update workspace');
      }

      return await this.prisma.$transaction(async (tx) => {
        // Update workspace
        const workspace = await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            name: data.name,
            settings: data.settings ? {
              ...this.defaultSettings,
              ...data.settings
            } : undefined
          }
        });

        // Get associated projects
        const projects = await tx.project.findMany({
          where: { workspaceId }
        });

        const userRole = await this.getUserRole(workspaceId, userId);

        return { workspace, projects, userRole };
      });
    } catch (error) {
      this.logger.error('Failed to update workspace', { error, workspaceId });
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw APIError.badRequest('Failed to update workspace', { cause: error.message });
      }
      throw error;
    }
  }

  /**
   * Deletes a workspace and all associated data
   * @param workspaceId - ID of workspace to delete
   * @param userId - ID of user performing deletion
   */
  async delete(workspaceId: string, userId: string): Promise<void> {
    this.logger.info('Deleting workspace', { workspaceId, userId });

    try {
      // Verify owner access
      const hasAccess = await this.validateAccess(workspaceId, userId, WorkspaceRole.OWNER);
      if (!hasAccess) {
        throw APIError.forbidden('Only workspace owner can delete workspace');
      }

      await this.prisma.$transaction(async (tx) => {
        // Delete all associated data
        await tx.project.deleteMany({ where: { workspaceId } });
        await tx.workspaceRole.deleteMany({ where: { workspaceId } });
        await tx.workspace.delete({ where: { id: workspaceId } });
      });

      this.logger.info('Workspace deleted successfully', { workspaceId });
    } catch (error) {
      this.logger.error('Failed to delete workspace', { error, workspaceId });
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw APIError.badRequest('Failed to delete workspace', { cause: error.message });
      }
      throw error;
    }
  }

  /**
   * Retrieves workspace by ID with access control
   * @param workspaceId - ID of workspace to find
   * @param userId - ID of requesting user
   * @returns Promise resolving to workspace response
   */
  async findById(
    workspaceId: string,
    userId: string
  ): Promise<IWorkspaceResponse> {
    this.logger.info('Finding workspace by ID', { workspaceId, userId });

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId }
      });

      if (!workspace) {
        throw APIError.notFound('Workspace not found');
      }

      // Verify access rights
      const hasAccess = await this.validateAccess(workspaceId, userId, WorkspaceRole.VIEWER);
      if (!hasAccess) {
        throw APIError.forbidden('No access to workspace');
      }

      const projects = await this.prisma.project.findMany({
        where: { workspaceId }
      });

      const userRole = await this.getUserRole(workspaceId, userId);

      return { workspace, projects, userRole };
    } catch (error) {
      this.logger.error('Failed to find workspace', { error, workspaceId });
      throw error;
    }
  }

  /**
   * Finds all workspaces accessible to a user
   * @param userId - ID of user to find workspaces for
   * @returns Promise resolving to array of workspace responses
   */
  async findByUser(userId: string): Promise<IWorkspaceResponse[]> {
    this.logger.info('Finding workspaces for user', { userId });

    try {
      const workspaceRoles = await this.prisma.workspaceRole.findMany({
        where: { userId },
        include: {
          workspace: true
        }
      });

      const workspaceResponses = await Promise.all(
        workspaceRoles.map(async (wr) => {
          const projects = await this.prisma.project.findMany({
            where: { workspaceId: wr.workspaceId }
          });

          return {
            workspace: wr.workspace,
            projects,
            userRole: wr.role as WorkspaceRole
          };
        })
      );

      return workspaceResponses;
    } catch (error) {
      this.logger.error('Failed to find user workspaces', { error, userId });
      throw error;
    }
  }

  /**
   * Updates a user's role in a workspace
   * @param workspaceId - ID of workspace
   * @param targetUserId - ID of user to update
   * @param role - New role to assign
   * @param requestingUserId - ID of user performing update
   */
  async updateUserRole(
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceRole,
    requestingUserId: string
  ): Promise<void> {
    this.logger.info('Updating user role', { workspaceId, targetUserId, role });

    try {
      // Verify admin/owner access
      const hasAccess = await this.validateAccess(workspaceId, requestingUserId, WorkspaceRole.ADMIN);
      if (!hasAccess) {
        throw APIError.forbidden('Insufficient permissions to update roles');
      }

      // Prevent owner role reassignment
      const currentRole = await this.getUserRole(workspaceId, targetUserId);
      if (currentRole === WorkspaceRole.OWNER) {
        throw APIError.forbidden('Cannot modify workspace owner role');
      }

      await this.prisma.workspaceRole.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: targetUserId
          }
        },
        update: { role },
        create: {
          workspaceId,
          userId: targetUserId,
          role
        }
      });

      this.logger.info('User role updated successfully', { workspaceId, targetUserId, role });
    } catch (error) {
      this.logger.error('Failed to update user role', { error, workspaceId, targetUserId });
      throw error;
    }
  }

  /**
   * Validates user access to a workspace
   * @param workspaceId - ID of workspace
   * @param userId - ID of user
   * @param requiredRole - Minimum required role
   * @returns Promise resolving to boolean indicating access
   */
  async validateAccess(
    workspaceId: string,
    userId: string,
    requiredRole: WorkspaceRole
  ): Promise<boolean> {
    const userRole = await this.getUserRole(workspaceId, userId);
    if (!userRole) return false;

    const roleHierarchy = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.EDITOR]: 2,
      [WorkspaceRole.VIEWER]: 1
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Gets a user's role in a workspace
   * @param workspaceId - ID of workspace
   * @param userId - ID of user
   * @returns Promise resolving to user's role
   */
  private async getUserRole(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceRole | null> {
    const roleAssignment = await this.prisma.workspaceRole.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      }
    });

    return roleAssignment?.role as WorkspaceRole ?? null;
  }
}