import { z } from 'zod'; // v3.22.0
import { validateSchema } from '../../core/utils/validation.util';
import { ICreateDiagramDTO, IUpdateDiagramDTO } from '../../core/interfaces/diagram.interface';

/**
 * Maximum allowed length for diagram names
 */
export const MAX_NAME_LENGTH = 100;

/**
 * Minimum required length for diagram names
 */
export const MIN_NAME_LENGTH = 3;

/**
 * Maximum allowed length for SQL DDL content
 */
export const MAX_SQL_LENGTH = 50000;

/**
 * Zod schema for validating diagram creation requests
 * Enforces strict validation rules for all required fields
 */
export const createDiagramSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  name: z.string()
    .min(MIN_NAME_LENGTH, `Diagram name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Diagram name must not exceed ${MAX_NAME_LENGTH} characters`)
    .trim()
    .regex(/^[\w\s-]+$/, 'Diagram name must contain only letters, numbers, spaces, and hyphens'),
  sqlDDL: z.string()
    .min(1, 'SQL DDL content is required')
    .max(MAX_SQL_LENGTH, `SQL DDL content must not exceed ${MAX_SQL_LENGTH} characters`)
    .trim()
    .refine(
      (sql) => !sql.match(/;.*;/), 
      'Multiple SQL statements are not allowed'
    )
});

/**
 * Zod schema for validating diagram node position
 */
const nodePositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

/**
 * Zod schema for validating diagram nodes
 */
const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: nodePositionSchema
});

/**
 * Zod schema for validating diagram edges
 */
const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string()
});

/**
 * Zod schema for validating diagram viewport
 */
const viewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().positive()
});

/**
 * Zod schema for validating diagram layout
 */
const layoutSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  viewport: viewportSchema
});

/**
 * Zod schema for validating diagram update requests
 * All fields are optional but must meet validation rules if provided
 */
export const updateDiagramSchema = z.object({
  name: z.string()
    .min(MIN_NAME_LENGTH, `Diagram name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Diagram name must not exceed ${MAX_NAME_LENGTH} characters`)
    .trim()
    .regex(/^[\w\s-]+$/, 'Diagram name must contain only letters, numbers, spaces, and hyphens')
    .optional(),
  sqlDDL: z.string()
    .min(1, 'SQL DDL content is required')
    .max(MAX_SQL_LENGTH, `SQL DDL content must not exceed ${MAX_SQL_LENGTH} characters`)
    .trim()
    .refine(
      (sql) => !sql.match(/;.*;/), 
      'Multiple SQL statements are not allowed'
    )
    .optional(),
  layout: layoutSchema.optional(),
  annotations: z.record(z.string(), z.any())
    .refine(
      (obj) => Object.keys(obj).length <= 100,
      'Maximum of 100 annotations allowed'
    )
    .optional()
});

/**
 * Validates diagram creation request data
 * @param data - Request data to validate
 * @returns Promise resolving to validated diagram creation data
 * @throws ValidationError if validation fails
 */
export async function validateCreateDiagram(data: unknown): Promise<ICreateDiagramDTO> {
  return validateSchema(createDiagramSchema, data);
}

/**
 * Validates diagram update request data
 * @param data - Request data to validate
 * @returns Promise resolving to validated diagram update data
 * @throws ValidationError if validation fails
 */
export async function validateUpdateDiagram(data: unknown): Promise<IUpdateDiagramDTO> {
  return validateSchema(updateDiagramSchema, data);
}