import { z } from 'zod'; // v3.22.0
import { IWorkspace } from './workspace.interface';

/**
 * Interface for project metadata containing additional project configuration
 * and operational settings
 */
export interface ProjectMetadata {
  tags: string[];                  // Project categorization tags
  databaseType: 'POSTGRESQL' | 'SNOWFLAKE'; // Supported database types
  lastSyncedAt?: Date;            // Last database sync timestamp
  isArchived: boolean;            // Project archive status
  customSettings: {               // Project-specific settings
    enableVersioning: boolean;    // Whether version history is enabled
    autoSave: boolean;           // Auto-save diagram changes
    exportFormat: string;        // Default export format
  };
}

/**
 * Minimal interface for diagram references within projects
 * Used to avoid circular dependencies with full diagram interfaces
 */
export interface DiagramReference {
  id: string;                    // Unique diagram identifier
  name: string;                  // Diagram display name
  projectId: string;            // Parent project identifier
}

/**
 * Core project model interface matching database schema
 * Contains project metadata and configuration
 */
export interface IProject {
  id: string;                    // Unique project identifier
  workspaceId: string;          // Parent workspace identifier
  name: string;                  // Project display name
  description: string;          // Project description
  metadata: ProjectMetadata;    // Project configuration metadata
  createdAt: Date;             // Project creation timestamp
}

/**
 * Data transfer object for project creation
 * Defines required fields when creating a new project
 */
export interface ICreateProjectDTO {
  workspaceId: string;          // Parent workspace identifier
  name: string;                 // New project name
  description: string;          // Project description
  metadata: ProjectMetadata;    // Initial project metadata
}

/**
 * Data transfer object for project updates
 * Defines updateable project properties
 */
export interface IUpdateProjectDTO {
  name?: string;                // Updated project name
  description?: string;         // Updated project description
  metadata?: ProjectMetadata;   // Updated project metadata
}

/**
 * Response interface for project operations
 * Includes associated diagrams and project details
 */
export interface IProjectResponse {
  project: IProject;            // Project details
  diagrams: DiagramReference[]; // Associated diagrams
}

/**
 * Service interface defining project management operations
 * Implements core project business logic contracts
 */
export interface IProjectService {
  /**
   * Creates a new project
   * @param userId - ID of the creating user
   * @param data - Project creation DTO
   * @returns Promise resolving to project response
   */
  create(userId: string, data: ICreateProjectDTO): Promise<IProjectResponse>;

  /**
   * Updates an existing project
   * @param projectId - ID of project to update
   * @param userId - ID of the updating user
   * @param data - Project update DTO
   * @returns Promise resolving to updated project response
   */
  update(projectId: string, userId: string, data: IUpdateProjectDTO): Promise<IProjectResponse>;

  /**
   * Deletes a project
   * @param projectId - ID of project to delete
   * @param userId - ID of the deleting user
   * @returns Promise resolving when deletion is complete
   */
  delete(projectId: string, userId: string): Promise<void>;

  /**
   * Retrieves project by ID
   * @param projectId - ID of project to find
   * @param userId - ID of requesting user
   * @returns Promise resolving to project response
   */
  findById(projectId: string, userId: string): Promise<IProjectResponse>;

  /**
   * Finds all projects in a workspace
   * @param workspaceId - ID of workspace to find projects for
   * @param userId - ID of requesting user
   * @returns Promise resolving to array of project responses
   */
  findByWorkspace(workspaceId: string, userId: string): Promise<IProjectResponse[]>;
}

/**
 * Zod schema for runtime validation of project data
 */
export const projectSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  metadata: z.object({
    tags: z.array(z.string()),
    databaseType: z.enum(['POSTGRESQL', 'SNOWFLAKE']),
    lastSyncedAt: z.date().optional(),
    isArchived: z.boolean(),
    customSettings: z.object({
      enableVersioning: z.boolean(),
      autoSave: z.boolean(),
      exportFormat: z.string()
    })
  }),
  createdAt: z.date()
});