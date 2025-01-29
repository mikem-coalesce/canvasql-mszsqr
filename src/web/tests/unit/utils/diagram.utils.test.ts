import { describe, it, expect, beforeEach, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import { performance } from 'perf_hooks';

import {
  generateDiagramLayout,
  optimizeLayout,
  calculateViewport,
  updateNodePosition,
  serializeDiagram,
  deserializeDiagram
} from '../../../src/utils/diagram.utils';

import {
  DiagramState,
  DiagramLayout,
  DiagramNode,
  DiagramEdge
} from '../../../src/types/diagram.types';

import { SQLDialect, RelationType } from '../../../src/types/sql.types';

// Constants for performance testing
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds max execution time
const SYNC_LATENCY_THRESHOLD = 100; // 100ms max latency
const MAX_TABLES = 100; // Maximum supported tables

// Test data generators
const generateMockTable = (index: number) => ({
  name: `table_${index}`,
  schema: 'public',
  columns: [
    {
      name: 'id',
      type: 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
      isForeignKey: false,
      isUnique: true,
      isAutoIncrement: true
    },
    {
      name: 'name',
      type: 'VARCHAR',
      length: 255,
      nullable: true,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
      isAutoIncrement: false
    }
  ],
  primaryKey: ['id'],
  constraints: [],
  indices: []
});

const generateMockRelationship = (sourceIndex: number, targetIndex: number) => ({
  type: RelationType.ONE_TO_MANY,
  sourceTable: `table_${sourceIndex}`,
  targetTable: `table_${targetIndex}`,
  sourceColumn: 'id',
  targetColumn: `table_${sourceIndex}_id`,
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION'
});

describe('generateDiagramLayout', () => {
  it('should generate layout for empty SQL', () => {
    const parsedDDL = {
      tables: [],
      relationships: [],
      dialect: SQLDialect.POSTGRESQL,
      schemas: ['public'],
      metadata: { version: '1.0', timestamp: new Date().toISOString() }
    };

    const layout = generateDiagramLayout(parsedDDL);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.gridSize).toBe(20);
    expect(layout.snapToGrid).toBe(true);
  });

  it('should generate layout for single table', () => {
    const parsedDDL = {
      tables: [generateMockTable(1)],
      relationships: [],
      dialect: SQLDialect.POSTGRESQL,
      schemas: ['public'],
      metadata: { version: '1.0', timestamp: new Date().toISOString() }
    };

    const layout = generateDiagramLayout(parsedDDL);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].type).toBe('table');
    expect(layout.nodes[0].data.columns).toHaveLength(2);
  });

  it('should handle maximum supported tables with performance constraints', () => {
    const tables = Array.from({ length: MAX_TABLES }, (_, i) => generateMockTable(i));
    const relationships = Array.from({ length: MAX_TABLES - 1 }, (_, i) => 
      generateMockRelationship(i, i + 1)
    );

    const parsedDDL = {
      tables,
      relationships,
      dialect: SQLDialect.POSTGRESQL,
      schemas: ['public'],
      metadata: { version: '1.0', timestamp: new Date().toISOString() }
    };

    const startTime = performance.now();
    const layout = generateDiagramLayout(parsedDDL);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(layout.nodes).toHaveLength(MAX_TABLES);
    expect(layout.edges).toHaveLength(MAX_TABLES - 1);
  });
});

describe('optimizeLayout', () => {
  let mockLayout: DiagramLayout;

  beforeEach(() => {
    mockLayout = {
      nodes: Array.from({ length: 5 }, (_, i) => ({
        id: `node_${i}`,
        type: 'table',
        position: { x: i * 100, y: i * 100 },
        data: generateMockTable(i)
      })),
      edges: Array.from({ length: 4 }, (_, i) => ({
        id: `edge_${i}`,
        source: `node_${i}`,
        target: `node_${i + 1}`,
        type: 'relationship',
        data: generateMockRelationship(i, i + 1)
      })),
      viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
      gridSize: 20,
      snapToGrid: true
    };
  });

  it('should optimize layout without collisions', () => {
    const optimized = optimizeLayout(mockLayout);
    
    // Check node spacing
    for (let i = 0; i < optimized.nodes.length - 1; i++) {
      const node1 = optimized.nodes[i];
      const node2 = optimized.nodes[i + 1];
      const distance = Math.sqrt(
        Math.pow(node2.position.x - node1.position.x, 2) +
        Math.pow(node2.position.y - node1.position.y, 2)
      );
      expect(distance).toBeGreaterThanOrEqual(100); // Minimum node separation
    }
  });

  it('should maintain grid alignment', () => {
    const optimized = optimizeLayout(mockLayout);
    
    optimized.nodes.forEach(node => {
      expect(node.position.x % mockLayout.gridSize).toBe(0);
      expect(node.position.y % mockLayout.gridSize).toBe(0);
    });
  });

  it('should handle large diagrams within performance constraints', () => {
    const largeLayout = {
      ...mockLayout,
      nodes: Array.from({ length: MAX_TABLES }, (_, i) => ({
        id: `node_${i}`,
        type: 'table',
        position: { x: i * 100, y: i * 100 },
        data: generateMockTable(i)
      }))
    };

    const startTime = performance.now();
    const optimized = optimizeLayout(largeLayout);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(optimized.nodes).toHaveLength(MAX_TABLES);
  });
});

