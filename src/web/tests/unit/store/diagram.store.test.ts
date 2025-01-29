import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

import useDiagramStore from '../../../src/store/diagram.store';
import { DiagramState, DiagramLayout, CollaborationState, PerformanceMetrics } from '../../../src/types/diagram.types';
import { server } from '../../mocks/server';

// Mock global objects
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;

// Mock WebSocket
class MockWebSocket {
  onopen: () => void = () => {};
  onclose: () => void = () => {};
  onmessage: (event: any) => void = () => {};
  send: (data: string) => void = () => {};
  close: () => void = () => {};
}

global.WebSocket = MockWebSocket as any;

// Test data
const mockDiagramData: DiagramState = {
  id: 'test-diagram-id',
  projectId: 'test-project-id',
  name: 'Test Diagram',
  sqlDDL: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
  dialect: 'POSTGRESQL',
  layout: {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  collaborationState: {
    activeUsers: [],
    lastSync: null,
    version: 0
  },
  performanceMetrics: {
    loadTime: 0,
    renderTime: 0,
    syncLatency: 0
  }
};

describe('useDiagramStore', () => {
  beforeEach(() => {
    // Reset store state
    const store = useDiagramStore.getState();
    store.state = mockDiagramData;
    store.isLoading = false;
    store.error = null;
    
    // Clear undo/redo stacks
    store.undoStack = [];
    store.redoStack = [];
  });

  afterEach(() => {
    // Reset MSW handlers
    server.resetHandlers();
    // Clean up WebSocket connections
    vi.clearAllMocks();
  });

  describe('Store Initialization', () => {
    it('should initialize with default state', () => {
      const store = useDiagramStore.getState();
      expect(store.state).toEqual(mockDiagramData);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should setup Y.js document correctly', async () => {
      const store = useDiagramStore.getState();
      await act(async () => {
        await store.startCollaboration();
      });
      
      expect(store.error).toBeNull();
      // Verify Y.js document is initialized
      const state = store.state;
      expect(state.collaborationState.version).toBeDefined();
    });
  });

  describe('Diagram Operations', () => {
    it('should load diagram successfully', async () => {
      const store = useDiagramStore.getState();
      
      await act(async () => {
        await store.loadDiagram('test-diagram-id');
      });

      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.state.id).toBe('test-diagram-id');
    });

    it('should update layout with undo/redo support', async () => {
      const store = useDiagramStore.getState();
      const newLayout: Partial<DiagramLayout> = {
        nodes: [{ id: 'node1', type: 'table', position: { x: 100, y: 100 }, data: {} }],
        viewport: { x: 50, y: 50, zoom: 1 }
      };

      await act(async () => {
        store.updateLayout(newLayout);
      });

      expect(store.state.layout.nodes).toHaveLength(1);
      expect(store.undoStack).toHaveLength(1);

      // Test undo
      await act(async () => {
        store.undo();
      });

      expect(store.state.layout.nodes).toHaveLength(0);
      expect(store.redoStack).toHaveLength(1);
    });

    it('should process SQL DDL updates', async () => {
      const store = useDiagramStore.getState();
      const newSQL = 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL);';

      await act(async () => {
        await store.updateSQLDDL(newSQL);
      });

      expect(store.state.sqlDDL).toBe(newSQL);
      expect(store.error).toBeNull();
    });
  });

  describe('Collaboration Features', () => {
    it('should handle real-time updates', async () => {
      const store = useDiagramStore.getState();
      
      await act(async () => {
        await store.startCollaboration();
      });

      const presence = {
        userId: 'test-user',
        cursor: { x: 100, y: 100 }
      };

      await act(async () => {
        store.updatePresence(presence);
      });

      expect(store.state.collaborationState.activeUsers).toContainEqual(
        expect.objectContaining({ userId: 'test-user' })
      );
    });

    it('should handle offline mode gracefully', async () => {
      const store = useDiagramStore.getState();
      
      // Simulate offline scenario
      server.close();

      await act(async () => {
        await store.loadDiagram('test-diagram-id').catch(() => {});
      });

      expect(store.error).toBeDefined();
      expect(store.state.id).toBe('test-diagram-id');
    });

    it('should sync state changes with Y.js', async () => {
      const store = useDiagramStore.getState();
      
      await act(async () => {
        await store.startCollaboration();
      });

      const newLayout: Partial<DiagramLayout> = {
        nodes: [{ id: 'node1', type: 'table', position: { x: 100, y: 100 }, data: {} }]
      };

      await act(async () => {
        store.updateLayout(newLayout);
      });

      // Wait for sync
      await waitFor(() => {
        expect(store.state.collaborationState.version).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures', async () => {
      const store = useDiagramStore.getState();
      server.close();

      await act(async () => {
        try {
          await store.loadDiagram('invalid-id');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(store.error).toBeDefined();
      expect(store.isLoading).toBe(false);
    });

    it('should handle invalid SQL', async () => {
      const store = useDiagramStore.getState();
      const invalidSQL = 'CREATE TABLE invalid syntax';

      await act(async () => {
        try {
          await store.updateSQLDDL(invalidSQL);
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(store.error).toBeDefined();
    });

    it('should handle concurrent edit conflicts', async () => {
      const store = useDiagramStore.getState();
      
      await act(async () => {
        await store.startCollaboration();
      });

      // Simulate concurrent edits
      const update1 = { nodes: [{ id: 'node1', position: { x: 100, y: 100 } }] };
      const update2 = { nodes: [{ id: 'node1', position: { x: 200, y: 200 } }] };

      await act(async () => {
        store.updateLayout(update1);
        store.updateLayout(update2);
      });

      // Verify CRDT conflict resolution
      await waitFor(() => {
        expect(store.state.layout.nodes[0].position).toEqual(update2.nodes[0].position);
      });
    });
  });
});