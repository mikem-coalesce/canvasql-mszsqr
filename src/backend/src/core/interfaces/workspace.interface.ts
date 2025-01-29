/**
 * Enum defining workspace access roles based on the authorization matrix
 * @version 1.0.0
 */
export enum WorkspaceRole {
  OWNER = 'OWNER',     // Full access including user management and admin functions
  ADMIN = 'ADMIN',     // Full access to workspace content and settings management
  EDITOR = 'EDITOR',   // Can edit workspace content but not manage settings
  VIEWER = 'VIEWER'    // Read-only access to workspace content
}

/**
 * Interface defining workspace configuration settings
 * Implements security and operational controls for workspaces
 */
export interface WorkspaceSettings {
  defaultRole: WorkspaceRole;        // Default role for new workspace members
  allowPublicSharing: boolean;       // Whether public sharing is enabled
  enableVersionHistory: boolean;     // Whether version history is tracked
  maxProjects: number;              // Maximum number of projects allowed
  securityLevel: string;            // Data classification level for the workspace
}

/**
 * Core workspace model interface matching database schema
 * Contains sensitive workspace metadata and configuration
 */
export interface IWorkspace {
  id: string;                      // Unique workspace identifier
  name: string;                    // Workspace display name
  ownerId: string;                 // User ID of workspace owner
  settings: WorkspaceSettings;     // Workspace configuration settings
  createdAt: Date;                // Workspace creation timestamp
  updatedAt: Date;                // Last modification timestamp
}

/**
 * Data transfer object for workspace creation
 * Defines required fields when creating a new workspace
 */
export interface ICreateWorkspaceDTO {
  name: string;                    // New workspace name
  settings: WorkspaceSettings;     // Initial workspace settings
}

/**
 * Data transfer object for workspace updates
 * Defines updateable workspace properties
 */
export interface IUpdateWorkspaceDTO {
  name?: string;                   // Updated workspace name (optional)
  settings?: WorkspaceSettings;    // Updated workspace settings (optional)
}

/**
 * Minimal project interface for workspace responses
 * Avoids circular dependency with full project interfaces
 */
export interface IWorkspaceProject {
  id: string;                      // Project identifier
  workspaceId: string;            // Parent workspace identifier
  name: string;                    // Project name
  lastModified: Date;             // Last modification timestamp
}

/**
 * Response interface for workspace operations
 * Includes associated projects and user role information
 */
export interface IWorkspaceResponse {
  workspace: IWorkspace;           // Workspace details
  projects: IWorkspaceProject[];   // Associated projects
  userRole: WorkspaceRole;        // Requesting user's role
}

/**
 * Service interface defining workspace management operations
 * Implements core workspace business logic contracts
 */
export interface IWorkspaceService {
  /**
   * Creates a new workspace
   * @param userId - ID of the creating user
   * @param data - Workspace creation DTO
   * @returns Promise resolving to workspace response
   */
  create(userId: string, data: ICreateWorkspaceDTO): Promise<IWorkspaceResponse>;

  /**
   * Updates an existing workspace
   * @param workspaceId - ID of workspace to update
   * @param data - Workspace update DTO
   * @returns Promise resolving to updated workspace response
   */
  update(workspaceId: string, data: IUpdateWorkspaceDTO): Promise<IWorkspaceResponse>;

  /**
   * Deletes a workspace
   * @param workspaceId - ID of workspace to delete
   * @returns Promise resolving when deletion is complete
   */
  delete(workspaceId: string): Promise<void>;

  /**
   * Retrieves workspace by ID
   * @param workspaceId - ID of workspace to find
   * @returns Promise resolving to workspace response
   */
  findById(workspaceId: string): Promise<IWorkspaceResponse>;

  /**
   * Finds all workspaces for a user
   * @param userId - ID of user to find workspaces for
   * @returns Promise resolving to array of workspace responses
   */
  findByUser(userId: string): Promise<IWorkspaceResponse[]>;

  /**
   * Updates a user's role in a workspace
   * @param workspaceId - ID of workspace
   * @param userId - ID of user
   * @param role - New role to assign
   * @returns Promise resolving when role is updated
   */
  updateUserRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;

  /**
   * Validates user access to a workspace
   * @param workspaceId - ID of workspace
   * @param userId - ID of user
   * @param requiredRole - Minimum required role
   * @returns Promise resolving to boolean indicating access
   */
  validateAccess(workspaceId: string, userId: string, requiredRole: WorkspaceRole): Promise<boolean>;
}