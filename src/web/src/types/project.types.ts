// @ts-check
import { z } from 'zod'; // v3.22.0 - Runtime type validation
import { Workspace } from './workspace.types';
import { DiagramState } from './diagram.types';

/**
 * Security classification levels for project data
 * Based on Data Classification from Security Considerations
 */
export enum SecurityLevel {
  PUBLIC = 'PUBLIC',         // Public documentation
  INTERNAL = 'INTERNAL',     // Internal project data
  SENSITIVE = 'SENSITIVE',   // SQL schemas, ERD data
  CRITICAL = 'CRITICAL'      // Security-critical configurations
}

/**
 * Supported SQL dialects in the system
 * Based on Supported SQL Dialects from Technical Specifications
 */
export enum SQLDialect {
  POSTGRESQL = 'POSTGRESQL',  // PostgreSQL 12+
  SNOWFLAKE = 'SNOWFLAKE'    // Current Snowflake
}

/**
 * Project metadata interface with configuration and compliance features
 */
export interface ProjectMetadata {
  sqlDialect: SQLDialect;           // Database dialect setting
  defaultLayout: string;            // Default ERD layout configuration
  tags: string[];                   // Project classification tags
  versionHistory: boolean;          // Version tracking enabled flag
  auditEnabled: boolean;            // Audit logging enabled flag
}

/**
 * Core project interface with security and audit features
 * Implements project management and data classification requirements
 */
export interface Project {
  id: string;                       // UUID v4
  workspaceId: string;             // Parent workspace UUID
  name: string;                     // Project display name
  description: string;              // Project description
  metadata: ProjectMetadata;        // Project configuration
  createdAt: Date;                 // Creation timestamp
  securityLevel: SecurityLevel;     // Security classification
  lastModifiedBy: string;          // Last modifier's UUID
  lastModifiedAt: Date;            // Last modification timestamp
}

/**
 * Zod schema for project validation including security constraints
 * Implements comprehensive validation for project data structures
 */
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name cannot exceed 100 characters'),
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters'),
  metadata: z.object({
    sqlDialect: z.nativeEnum(SQLDialect),
    defaultLayout: z.string(),
    tags: z.array(z.string()),
    versionHistory: z.boolean(),
    auditEnabled: z.boolean()
  }),
  createdAt: z.date(),
  securityLevel: z.nativeEnum(SecurityLevel),
  lastModifiedBy: z.string().uuid(),
  lastModifiedAt: z.date()
});

/**
 * Project creation DTO with security validation
 */
export interface CreateProjectDTO {
  name: string;
  description: string;
  workspaceId: string;
  metadata: ProjectMetadata;
  securityLevel: SecurityLevel;
}

/**
 * Project update DTO with security validation
 */
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  metadata?: Partial<ProjectMetadata>;
  securityLevel?: SecurityLevel;
}

/**
 * Project response interface with associated diagrams
 */
export interface ProjectResponse {
  project: Project;
  diagrams: DiagramState[];
  workspace: Workspace;
}

/**
 * Project audit log entry interface
 */
export interface ProjectAuditLog {
  id: string;
  projectId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS';
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Project version history entry interface
 */
export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  changes: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  metadata: {
    securityLevel: SecurityLevel;
    comment: string;
  };
}