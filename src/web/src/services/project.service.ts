/**
 * @fileoverview Service class for managing secure project-related operations with validation,
 * rate limiting, and audit logging.
 * @version 1.0.0
 */

import { debounce } from 'lodash'; // ^4.17.21
import APIService from './api.service';
import type {
  Project,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectResponse,
  SecurityLevel,
  ProjectAuditLog,
  ProjectVersion
} from '../types/project.types';

/**
 * Rate limit configuration for project operations
 */
const RATE_LIMIT_CONFIG = {
  GET: { window: 60000, limit: 100 },    // 100 requests per minute
  CREATE: { window: 300000, limit: 20 },  // 20 creates per 5 minutes
  UPDATE: { window: 60000, limit: 30 },   // 30 updates per minute
  DELETE: { window: 300000, limit: 10 }   // 10 deletes per 5 minutes
};

/**
 * Service class for managing secure project operations
 */
export class ProjectService {
  private readonly apiService: APIService;
  private readonly baseUrl: string;
  private readonly requestTimeout: number;
  private readonly maxRetries: number;
  private readonly rateLimitMap: Map<string, { count: number; timestamp: number }>;

  constructor() {
    this.apiService = new APIService();
    this.baseUrl = '/api/projects';
    this.requestTimeout = 30000;
    this.maxRetries = 3;
    this.rateLimitMap = new Map();
  }

  /**
   * Checks rate limit for a specific operation
   */
  private checkRateLimit(operation: keyof typeof RATE_LIMIT_CONFIG, key: string): boolean {
    const now = Date.now();
    const config = RATE_LIMIT_CONFIG[operation];
    const rateKey = `${operation}_${key}`;
    const limit = this.rateLimitMap.get(rateKey);

    if (!limit || (now - limit.timestamp) > config.window) {
      this.rateLimitMap.set(rateKey, { count: 1, timestamp: now });
      return true;
    }

    if (limit.count >= config.limit) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Creates audit log entry for project operations
   */
  private async createAuditLog(
    projectId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS',
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.apiService.post<ProjectAuditLog>(`${this.baseUrl}/${projectId}/audit`, {
        action,
        timestamp: new Date(),
        details
      });
    } catch (error) {
      console.error('Audit log creation failed:', error);
    }
  }

  /**
   * Retrieves all projects for a workspace with security validation
   */
  public async getProjects(workspaceId: string): Promise<Project[]> {
    if (!this.checkRateLimit('GET', workspaceId)) {
      throw new Error('Rate limit exceeded for project retrieval');
    }

    try {
      const response = await this.apiService.get<Project[]>(this.baseUrl, {
        workspaceId
      });

      await this.createAuditLog(workspaceId, 'ACCESS', {
        operation: 'LIST_PROJECTS',
        workspaceId
      });

      return response.data || [];
    } catch (error) {
      console.error('Failed to retrieve projects:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific project by ID with security validation
   */
  public async getProject(projectId: string): Promise<ProjectResponse> {
    if (!this.checkRateLimit('GET', projectId)) {
      throw new Error('Rate limit exceeded for project access');
    }

    try {
      const response = await this.apiService.get<ProjectResponse>(
        `${this.baseUrl}/${projectId}`
      );

      await this.createAuditLog(projectId, 'ACCESS', {
        operation: 'GET_PROJECT',
        projectId
      });

      return response.data!;
    } catch (error) {
      console.error('Failed to retrieve project:', error);
      throw error;
    }
  }

  /**
   * Creates a new project with security validation
   */
  public async createProject(projectData: CreateProjectDTO): Promise<Project> {
    if (!this.checkRateLimit('CREATE', projectData.workspaceId)) {
      throw new Error('Rate limit exceeded for project creation');
    }

    try {
      const response = await this.apiService.post<CreateProjectDTO, Project>(
        this.baseUrl,
        {
          ...projectData,
          securityLevel: projectData.securityLevel || SecurityLevel.INTERNAL
        }
      );

      await this.createAuditLog(response.data!.id, 'CREATE', {
        operation: 'CREATE_PROJECT',
        projectData
      });

      return response.data!;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Updates an existing project with security validation
   */
  public async updateProject(
    projectId: string,
    projectData: UpdateProjectDTO
  ): Promise<Project> {
    if (!this.checkRateLimit('UPDATE', projectId)) {
      throw new Error('Rate limit exceeded for project updates');
    }

    try {
      const response = await this.apiService.put<UpdateProjectDTO, Project>(
        `${this.baseUrl}/${projectId}`,
        projectData
      );

      await this.createAuditLog(projectId, 'UPDATE', {
        operation: 'UPDATE_PROJECT',
        projectData
      });

      return response.data!;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Deletes a project with security validation
   */
  public async deleteProject(projectId: string): Promise<void> {
    if (!this.checkRateLimit('DELETE', projectId)) {
      throw new Error('Rate limit exceeded for project deletion');
    }

    try {
      await this.apiService.delete(`${this.baseUrl}/${projectId}`);

      await this.createAuditLog(projectId, 'DELETE', {
        operation: 'DELETE_PROJECT'
      });
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Retrieves project version history with security validation
   */
  public async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    if (!this.checkRateLimit('GET', `${projectId}_versions`)) {
      throw new Error('Rate limit exceeded for version history access');
    }

    try {
      const response = await this.apiService.get<ProjectVersion[]>(
        `${this.baseUrl}/${projectId}/versions`
      );

      await this.createAuditLog(projectId, 'ACCESS', {
        operation: 'GET_VERSIONS'
      });

      return response.data || [];
    } catch (error) {
      console.error('Failed to retrieve project versions:', error);
      throw error;
    }
  }

  /**
   * Debounced project update to prevent rapid consecutive updates
   */
  public debouncedUpdateProject = debounce(
    async (projectId: string, projectData: UpdateProjectDTO): Promise<Project> => {
      return this.updateProject(projectId, projectData);
    },
    1000,
    { maxWait: 5000 }
  );
}

export default new ProjectService();