/**
 * @fileoverview Service class for secure workspace operations with role-based access control
 * and data classification. Implements workspace organization features and security controls.
 * @version 1.0.0
 */

import APIService from './api.service';
import type {
  Workspace,
  WorkspaceSettings,
  WorkspaceRole,
  CreateWorkspaceDTO,
  UpdateWorkspaceDTO,
  WorkspaceResponse,
  WorkspaceProject
} from '../types/workspace.types';

/**
 * Service class implementing secure workspace operations with RBAC
 */
export class WorkspaceService {
  private readonly apiService: APIService;
  private readonly baseUrl: string;
  private readonly requestTimeout: number;
  private readonly currentUserRole: WorkspaceRole;

  /**
   * Initializes workspace service with security context
   */
  constructor(apiService: APIService, userRole: WorkspaceRole) {
    this.apiService = apiService;
    this.baseUrl = '/api/workspaces';
    this.requestTimeout = 30000;
    this.currentUserRole = userRole;
  }

  /**
   * Retrieves all workspaces with role-based filtering
   */
  public async getAllWorkspaces(): Promise<WorkspaceResponse[]> {
    try {
      const response = await this.apiService.get<WorkspaceResponse[]>(
        this.baseUrl,
        undefined,
        {
          headers: {
            'X-User-Role': this.currentUserRole,
            'X-Security-Context': 'workspace-list'
          },
          timeout: this.requestTimeout
        }
      );

      // Apply role-based filtering
      return response.data.filter(workspace => 
        this.hasReadAccess(workspace.userRole));
    } catch (error) {
      console.error('[WorkspaceService] Get all workspaces failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific workspace with security validation
   */
  public async getWorkspaceById(id: string): Promise<WorkspaceResponse> {
    try {
      const response = await this.apiService.get<WorkspaceResponse>(
        `${this.baseUrl}/${id}`,
        undefined,
        {
          headers: {
            'X-User-Role': this.currentUserRole,
            'X-Security-Context': 'workspace-detail'
          },
          timeout: this.requestTimeout
        }
      );

      if (!this.hasReadAccess(response.data.userRole)) {
        throw new Error('Insufficient permissions to access workspace');
      }

      return response.data;
    } catch (error) {
      console.error('[WorkspaceService] Get workspace failed:', error);
      throw error;
    }
  }

  /**
   * Creates a new workspace with security validation
   */
  public async createWorkspace(data: CreateWorkspaceDTO): Promise<WorkspaceResponse> {
    if (!this.canCreateWorkspace()) {
      throw new Error('Insufficient permissions to create workspace');
    }

    try {
      // Apply security defaults
      const secureData: CreateWorkspaceDTO = {
        ...data,
        settings: {
          ...data.settings,
          requireMfa: true,
          dataRetentionDays: 90,
          allowPublicSharing: false
        }
      };

      const response = await this.apiService.post<CreateWorkspaceDTO, WorkspaceResponse>(
        this.baseUrl,
        secureData,
        {
          headers: {
            'X-User-Role': this.currentUserRole,
            'X-Security-Context': 'workspace-create'
          },
          timeout: this.requestTimeout
        }
      );

      return response.data;
    } catch (error) {
      console.error('[WorkspaceService] Create workspace failed:', error);
      throw error;
    }
  }

  /**
   * Updates a workspace with role validation
   */
  public async updateWorkspace(
    id: string,
    data: UpdateWorkspaceDTO
  ): Promise<WorkspaceResponse> {
    try {
      const workspace = await this.getWorkspaceById(id);

      if (!this.canUpdateWorkspace(workspace.userRole)) {
        throw new Error('Insufficient permissions to update workspace');
      }

      const response = await this.apiService.put<UpdateWorkspaceDTO, WorkspaceResponse>(
        `${this.baseUrl}/${id}`,
        data,
        {
          headers: {
            'X-User-Role': this.currentUserRole,
            'X-Security-Context': 'workspace-update'
          },
          timeout: this.requestTimeout
        }
      );

      return response.data;
    } catch (error) {
      console.error('[WorkspaceService] Update workspace failed:', error);
      throw error;
    }
  }

  /**
   * Deletes a workspace with security verification
   */
  public async deleteWorkspace(id: string): Promise<void> {
    try {
      const workspace = await this.getWorkspaceById(id);

      if (!this.canDeleteWorkspace(workspace.userRole)) {
        throw new Error('Insufficient permissions to delete workspace');
      }

      await this.apiService.delete(
        `${this.baseUrl}/${id}`,
        {
          headers: {
            'X-User-Role': this.currentUserRole,
            'X-Security-Context': 'workspace-delete'
          },
          timeout: this.requestTimeout
        }
      );
    } catch (error) {
      console.error('[WorkspaceService] Delete workspace failed:', error);
      throw error;
    }
  }

  /**
   * Checks if user has read access based on role
   */
  private hasReadAccess(resourceRole: WorkspaceRole): boolean {
    const roleHierarchy: Record<WorkspaceRole, number> = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.EDITOR]: 2,
      [WorkspaceRole.VIEWER]: 1,
      [WorkspaceRole.GUEST]: 0
    };

    return roleHierarchy[this.currentUserRole] >= roleHierarchy[resourceRole];
  }

  /**
   * Validates workspace creation permissions
   */
  private canCreateWorkspace(): boolean {
    return [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN
    ].includes(this.currentUserRole);
  }

  /**
   * Validates workspace update permissions
   */
  private canUpdateWorkspace(resourceRole: WorkspaceRole): boolean {
    if (this.currentUserRole === WorkspaceRole.OWNER) return true;
    if (this.currentUserRole === WorkspaceRole.ADMIN) {
      return resourceRole !== WorkspaceRole.OWNER;
    }
    return false;
  }

  /**
   * Validates workspace deletion permissions
   */
  private canDeleteWorkspace(resourceRole: WorkspaceRole): boolean {
    if (this.currentUserRole === WorkspaceRole.OWNER) return true;
    if (this.currentUserRole === WorkspaceRole.ADMIN) {
      return resourceRole !== WorkspaceRole.OWNER;
    }
    return false;
  }
}

export default WorkspaceService;