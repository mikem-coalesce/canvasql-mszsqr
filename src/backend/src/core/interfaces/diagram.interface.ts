import { IProject } from './project.interface';
import { Prisma } from '@prisma/client'; // ^5.0.0

/**
 * Type definition for diagram node position and dimensions
 */
interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Type definition for diagram node representing a database table
 */
interface Node {
  id: string;
  type: 'table' | 'view';
  position: NodePosition;
  data: {
    name: string;
    columns: Array<{
      name: string;
      type: string;
      isPrimary: boolean;
      isForeign: boolean;
      isNullable: boolean;
      references?: {
        table: string;
        column: string;
      };
    }>;
  };
}

/**
 * Type definition for diagram edge representing table relationships
 */
interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  data?: {
    constraintName?: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

/**
 * Type definition for diagram viewport state
 */
interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Type definition for complete diagram layout
 */
export type DiagramLayout = {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
};

/**
 * Core diagram model interface matching Prisma schema
 */
export interface IDiagram {
  id: string;
  projectId: string;
  name: string;
  sqlDDL: string;
  layout: DiagramLayout;
  annotations: Record<string, any>;
  lastModified: Date;
}

/**
 * Data transfer object for diagram creation
 */
export interface ICreateDiagramDTO {
  projectId: string;
  name: string;
  sqlDDL: string;
}

/**
 * Data transfer object for diagram updates
 */
export interface IUpdateDiagramDTO {
  name?: string;
  sqlDDL?: string;
  layout?: DiagramLayout;
  annotations?: Record<string, any>;
}

/**
 * Response interface for diagram operations including computed fields
 */
export interface IDiagramResponse {
  id: string;
  projectId: string;
  name: string;
  sqlDDL: string;
  layout: DiagramLayout;
  annotations: Record<string, any>;
  lastModified: string;
  versionCount: number;
}

/**
 * Service interface defining diagram management operations
 */
export interface IDiagramService {
  /**
   * Creates a new diagram
   * @param userId - ID of the creating user
   * @param data - Diagram creation DTO
   * @returns Promise resolving to diagram response
   */
  create(userId: string, data: ICreateDiagramDTO): Promise<IDiagramResponse>;

  /**
   * Updates an existing diagram
   * @param diagramId - ID of diagram to update
   * @param userId - ID of the updating user
   * @param data - Diagram update DTO
   * @returns Promise resolving to updated diagram response
   */
  update(diagramId: string, userId: string, data: IUpdateDiagramDTO): Promise<IDiagramResponse>;

  /**
   * Deletes a diagram
   * @param diagramId - ID of diagram to delete
   * @param userId - ID of the deleting user
   * @returns Promise resolving when deletion is complete
   */
  delete(diagramId: string, userId: string): Promise<void>;

  /**
   * Retrieves diagram by ID
   * @param diagramId - ID of diagram to find
   * @param userId - ID of requesting user
   * @returns Promise resolving to diagram response
   */
  findById(diagramId: string, userId: string): Promise<IDiagramResponse>;

  /**
   * Finds all diagrams in a project
   * @param projectId - ID of project to find diagrams for
   * @param userId - ID of requesting user
   * @returns Promise resolving to array of diagram responses
   */
  findByProject(projectId: string, userId: string): Promise<IDiagramResponse[]>;

  /**
   * Parses SQL DDL into diagram structure
   * @param sql - SQL DDL to parse
   * @returns Promise resolving to diagram layout
   */
  parseSQL(sql: string): Promise<DiagramLayout>;

  /**
   * Generates automatic layout for diagram nodes
   * @param layout - Current diagram layout
   * @returns Promise resolving to optimized layout
   */
  generateLayout(layout: DiagramLayout): Promise<DiagramLayout>;
}