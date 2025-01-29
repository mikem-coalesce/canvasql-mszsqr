// @ts-check
import { Node, Edge, Viewport } from 'reactflow'; // v11.0.0 - React Flow types
import { z } from 'zod'; // v3.22.0 - Runtime type validation
import { 
  SQLDialect,
  Table,
  Relationship,
  ParsedDDL
} from '../types/sql.types';

/**
 * Complete diagram state including collaboration features
 */
export interface DiagramState {
  id: string;
  projectId: string;
  name: string;
  sqlDDL: string;
  dialect: SQLDialect;
  parsedDDL: ParsedDDL;
  layout: DiagramLayout;
  annotations: Record<string, any>;
  lastModified: string;
  version: number;
  collaborators: Array<{
    id: string;
    cursor: {
      x: number;
      y: number;
    };
  }>;
}

/**
 * Enhanced diagram layout with grid and snapping support
 */
export interface DiagramLayout {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewport: DiagramViewport;
  gridSize: number;
  snapToGrid: boolean;
}

/**
 * Enhanced node interface for table visualization
 */
export interface DiagramNode extends Node {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: Table;
  style?: Record<string, string | number>;
  selected?: boolean;
}

/**
 * Enhanced edge interface for relationship visualization
 */
export interface DiagramEdge extends Edge {
  id: string;
  source: string;
  target: string;
  data: Relationship;
  style?: Record<string, string | number>;
  animated?: boolean;
}

/**
 * Enhanced viewport interface with zoom constraints
 */
export interface DiagramViewport extends Viewport {
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

/**
 * Comprehensive Zod schema for runtime validation of diagram state
 */
export const DiagramSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  sqlDDL: z.string(),
  dialect: z.nativeEnum(SQLDialect),
  parsedDDL: z.lazy(() => z.object({
    tables: z.array(z.any()),
    relationships: z.array(z.any()),
    dialect: z.nativeEnum(SQLDialect),
    schemas: z.array(z.string()),
    metadata: z.object({
      version: z.string(),
      timestamp: z.string()
    })
  })),
  layout: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number()
      }),
      data: z.any(),
      style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      selected: z.boolean().optional()
    })),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      data: z.any(),
      style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      animated: z.boolean().optional()
    })),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
      minZoom: z.number(),
      maxZoom: z.number()
    }),
    gridSize: z.number().min(1).max(100),
    snapToGrid: z.boolean()
  }),
  annotations: z.record(z.string(), z.any()),
  lastModified: z.string().datetime(),
  version: z.number().int().positive(),
  collaborators: z.array(z.object({
    id: z.string().uuid(),
    cursor: z.object({
      x: z.number(),
      y: z.number()
    })
  }))
});