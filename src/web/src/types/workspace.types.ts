/**
 * Enum defining workspace access roles with strict hierarchy
 * Based on the Authorization Matrix from Security Considerations
 */
export enum WorkspaceRole {
    OWNER = 'OWNER',     // Full access including user management
    ADMIN = 'ADMIN',     // Full access except user management
    EDITOR = 'EDITOR',   // Can edit content but not manage settings
    VIEWER = 'VIEWER',   // Read-only access
    GUEST = 'GUEST'      // Limited access to shared resources
}

/**
 * Interface for workspace configuration and security settings
 * Implements security controls and compliance requirements
 */
export interface WorkspaceSettings {
    defaultRole: WorkspaceRole;        // Default role for new members
    allowPublicSharing: boolean;       // Controls public access capability
    enableVersionHistory: boolean;     // Enables version tracking
    requireMfa: boolean;               // Enforces MFA for workspace access
    maxProjects: number;              // Maximum allowed projects
    dataRetentionDays: number;        // Data retention policy in days
}

/**
 * Core workspace model interface with security tracking
 * Implements workspace organization and data classification requirements
 */
export interface Workspace {
    id: string;                       // UUID v4
    name: string;                     // Workspace display name
    ownerId: string;                  // UUID of workspace owner
    settings: WorkspaceSettings;      // Workspace configuration
    createdAt: Date;                  // Creation timestamp
    updatedAt: Date;                  // Last update timestamp
    lastAccessedAt: Date;             // Last access tracking
    securityLevel: string;            // Data classification level
}

/**
 * Project interface with security classification
 * Implements project-level security controls
 */
export interface WorkspaceProject {
    id: string;                       // UUID v4
    workspaceId: string;             // Parent workspace UUID
    name: string;                     // Project display name
    securityLevel: string;            // Project security classification
}

/**
 * Interface for Zustand workspace store state with role tracking
 * Implements state management for workspace context
 */
export interface WorkspaceState {
    workspaces: Workspace[];          // Available workspaces
    currentWorkspace: Workspace | null; // Active workspace
    loading: boolean;                 // Loading state flag
    error: string | null;             // Error state
    userRole: WorkspaceRole;          // Current user's role
}

/**
 * Data transfer object for secure workspace creation
 * Implements secure workspace initialization
 */
export interface CreateWorkspaceDTO {
    name: string;                     // New workspace name
    settings: WorkspaceSettings;      // Initial settings
    securityLevel: string;            // Security classification
}

/**
 * Data transfer object for secure workspace updates
 * Implements secure workspace modifications
 */
export interface UpdateWorkspaceDTO {
    name: string;                     // Updated workspace name
    settings: WorkspaceSettings;      // Modified settings
    securityLevel: string;            // Updated security level
}

/**
 * Response interface for workspace API operations with role information
 * Implements complete workspace context for frontend
 */
export interface WorkspaceResponse {
    workspace: Workspace;             // Workspace details
    projects: WorkspaceProject[];     // Associated projects
    userRole: WorkspaceRole;          // User's role in workspace
}