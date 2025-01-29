import { z } from 'zod'; // v3.22.0
import { validateSchema } from '../../core/utils/validation.util';
import { 
  ICreateProjectDTO, 
  IUpdateProjectDTO 
} from '../../core/interfaces/project.interface';
import { ProjectMetadata } from '../../core/types/project.types';

/**
 * Schema for validating project creation requests
 * Implements strict validation rules with security considerations
 */
const createProjectSchema = z.object({
  workspaceId: z.string()
    .uuid('Invalid workspace ID format')
    .min(1, 'Workspace ID is required'),
    
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name cannot exceed 100 characters')
    .regex(
      /^[a-zA-Z0-9-_\s]+$/, 
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .trim(),
    
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
    
  metadata: z.object({
    lastModified: z.date({
      required_error: 'Last modified date is required',
      invalid_type_error: 'Invalid last modified date'
    }),
    
    version: z.number()
      .int('Version must be an integer')
      .positive('Version must be positive'),
      
    tags: z.array(
      z.string()
        .max(50, 'Tag length cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Tags can only contain letters, numbers, hyphens, and underscores')
    )
      .max(10, 'Maximum of 10 tags allowed')
  })
}).strict();

/**
 * Schema for validating project update requests
 * Supports partial updates with the same validation rules as creation
 */
const updateProjectSchema = z.object({
  name: z.string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name cannot exceed 100 characters')
    .regex(
      /^[a-zA-Z0-9-_\s]+$/, 
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .trim()
    .optional(),
    
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
    
  metadata: z.object({
    lastModified: z.date({
      required_error: 'Last modified date is required',
      invalid_type_error: 'Invalid last modified date'
    }),
    
    version: z.number()
      .int('Version must be an integer')
      .positive('Version must be positive'),
      
    tags: z.array(
      z.string()
        .max(50, 'Tag length cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Tags can only contain letters, numbers, hyphens, and underscores')
    )
      .max(10, 'Maximum of 10 tags allowed')
  }).optional()
}).strict();

/**
 * Validates project creation request data
 * Implements comprehensive validation with security checks
 * @param data - Raw project creation data to validate
 * @returns Promise resolving to validated project creation data
 * @throws ValidationError if validation fails
 */
export async function validateCreateProject(data: unknown): Promise<ICreateProjectDTO> {
  // Validate against schema and return typed result
  return validateSchema(createProjectSchema, data);
}

/**
 * Validates project update request data
 * Supports partial updates with the same validation rules
 * @param data - Raw project update data to validate
 * @returns Promise resolving to validated project update data
 * @throws ValidationError if validation fails
 */
export async function validateUpdateProject(data: unknown): Promise<IUpdateProjectDTO> {
  // Validate against schema and return typed result
  return validateSchema(updateProjectSchema, data);
}