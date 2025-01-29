import { z } from 'zod'; // v3.22.0
import { IProject } from '../interfaces/project.interface';
import { WorkspaceRole } from '../interfaces/workspace.interface';

// Constants for validation rules
const PROJECT_NAME_MIN_LENGTH = 3;
const PROJECT_NAME_MAX_LENGTH = 50;
const PROJECT_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Type definition for project metadata
 * Contains additional configuration and tracking information
 */
export type ProjectMetadata = {
  lastModified: Date;      // Last modification timestamp
  version: number;         // Project version number
  tags: string[];         // Project categorization tags
};

/**
 * Type alias for project access roles
 * Inherits from workspace roles for consistency
 */
export type ProjectRole = {
  role: WorkspaceRole;    // User's role in the project context
};

/**
 * Zod schema for validating complete project data
 * Implements full validation rules for project entities
 */
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string()
    .min(PROJECT_NAME_MIN_LENGTH, `Project name must be at least ${PROJECT_NAME_MIN_LENGTH} characters`)
    .max(PROJECT_NAME_MAX_LENGTH, `Project name cannot exceed ${PROJECT_NAME_MAX_LENGTH} characters`),
  description: z.string()
    .max(PROJECT_DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`)
    .nullable(),
  metadata: z.object({
    lastModified: z.date(),
    version: z.number().int().positive(),
    tags: z.array(z.string())
  }),
  createdAt: z.date()
}).strict();

/**
 * Zod schema for project creation
 * Omits auto-generated fields like id and createdAt
 */
export const CreateProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string()
    .min(PROJECT_NAME_MIN_LENGTH, `Project name must be at least ${PROJECT_NAME_MIN_LENGTH} characters`)
    .max(PROJECT_NAME_MAX_LENGTH, `Project name cannot exceed ${PROJECT_NAME_MAX_LENGTH} characters`),
  description: z.string()
    .max(PROJECT_DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`)
    .nullable()
    .optional(),
  metadata: z.object({
    tags: z.array(z.string()).default([]),
    version: z.number().int().positive().default(1)
  })
}).strict();

/**
 * Zod schema for project updates
 * Makes all fields optional for partial updates
 */
export const UpdateProjectSchema = z.object({
  name: z.string()
    .min(PROJECT_NAME_MIN_LENGTH, `Project name must be at least ${PROJECT_NAME_MIN_LENGTH} characters`)
    .max(PROJECT_NAME_MAX_LENGTH, `Project name cannot exceed ${PROJECT_NAME_MAX_LENGTH} characters`)
    .optional(),
  description: z.string()
    .max(PROJECT_DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${PROJECT_DESCRIPTION_MAX_LENGTH} characters`)
    .nullable()
    .optional(),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    version: z.number().int().positive().optional()
  }).optional()
}).strict();

// Type inference helpers
export type Project = z.infer<typeof ProjectSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;