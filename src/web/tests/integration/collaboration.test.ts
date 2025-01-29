import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Position } from 'reactflow';
import { CollaborationService } from '../../src/services/collaboration.service';
import { server } from '../mocks/server';
import { 
  CollaborationEventType,
  UserStatus,
  UserPresence 
} from '../../src/types/collaboration.types';

// Test constants
const TEST_USER_1 = { id: 'test-user-1', name: 'Test User 1', token: 'mock-token-1' };
const TEST_USER_2 = { id: 'test-user-2', name: 'Test User 2', token: 'mock-token-2' };
const TEST_DIAGRAM_ID = 'test-diagram-id';
const SYNC_LATENCY_THRESHOLD = 100; // ms
const MAX_RETRY_ATTEMPTS = 3;
const CURSOR_THROTTLE_MS = 50;
const PRESENCE_TIMEOUT_MS = 5000;

// Test configuration
const TEST_CONFIG = {
  wsUrl: 'ws://localhost:3001',
  retryAttempts: MAX_RETRY_ATTEMPTS,
  retryDelay: 1000
};

describe('Collaboration Integration Tests', () => {
  let collaborationService1: CollaborationService;
  let collaborationService2: CollaborationService;
  let mockDiagramData: any;

  beforeEach(async () => {
    // Start MSW server with network condition configuration
    server.listen({
      onUnhandledRequest: 'error'
    });

    // Configure network conditions for realistic testing
    server.networkConditions({
      latency: 50,
      jitter: 10,
      packetLoss: 0.01
    });

    // Initialize test diagram data
    mockDiagramData = {
      nodes: [{ id: 'node1', type: 'table', position: { x: 0, y: 0 } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    // Initialize collaboration services
    collaborationService1 = new CollaborationService(
      TEST_USER_1.id,
      TEST_DIAGRAM_ID,
      TEST_CONFIG
    );

    collaborationService2 = new CollaborationService(
      TEST_USER_2.id,
      TEST_DIAGRAM_ID,
      TEST_CONFIG
    );

    // Connect both services
    await Promise.all([
      collaborationService1.connect(),
      collaborationService2.connect()
    ]);
  });

  afterEach(async () => {
    // Disconnect services
    await Promise.all([
      collaborationService1.disconnect(),
      collaborationService2.disconnect()
    ]);

    // Reset server and handlers
    server.resetHandlers();
    server.close();
  });

  describe('Connection Management', () => {
    it('should establish connection with retry mechanism', async () => {
      // Simulate network interruption
      server.networkConditions({ offline: true });
      
      const service = new CollaborationService(
        'test-user-3',
        TEST_DIAGRAM_ID,
        TEST_CONFIG
      );

      try {
        await service.connect();
      } catch (error) {
        expect(error.message).toContain('Failed to connect after retries');
      }

      // Restore network and verify reconnection
      server.networkConditions({ offline: false });
      await service.connect();
      expect(service['isConnected']).toBe(true);
    });

    it('should handle connection timeouts gracefully', async () => {
      server.networkConditions({ latency: 6000 }); // Exceed default timeout

      const service = new CollaborationService(
        'test-user-4',
        TEST_DIAGRAM_ID,
        TEST_CONFIG
      );

      try {
        await service.connect();
        fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.message).toContain('Connection timeout');
      }
    });
  });

  describe('Document Synchronization', () => {
    it('should synchronize diagram updates between users', async () => {
      // Set up change tracking
      let user2Updates = 0;
      collaborationService2.onStateChange(() => {
        user2Updates++;
      });

      // User 1 updates diagram
      await collaborationService1.updateDiagram(mockDiagramData);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(user2Updates).toBe(1);
    });

    it('should handle concurrent updates with CRDT', async () => {
      // Simulate concurrent updates
      const updates = await Promise.all([
        collaborationService1.updateDiagram({
          ...mockDiagramData,
          nodes: [...mockDiagramData.nodes, { id: 'node2', type: 'table', position: { x: 100, y: 0 } }]
        }),
        collaborationService2.updateDiagram({
          ...mockDiagramData,
          nodes: [...mockDiagramData.nodes, { id: 'node3', type: 'table', position: { x: 200, y: 0 } }]
        })
      ]);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify both services have same state
      const state1 = collaborationService1['yjsProvider'].document.getMap('state').get('data');
      const state2 = collaborationService2['yjsProvider'].document.getMap('state').get('data');
      expect(state1).toEqual(state2);
    });

    it('should maintain sync latency within threshold', async () => {
      const startTime = Date.now();
      await collaborationService1.updateDiagram(mockDiagramData);
      
      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const syncLatency = Date.now() - startTime;
      expect(syncLatency).toBeLessThan(SYNC_LATENCY_THRESHOLD);
    });
  });

  describe('Cursor Tracking', () => {
    it('should broadcast cursor updates with throttling', async () => {
      let cursorUpdates = 0;
      const cursorPositions: Position[] = [];

      collaborationService2.onStateChange((state: any) => {
        if (state.cursors?.[TEST_USER_1.id]) {
          cursorUpdates++;
          cursorPositions.push(state.cursors[TEST_USER_1.id]);
        }
      });

      // Simulate rapid cursor movements
      for (let i = 0; i < 10; i++) {
        collaborationService1.updateCursor({ x: i * 10, y: i * 10 });
      }

      // Wait for throttle interval
      await new Promise(resolve => setTimeout(resolve, CURSOR_THROTTLE_MS * 2));

      // Verify throttling worked
      expect(cursorUpdates).toBeLessThan(10);
    });
  });

  describe('Presence Management', () => {
    it('should track user presence accurately', async () => {
      // Update presence for both users
      const presence1: UserPresence = {
        userId: TEST_USER_1.id,
        name: TEST_USER_1.name,
        status: UserStatus.ONLINE,
        lastActive: new Date(),
        cursorPosition: { x: 0, y: 0 }
      };

      const presence2: UserPresence = {
        userId: TEST_USER_2.id,
        name: TEST_USER_2.name,
        status: UserStatus.ONLINE,
        lastActive: new Date(),
        cursorPosition: { x: 100, y: 100 }
      };

      await Promise.all([
        collaborationService1['updatePresence'](presence1),
        collaborationService2['updatePresence'](presence2)
      ]);

      // Get collaborators from both services
      const collaborators1 = collaborationService1.getCollaborators();
      const collaborators2 = collaborationService2.getCollaborators();

      expect(collaborators1.length).toBe(1);
      expect(collaborators2.length).toBe(1);
      expect(collaborators1[0].userId).toBe(TEST_USER_2.id);
      expect(collaborators2[0].userId).toBe(TEST_USER_1.id);
    });

    it('should handle user disconnection gracefully', async () => {
      // Connect both users
      await collaborationService2.disconnect();

      // Wait for presence timeout
      await new Promise(resolve => setTimeout(resolve, PRESENCE_TIMEOUT_MS));

      // Verify user 2 is removed from collaborators
      const collaborators = collaborationService1.getCollaborators();
      expect(collaborators.length).toBe(0);
    });
  });
});