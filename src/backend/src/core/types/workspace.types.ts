import { z } from 'zod'; // v3.22.0
import { IWorkspace, WorkspaceRole } from '../interfaces/workspace.interface';

// Constants for workspace validation
const WORKSPACE_NAME_MIN_LENGTH = 3;
const WORKSPACE_NAME_MAX_LENGTH = 50;
const WORKSPACE_MAX_PROJECTS = 100;
const WORKSPACE_MAX_MEMBERS = 25;

/**
 * Type definition for workspace metadata tracking
 * Contains operational metrics and usage statistics
 */
export type WorkspaceMetadata = {
  lastAccessed: Date;
  memberCount: number;
  projectCount: number;
};

/**
 * Type definition for workspace permission configuration
 * Maps roles to specific capabilities within a workspace
 */
export type WorkspacePermission = {
  role: WorkspaceRole;
  canInvite: boolean;
  canManageRoles: boolean;
};

/**
 * Zod schema for validating workspace settings
 * Enforces configuration constraints and data classification
 */
const workspaceSettingsSchema = z.object({
  defaultRole: z.nativeEnum(WorkspaceRole),
  allowPublicSharing: z.boolean(),
  enableVersionHistory: z.boolean(),
  maxProjects: z.number().min(1).max(WORKSPACE_MAX_PROJECTS),
  securityLevel: z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE', 'CRITICAL'])
});

/**
 * Zod schema for validating complete workspace data
 * Implements core workspace model validation
 */
export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
    .min(WORKSPACE_NAME_MIN_LENGTH, `Workspace name must be at least ${WORKSPACE_NAME_MIN_LENGTH} characters`)
    .max(WORKSPACE_NAME_MAX_LENGTH, `Workspace name cannot exceed ${WORKSPACE_NAME_MAX_LENGTH} characters`),
  ownerId: z.string().uuid(),
  settings: workspaceSettingsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.object({
    lastAccessed: z.date(),
    memberCount: z.number().min(1).max(WORKSPACE_MAX_MEMBERS),
    projectCount: z.number().min(0).max(WORKSPACE_MAX_PROJECTS)
  })
}).strict();

/**
 * Zod schema for workspace creation validation
 * Enforces required fields and constraints for new workspaces
 */
export const CreateWorkspaceSchema = z.object({
  name: z.string()
    .min(WORKSPACE_NAME_MIN_LENGTH, `Workspace name must be at least ${WORKSPACE_NAME_MIN_LENGTH} characters`)
    .max(WORKSPACE_NAME_MAX_LENGTH, `Workspace name cannot exceed ${WORKSPACE_NAME_MAX_LENGTH} characters`),
  settings: workspaceSettingsSchema.extend({
    defaultRole: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.VIEWER),
    allowPublicSharing: z.boolean().default(false),
    enableVersionHistory: z.boolean().default(true),
    maxProjects: z.number().min(1).max(WORKSPACE_MAX_PROJECTS).default(10),
    securityLevel: z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE', 'CRITICAL']).default('INTERNAL')
  })
}).strict();

/**
 * Zod schema for workspace update validation
 * Defines updateable fields and their constraints
 */
export const UpdateWorkspaceSchema = z.object({
  name: z.string()
    .min(WORKSPACE_NAME_MIN_LENGTH, `Workspace name must be at least ${WORKSPACE_NAME_MIN_LENGTH} characters`)
    .max(WORKSPACE_NAME_MAX_LENGTH, `Workspace name cannot exceed ${WORKSPACE_NAME_MAX_LENGTH} characters`)
    .optional(),
  settings: workspaceSettingsSchema.partial().optional()
}).strict();

// Type inference helpers for Zod schemas
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;