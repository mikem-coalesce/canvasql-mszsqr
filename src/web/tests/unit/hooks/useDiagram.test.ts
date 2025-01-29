import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { Node, Edge, Viewport } from 'reactflow';
import { performance } from 'perf_hooks';

import useDiagram from '../../../src/hooks/useDiagram';
import DiagramService from '../../../src/services/diagram.service';
import { DiagramState, DiagramLayout } from '../../../src/types/diagram.types';
import { SQLDialect } from '../../../src/types/sql.types';
import { CollaborationEventType } from '../../../src/types/collaboration.types';

// Mock diagram service
jest.mock('../../../src/services/diagram.service');

// Mock diagram store
jest.mock('../../../src/store/diagram.store', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    state: null,
    loadDiagram: jest.fn(),
    updateLayout: jest.fn(),
    updateSQLDDL: jest.fn(),
    startCollaboration: jest.fn(),
    stopCollaboration: jest.fn()
  }))
}));

// Test constants
const MOCK_DIAGRAM_ID = 'test-diagram-id';
const MOCK_DIAGRAM_DATA: DiagramState = {
  id: 'test-diagram-id',
  projectId: 'test-project-id',
  name: 'Test Diagram',
  sqlDDL: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
  dialect: SQLDialect.POSTGRESQL,
  parsedDDL: {
    tables: [],
    relationships: [],
    dialect: SQLDialect.POSTGRESQL,
    schemas: [],
    metadata: {
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  },
  layout: {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1, minZoom: 0.1, maxZoom: 2 },
    gridSize: 20,
    snapToGrid: true
  },
  annotations: {},
  lastModified: new Date().toISOString(),
  version: 1,
  collaborators: []
};

// Performance thresholds from technical spec
const PERFORMANCE_THRESHOLDS = {
  syncLatency: 100, // ms
  renderTime: 2000, // ms
  parseTime: 1000 // ms
};

describe('useDiagram hook - Basic Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DiagramService as jest.Mock).mockImplementation(() => ({
      getDiagram: jest.fn().mockResolvedValue(MOCK_DIAGRAM_DATA),
      updateDiagram: jest.fn().mockResolvedValue(MOCK_DIAGRAM_DATA),
      parseSQLDDL: jest.fn().mockResolvedValue(MOCK_DIAGRAM_DATA.parsedDDL),
      startCollaboration: jest.fn().mockResolvedValue(undefined),
      stopCollaboration: jest.fn()
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should load diagram data on mount', async () => {
    const { result } = renderHook(() => useDiagram(MOCK_DIAGRAM_ID));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.diagram).toEqual(MOCK_DIAGRAM_DATA);
    });
  });

  it('should handle loading errors', async () => {
    const mockError = new Error('Failed to load diagram');
    (DiagramService as jest.Mock).mockImplementation(() => ({
      getDiagram: jest.fn().mockRejectedValue(mockError)
    }));

    const { result } = renderHook(() => useDiagram(MOCK_DIAGRAM_ID));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(mockError);
    });
  });

  it('should update layout with optimized performance', async () => {
    const { result } = renderHook(() => useDiagram(MOCK_DIAGRAM_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const startTime = performance.now();
    const newLayout: Partial<DiagramLayout> = {
      viewport: { x: 100, y: 100, zoom: 1.5, minZoom: 0.1, maxZoom: 2 }
    };

    act(() => {
      result.current.updateLayout(newLayout);
    });

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime);
  });
});

describe('useDiagram hook - SQL Processing', () => {
  it('should parse large SQL DDL within performance threshold', async () => {
    const { result } = renderHook(() => useDiagram(MOCK_DIAGRAM_ID));
    
    const largeSQLDDL = Array(100)
      .fill("CREATE TABLE test_table (id SERIAL PRIMARY KEY);")
      .join("\n");

    const startTime = performance.now();
    
    await act(async () => {
      await result.current.parseSQLDDL(largeSQLDDL);
    });

    const parseTime = performance.now() - startTime;
    expect(parseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.parseTime);
  });

  it('should handle SQL parsing errors gracefully', async () => {
    const mockError = new Error('Invalid SQL syntax');
    (DiagramService as jest.Mock).mockImplementation(() => ({
      parseSQLDDL: jest.fn().mockRejectedValue(mockError)
    }));

    const { result } = renderHook(() => useDiagram(MOCK_DIAGRAM_ID));
    const invalidSQL = 'INVALID SQL STATEMENT';

    await act(async () => {
      try {
        await result.current.parseSQLDDL(invalidSQL);
      } catch (error) {
        expect(error).toEqual(mockError);
      }
    });
  });
});

describe('useDiagram hook - Collaboration Features', () => {
  it('should sync collaborator updates within latency threshold', async () => {
    const { result } = renderHook(() => 
      useDiagram(MOCK_DIAGRAM_ID, { autoSync: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const startTime = performance.now();
    const collaborator = {
      id: 'test-user',
      cursor: { x: 100, y: 100 }
    };

    act(() => {
      result.current.diagram?.collaborators.push(collaborator);
    });

    const syncTime = performance.now() - startTime;
    expect(syncTime).toBeLessThan(PERFORMANCE_THRESHOLDS.syncLatency);
  });

  it('should track cursor positions in real-time', async () => {
    const { result } = renderHook(() => 
      useDiagram(MOCK_DIAGRAM_ID, { autoSync: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const cursorPosition = { x: 150, y: 150 };

    act(() => {
      result.current.updateLayout({
        collaborators: [{
          id: 'test-user',
          cursor: cursorPosition
        }]
      });
    });

    expect(result.current.diagram?.collaborators[0].cursor).toEqual(cursorPosition);
  });
});

describe('useDiagram hook - Performance Monitoring', () => {
  it('should maintain performance under load', async () => {
    const { result } = renderHook(() => 
      useDiagram(MOCK_DIAGRAM_ID, { performanceMonitoring: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Generate large dataset
    const nodes: Node[] = Array(100).fill(null).map((_, i) => ({
      id: `node-${i}`,
      type: 'default',
      position: { x: i * 100, y: i * 100 },
      data: { label: `Node ${i}` }
    }));

    const edges: Edge[] = Array(50).fill(null).map((_, i) => ({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
      type: 'default'
    }));

    const startTime = performance.now();

    act(() => {
      result.current.updateLayout({ nodes, edges });
    });

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime);
    expect(result.current.diagram?.layout.nodes.length).toBe(100);
  });
});