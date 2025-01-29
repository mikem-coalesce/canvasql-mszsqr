import { z } from 'zod'; // v3.22.0
import { IDiagram } from '../interfaces/diagram.interface';

/**
 * Supported SQL dialects based on technical requirements
 */
export enum SQLDialect {
  POSTGRESQL = 'POSTGRESQL',
  SNOWFLAKE = 'SNOWFLAKE'
}

/**
 * Node types supported in the ERD visualization
 */
export enum NodeType {
  TABLE = 'table',
  VIEW = 'view'
}

/**
 * Edge types representing relationship cardinality
 */
export enum EdgeType {
  ONE_TO_ONE = 'one-to-one',
  ONE_TO_MANY = 'one-to-many',
  MANY_TO_MANY = 'many-to-many'
}

/**
 * Position and dimension information for diagram nodes
 */
export type Position = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Column definition with comprehensive SQL support
 */
export type Column = {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeign: boolean;
  isNullable: boolean;
  defaultValue?: string;
  description?: string;
  references?: {
    table: string;
    column: string;
  };
};

/**
 * Database constraint definition
 */
export type Constraint = {
  name: string;
  type: 'UNIQUE' | 'CHECK' | 'FOREIGN KEY';
  columns: string[];
  definition?: string;
};

/**
 * Database index definition
 */
export type Index = {
  name: string;
  columns: string[];
  isUnique: boolean;
  method?: 'BTREE' | 'HASH' | 'GIST';
};

/**
 * Node styling properties
 */
export type NodeStyle = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed';
  opacity: number;
};

/**
 * Edge styling properties
 */
export type EdgeStyle = {
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed';
  opacity: number;
  animated: boolean;
};

/**
 * Comprehensive node data structure
 */
export type NodeData = {
  name: string;
  columns: Column[];
  constraints: Constraint[];
  indices: Index[];
  description?: string;
  schema?: string;
  isTemporary?: boolean;
};

/**
 * Edge data containing relationship metadata
 */
export type EdgeData = {
  constraintName?: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  description?: string;
};

/**
 * Enhanced node type with styling support
 */
export type Node = {
  id: string;
  type: NodeType;
  position: Position;
  data: NodeData;
  style: NodeStyle;
  selected?: boolean;
  dragging?: boolean;
};

/**
 * Enhanced edge type with styling support
 */
export type Edge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: EdgeType;
  data: EdgeData;
  style: EdgeStyle;
  selected?: boolean;
};

/**
 * Viewport state for diagram canvas
 */
export type Viewport = {
  x: number;
  y: number;
  zoom: number;
  maxZoom?: number;
  minZoom?: number;
};

/**
 * Complete diagram state including version control
 */
export type DiagramState = {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  version: number;
  sqlDialect: SQLDialect;
  lastModified?: Date;
  annotations?: Record<string, any>;
};

/**
 * Zod validation schema for diagram data
 */
export const DiagramValidationSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().uuid(),
    type: z.nativeEnum(NodeType),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    data: z.object({
      name: z.string().min(1).max(100),
      columns: z.array(z.object({
        name: z.string().min(1),
        type: z.string(),
        isPrimary: z.boolean(),
        isForeign: z.boolean(),
        isNullable: z.boolean(),
        defaultValue: z.string().optional(),
        description: z.string().optional(),
        references: z.object({
          table: z.string(),
          column: z.string()
        }).optional()
      })),
      constraints: z.array(z.object({
        name: z.string(),
        type: z.enum(['UNIQUE', 'CHECK', 'FOREIGN KEY']),
        columns: z.array(z.string()),
        definition: z.string().optional()
      })),
      indices: z.array(z.object({
        name: z.string(),
        columns: z.array(z.string()),
        isUnique: z.boolean(),
        method: z.enum(['BTREE', 'HASH', 'GIST']).optional()
      })),
      description: z.string().optional(),
      schema: z.string().optional(),
      isTemporary: z.boolean().optional()
    }),
    style: z.object({
      backgroundColor: z.string(),
      borderColor: z.string(),
      borderWidth: z.number(),
      borderStyle: z.enum(['solid', 'dashed']),
      opacity: z.number()
    }),
    selected: z.boolean().optional(),
    dragging: z.boolean().optional()
  })),
  edges: z.array(z.object({
    id: z.string().uuid(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    type: z.nativeEnum(EdgeType),
    data: z.object({
      constraintName: z.string().optional(),
      onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional(),
      onUpdate: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional(),
      description: z.string().optional()
    }),
    style: z.object({
      strokeColor: z.string(),
      strokeWidth: z.number(),
      strokeStyle: z.enum(['solid', 'dashed']),
      opacity: z.number(),
      animated: z.boolean()
    }),
    selected: z.boolean().optional()
  })),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
    maxZoom: z.number().optional(),
    minZoom: z.number().optional()
  }),
  version: z.number(),
  sqlDialect: z.nativeEnum(SQLDialect),
  lastModified: z.date().optional(),
  annotations: z.record(z.any()).optional()
});