describe('calculateViewport', () => {
  it('should calculate viewport for empty diagram', () => {
    const viewport = calculateViewport([]);
    expect(viewport.zoom).toBe(1);
    expect(viewport.x).toBe(0);
    expect(viewport.y).toBe(0);
  });

  it('should calculate viewport for single node', () => {
    const nodes = [{
      id: 'node_1',
      type: 'table',
      position: { x: 100, y: 100 },
      data: generateMockTable(1)
    }];

    const viewport = calculateViewport(nodes);
    expect(viewport.zoom).toBeGreaterThan(0.5);
    expect(viewport.zoom).toBeLessThanOrEqual(2);
  });

  it('should handle maximum diagram size', () => {
    const nodes = Array.from({ length: MAX_TABLES }, (_, i) => ({
      id: `node_${i}`,
      type: 'table',
      position: { x: i * 300, y: i * 200 },
      data: generateMockTable(i)
    }));

    const startTime = performance.now();
    const viewport = calculateViewport(nodes);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(executionTime).toBeLessThan(SYNC_LATENCY_THRESHOLD);
    expect(viewport.zoom).toBeGreaterThan(0);
    expect(viewport.zoom).toBeLessThanOrEqual(2);
  });
});

describe('updateNodePosition', () => {
  let mockLayout: DiagramLayout;

  beforeEach(() => {
    mockLayout = {
      nodes: [{
        id: 'node_1',
        type: 'table',
        position: { x: 100, y: 100 },
        data: generateMockTable(1)
      }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
      gridSize: 20,
      snapToGrid: true
    };
  });

  it('should update node position with grid snapping', () => {
    const newPosition = { x: 123, y: 456 };
    const updated = updateNodePosition('node_1', newPosition, mockLayout);
    
    expect(updated.nodes[0].position.x % mockLayout.gridSize).toBe(0);
    expect(updated.nodes[0].position.y % mockLayout.gridSize).toBe(0);
  });

  it('should maintain layout integrity during updates', () => {
    const startTime = performance.now();
    const newPosition = { x: 200, y: 200 };
    const updated = updateNodePosition('node_1', newPosition, mockLayout);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(SYNC_LATENCY_THRESHOLD);
    expect(updated.nodes).toHaveLength(mockLayout.nodes.length);
    expect(updated.edges).toHaveLength(mockLayout.edges.length);
  });
});

describe('serializeDiagram and deserializeDiagram', () => {
  const mockDiagramState: DiagramState = {
    id: faker.string.uuid(),
    projectId: faker.string.uuid(),
    name: 'Test Diagram',
    sqlDDL: 'CREATE TABLE test (id INTEGER PRIMARY KEY);',
    dialect: SQLDialect.POSTGRESQL,
    layout: {
      nodes: [{
        id: 'node_1',
        type: 'table',
        position: { x: 100, y: 100 },
        data: generateMockTable(1)
      }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.5, maxZoom: 2 },
      gridSize: 20,
      snapToGrid: true
    },
    annotations: {},
    lastModified: new Date().toISOString(),
    version: 1,
    collaborators: []
  };

  it('should serialize and deserialize diagram state correctly', () => {
    const serialized = serializeDiagram(mockDiagramState);
    const deserialized = deserializeDiagram(serialized);

    expect(deserialized.id).toBe(mockDiagramState.id);
    expect(deserialized.layout.nodes).toHaveLength(mockDiagramState.layout.nodes.length);
    expect(deserialized.version).toBe(mockDiagramState.version);
  });

  it('should handle large diagrams within performance constraints', () => {
    const largeDiagramState = {
      ...mockDiagramState,
      layout: {
        ...mockDiagramState.layout,
        nodes: Array.from({ length: MAX_TABLES }, (_, i) => ({
          id: `node_${i}`,
          type: 'table',
          position: { x: i * 100, y: i * 100 },
          data: generateMockTable(i)
        }))
      }
    };

    const startTime = performance.now();
    const serialized = serializeDiagram(largeDiagramState);
    const deserialized = deserializeDiagram(serialized);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
    expect(deserialized.layout.nodes).toHaveLength(MAX_TABLES);
  });

  it('should throw error for invalid diagram data', () => {
    expect(() => deserializeDiagram(null)).toThrow('Invalid diagram data format');
    expect(() => deserializeDiagram({})).toThrow();
  });
});