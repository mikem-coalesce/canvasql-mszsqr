import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';
import { Position } from 'reactflow';

import { useCollaborationStore } from '../../src/store/collaboration.store';
import { CollaborationService } from '../../src/services/collaboration.service';
import { UserPresence, UserStatus, CollaborationError } from '../../src/types/collaboration.types';

// Mock CollaborationService
vi.mock('../../src/services/collaboration.service');

// Test constants
const TEST_DIAGRAM_ID = 'test-diagram-123';
const TEST_USER_ID = 'test-user-123';
const SYNC_LATENCY_THRESHOLD = 100; // 100ms as per requirements
const MAX_CONCURRENT_USERS = 25; // As per requirements

// Mock data
const mockPosition: Position = { x: 100, y: 100 };
const mockUserPresence: UserPresence = {
  userId: TEST_USER_ID,
  name: 'Test User',
  status: UserStatus.ONLINE,
  lastActive: new Date(),
  cursorPosition: mockPosition
};

describe('useCollaborationStore', () => {
  let store: ReturnType<typeof useCollaborationStore>;
  let mockCollabService: jest.Mocked<CollaborationService>;

  beforeEach(() => {
    // Reset store and mocks before each test
    store = useCollaborationStore.getState();
    mockCollabService = new CollaborationService(TEST_USER_ID, TEST_DIAGRAM_ID, {
      wsUrl: 'ws://localhost:3000'
    }) as jest.Mocked<CollaborationService>;
    
    // Clear performance metrics
    store.getState().latencyMetrics.clear();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
    store.getState().disconnect();
  });

  describe('initialization', () => {
    it('should initialize collaboration service successfully', async () => {
      const initStart = performance.now();
      
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
      
      const initDuration = performance.now() - initStart;
      
      expect(store.getState().isConnected).toBe(true);
      expect(store.getState().diagramId).toBe(TEST_DIAGRAM_ID);
      expect(initDuration).toBeLessThan(3000); // 3s initial load requirement
    });

    it('should handle initialization errors gracefully', async () => {
      mockCollabService.initialize.mockRejectedValue(new Error('Connection failed'));
      
      await expect(store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID))
        .rejects.toThrow('Connection failed');
      
      expect(store.getState().isConnected).toBe(false);
      expect(store.getState().isInitializing).toBe(false);
    });

    it('should configure performance monitoring on initialization', async () => {
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
      
      expect(store.getState().latencyMetrics).toBeDefined();
      expect(store.getState().averageLatency).toBe(0);
    });
  });

  describe('cursor tracking', () => {
    beforeEach(async () => {
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
    });

    it('should update cursor position with low latency', () => {
      const updateStart = performance.now();
      
      store.updateCursorPosition(mockPosition);
      
      const updateLatency = performance.now() - updateStart;
      expect(updateLatency).toBeLessThan(SYNC_LATENCY_THRESHOLD);
      expect(mockCollabService.updateCursor).toHaveBeenCalledWith(mockPosition);
    });

    it('should throttle rapid cursor updates', () => {
      const updates = Array.from({ length: 10 }, () => 
        store.updateCursorPosition(mockPosition)
      );
      
      expect(mockCollabService.updateCursor).toHaveBeenCalledTimes(1);
    });

    it('should handle cursor update errors', () => {
      mockCollabService.updateCursor.mockImplementation(() => {
        throw new Error('Update failed');
      });
      
      expect(() => store.updateCursorPosition(mockPosition)).not.toThrow();
      expect(store.getState().latencyMetrics.get('cursorError')).toBeDefined();
    });
  });

  describe('presence management', () => {
    beforeEach(async () => {
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
    });

    it('should update user presence status', () => {
      store.updatePresence(UserStatus.IDLE);
      
      const users = store.getState().users;
      expect(users.get(TEST_USER_ID)?.status).toBe(UserStatus.IDLE);
    });

    it('should handle concurrent user limit', () => {
      // Add maximum allowed users
      for (let i = 0; i < MAX_CONCURRENT_USERS; i++) {
        store.getState().users.set(`user-${i}`, {
          ...mockUserPresence,
          userId: `user-${i}`
        });
      }
      
      expect(store.getState().userCount).toBe(MAX_CONCURRENT_USERS);
      expect(store.getState().users.size).toBe(MAX_CONCURRENT_USERS);
    });

    it('should clean up inactive users', () => {
      const oldUser = {
        ...mockUserPresence,
        lastActive: new Date(Date.now() - 70000) // Older than presence interval
      };
      store.getState().users.set('old-user', oldUser);
      
      const activeUsers = store.getActiveUsers();
      expect(activeUsers).not.toContainEqual(oldUser);
    });
  });

  describe('connection handling', () => {
    it('should handle disconnection gracefully', async () => {
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
      await store.disconnect();
      
      expect(store.getState().isConnected).toBe(false);
      expect(store.getState().users.size).toBe(0);
      expect(mockCollabService.cleanup).toHaveBeenCalled();
    });

    it('should attempt reconnection on failure', async () => {
      mockCollabService.reconnect.mockResolvedValue(undefined);
      
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
      await store.getState().service?.reconnect();
      
      expect(mockCollabService.reconnect).toHaveBeenCalled();
      expect(store.getState().isConnected).toBe(true);
    });

    it('should maintain state during reconnection', async () => {
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
      store.getState().users.set(TEST_USER_ID, mockUserPresence);
      
      await store.getState().service?.reconnect();
      
      expect(store.getState().users.get(TEST_USER_ID)).toEqual(mockUserPresence);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await store.initialize(TEST_DIAGRAM_ID, TEST_USER_ID);
    });

    it('should maintain sync latency under threshold', () => {
      const metrics = store.getLatencyMetrics();
      expect(metrics.average).toBeLessThan(SYNC_LATENCY_THRESHOLD);
    });

    it('should handle concurrent operations efficiently', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => 
        store.updateCursorPosition({ x: i, y: i })
      );
      
      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;
      
      expect(duration / operations.length).toBeLessThan(SYNC_LATENCY_THRESHOLD);
    });

    it('should batch state updates for performance', () => {
      const updateStart = performance.now();
      
      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        store.updatePresence(UserStatus.ONLINE);
      }
      
      const batchDuration = performance.now() - updateStart;
      expect(batchDuration).toBeLessThan(SYNC_LATENCY_THRESHOLD * 2);
      expect(mockCollabService.updatePresence).toHaveBeenCalledTimes(1);
    });

    it('should monitor memory usage during operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform memory-intensive operations
      for (let i = 0; i < 1000; i++) {
        store.getState().users.set(`user-${i}`, {
          ...mockUserPresence,
          userId: `user-${i}`
        });
      }
      
      const memoryUsed = process.memoryUsage().heapUsed - initialMemory;
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    });
  });
});