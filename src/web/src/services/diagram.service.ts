import { Node, Edge, Position } from 'reactflow'; // v11.0.0
import { openDB } from 'idb'; // v7.0.0
import { DiagramState, DiagramLayout, ParsedDDL } from '../types/diagram.types';
import axiosInstance from '../lib/axios';
import YjsProvider from '../lib/yjs';
import { CollaborationEventType, UserPresence } from '../types/collaboration.types';
import { SQLDialect } from '../types/sql.types';

// API endpoints for diagram operations
const API_ENDPOINTS = {
  DIAGRAMS: '/api/diagrams',
  PARSE_SQL: '/api/diagrams/parse',
  EXPORT: '/api/diagrams/export',
  COLLABORATE: '/api/diagrams/collaborate'
};

// Configuration for offline storage
const OFFLINE_DB_CONFIG = {
  name: 'erd-tool-offline',
  version: 1,
  stores: {
    diagrams: 'id, projectId, lastModified'
  }
};

/**
 * Service class for managing diagram operations with offline support and real-time collaboration
 */
export class DiagramService {
  private provider: YjsProvider;
  private currentDiagramId: string | null = null;
  private offlineDB: Promise<IDBDatabase>;
  private retryCount: number = 0;
  private readonly maxRetries: number = 3;

  constructor() {
    // Initialize IndexedDB for offline storage
    this.offlineDB = this.initOfflineStorage();
    
    // Initialize Y.js provider without connection
    this.provider = null;
  }

  /**
   * Initializes offline storage using IndexedDB
   */
  private async initOfflineStorage(): Promise<IDBDatabase> {
    return openDB(OFFLINE_DB_CONFIG.name, OFFLINE_DB_CONFIG.version, {
      upgrade(db) {
        db.createObjectStore('diagrams', { keyPath: 'id' });
      }
    });
  }

  /**
   * Retrieves a diagram by ID with offline fallback
   */
  public async getDiagram(diagramId: string): Promise<DiagramState> {
    try {
      // Try to fetch from server
      const response = await axiosInstance.get(`${API_ENDPOINTS.DIAGRAMS}/${diagramId}`);
      const diagram = response.data;
      
      // Update offline cache
      const db = await this.offlineDB;
      await db.put('diagrams', diagram);
      
      return diagram;
    } catch (error) {
      // Fallback to offline storage
      const db = await this.offlineDB;
      const offlineDiagram = await db.get('diagrams', diagramId);
      
      if (!offlineDiagram) {
        throw new Error('Diagram not found in offline storage');
      }
      
      return offlineDiagram;
    }
  }

  /**
   * Creates a new diagram with automatic layout optimization
   */
  public async createDiagram(params: {
    projectId: string;
    name: string;
    sqlDDL?: string;
    dialect?: SQLDialect;
  }): Promise<DiagramState> {
    const { projectId, name, sqlDDL, dialect } = params;
    
    let parsedDDL: ParsedDDL | null = null;
    
    if (sqlDDL) {
      // Parse SQL DDL if provided
      const parseResponse = await axiosInstance.post(API_ENDPOINTS.PARSE_SQL, {
        sql: sqlDDL,
        dialect: dialect || SQLDialect.POSTGRESQL
      });
      parsedDDL = parseResponse.data;
    }

    // Create diagram with optimized layout
    const response = await axiosInstance.post(API_ENDPOINTS.DIAGRAMS, {
      projectId,
      name,
      sqlDDL,
      parsedDDL,
      layout: this.generateOptimizedLayout(parsedDDL)
    });

    const diagram = response.data;
    
    // Cache offline
    const db = await this.offlineDB;
    await db.put('diagrams', diagram);
    
    return diagram;
  }

  /**
   * Updates diagram state with conflict resolution
   */
  public async updateDiagram(
    diagramId: string,
    updates: Partial<DiagramState>
  ): Promise<DiagramState> {
    try {
      const response = await axiosInstance.put(
        `${API_ENDPOINTS.DIAGRAMS}/${diagramId}`,
        updates
      );
      
      const updatedDiagram = response.data;
      
      // Update offline cache
      const db = await this.offlineDB;
      await db.put('diagrams', updatedDiagram);
      
      // Sync collaborative state if connected
      if (this.provider?.connected) {
        this.provider.updateState(updatedDiagram);
      }
      
      return updatedDiagram;
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        return this.updateDiagram(diagramId, updates);
      }
      throw error;
    }
  }

  /**
   * Starts real-time collaboration session
   */
  public async startCollaboration(diagramId: string): Promise<void> {
    if (this.currentDiagramId === diagramId && this.provider?.connected) {
      return;
    }

    // Clean up existing provider if any
    if (this.provider) {
      this.provider.disconnect();
    }

    const wsUrl = `${process.env.VITE_WS_URL}/collaborate`;
    this.provider = new YjsProvider(diagramId, wsUrl);
    
    await this.provider.connect();
    this.currentDiagramId = diagramId;
  }

  /**
   * Stops real-time collaboration session
   */
  public stopCollaboration(): void {
    if (this.provider) {
      this.provider.disconnect();
      this.provider = null;
      this.currentDiagramId = null;
    }
  }

  /**
   * Updates user presence in collaboration session
   */
  public updatePresence(presence: UserPresence): void {
    if (this.provider?.connected) {
      this.provider.updateAwareness(presence);
    }
  }

  /**
   * Generates optimized layout for diagram elements
   */
  private generateOptimizedLayout(parsedDDL: ParsedDDL | null): DiagramLayout {
    if (!parsedDDL) {
      return {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
        gridSize: 20,
        snapToGrid: true
      };
    }

    // Generate nodes with optimized positions
    const nodes: Node[] = parsedDDL.tables.map((table, index) => ({
      id: table.name,
      type: 'tableNode',
      position: this.calculateOptimalPosition(index, parsedDDL.tables.length),
      data: table
    }));

    // Generate edges for relationships
    const edges: Edge[] = parsedDDL.relationships.map((rel) => ({
      id: `${rel.sourceTable}-${rel.targetTable}`,
      source: rel.sourceTable,
      target: rel.targetTable,
      data: rel
    }));

    return {
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
      gridSize: 20,
      snapToGrid: true
    };
  }

  /**
   * Calculates optimal position for a node in the layout
   */
  private calculateOptimalPosition(index: number, total: number): Position {
    const radius = Math.min(total * 50, 400);
    const angle = (index / total) * 2 * Math.PI;
    
    return {
      x: radius * Math.cos(angle) + 500,
      y: radius * Math.sin(angle) + 500
    };
  }
}

export default DiagramService;