import { z } from 'zod'; // v3.22.0
import { validateSchema } from '../../core/utils/validation.util';
import { WorkspaceRole, ICreateWorkspaceDTO, IUpdateWorkspaceDTO } from '../../core/interfaces/workspace.interface';

/**
 * Schema for workspace settings validation with strict security controls
 * Enforces role-based access and operational limits
 */
const workspaceSettingsSchema = z.object({
  defaultRole: z.nativeEnum(WorkspaceRole)
    .default(WorkspaceRole.VIEWER)
    .describe('Default role for new workspace members'),
    
  allowPublicSharing: z.boolean()
    .default(false)
    .describe('Controls whether public sharing is enabled'),
    
  enableVersionHistory: z.boolean()
    .default(true)
    .describe('Controls version history tracking'),
    
  maxProjects: z.number()
    .int('Project limit must be a whole number')
    .min(1, 'Must allow at least 1 project')
    .max(100, 'Cannot exceed 100 projects')
    .default(10)
    .describe('Maximum number of allowed projects'),
    
  securityLevel: z.enum(['standard', 'high', 'enterprise'])
    .default('standard')
    .describe('Workspace security classification level')
}).strict();

/**
 * Schema for workspace creation requests
 * Implements comprehensive validation for new workspace data
 */
const createWorkspaceSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(500, 'Name cannot exceed 500 characters')
    .regex(
      /^[a-zA-Z0-9-_\s]+$/, 
      'Name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .trim()
    .describe('Workspace display name'),
    
  settings: workspaceSettingsSchema
    .describe('Workspace configuration settings')
}).strict();

/**
 * Schema for workspace update requests
 * Supports partial updates with the same validation rules
 */
const updateWorkspaceSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(500, 'Name cannot exceed 500 characters')
    .regex(
      /^[a-zA-Z0-9-_\s]+$/, 
      'Name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .trim()
    .optional()
    .describe('Updated workspace name'),
    
  settings: workspaceSettingsSchema
    .partial()
    .optional()
    .describe('Updated workspace settings')
}).strict();

/**
 * Validates workspace creation request data
 * Ensures data integrity and security compliance
 * 
 * @param data - Raw workspace creation data
 * @returns Promise resolving to validated workspace creation DTO
 * @throws ValidationError if validation fails
 */
export async function validateCreateWorkspace(data: unknown): Promise<ICreateWorkspaceDTO> {
  return validateSchema<ICreateWorkspaceDTO>(createWorkspaceSchema, data);
}

/**
 * Validates workspace update request data
 * Supports partial updates while maintaining data integrity
 * 
 * @param data - Raw workspace update data
 * @returns Promise resolving to validated workspace update DTO
 * @throws ValidationError if validation fails
 */
export async function validateUpdateWorkspace(data: unknown): Promise<IUpdateWorkspaceDTO> {
  return validateSchema<IUpdateWorkspaceDTO>(updateWorkspaceSchema, data);
}