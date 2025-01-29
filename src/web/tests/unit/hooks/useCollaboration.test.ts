import { renderHook, act } from '@testing-library/react-hooks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Position } from 'reactflow';

import { useCollaboration } from '@/hooks/useCollaboration';
import { CollaborationService } from '@/services/collaboration.service';
import { useCollaborationStore } from '@/store/collaboration.store';
import { UserStatus, UserPresence } from '@/types/collaboration.types';

// Mock the collaboration service and store
vi.mock('@/services/collaboration.service');
vi.mock('@/store/collaboration.store');

// Test constants
const TEST_WORKSPACE_ID = 'test-workspace-123';
const TEST_USER_ID = 'test-user-123';
const LATENCY_THRESHOLD = 100; // 100ms latency requirement
const MAX_USERS = 25; // Maximum concurrent users per workspace

describe('useCollaboration', () => {
  // Mock store state
  const mockStore = {
    isConnected: false,
    users: new Map<string, UserPresence>(),
    latencyMetrics: new Map<string, number[]>(),
    initialize: vi.fn(),
    disconnect: vi.fn(),
    updateCursorPosition: vi.fn(),
    updatePresence: vi.fn(),
    getActiveUsers: vi.fn(),
    getLatencyMetrics: vi.fn()
  };

  // Mock service instance
  let mockService: jest.Mocked<CollaborationService>;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Initialize mock service
    mockService = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      updateCursor: vi.fn(),
      updatePresence: vi.fn(),
      onStateChange: vi.fn(),
      getCollaborators: vi.fn()
    } as unknown as jest.Mocked<CollaborationService>;

    // Setup mock store
    vi.mocked(useCollaborationStore).mockImplementation(() => mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize collaboration service', async () => {
    const onConnectionChange = vi.fn();
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID, { onConnectionChange })
    );

    // Wait for initialization
    await waitForNextUpdate();

    expect(mockStore.initialize).toHaveBeenCalledWith(TEST_WORKSPACE_ID, TEST_USER_ID);
    expect(onConnectionChange).toHaveBeenCalledWith(true);
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle initialization errors with retry', async () => {
    const onError = vi.fn();
    mockStore.initialize.mockRejectedValueOnce(new Error('Connection failed'));

    const { waitForNextUpdate } = renderHook(() =>
      useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID, { onError })
    );

    await waitForNextUpdate();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(mockStore.initialize).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('should handle cursor position updates within latency threshold', async () => {
    const { result } = renderHook(() => useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID));

    const position: Position = { x: 100, y: 100 };
    const startTime = performance.now();

    await act(async () => {
      result.current.updateCursorPosition(position);
    });

    const endTime = performance.now();
    const updateLatency = endTime - startTime;

    expect(updateLatency).toBeLessThan(LATENCY_THRESHOLD);
    expect(mockStore.updateCursorPosition).toHaveBeenCalledWith(position);
  });

  it('should throttle cursor updates to prevent flooding', async () => {
    const { result } = renderHook(() => useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID));

    // Simulate rapid cursor movements
    await act(async () => {
      for (let i = 0; i < 20; i++) {
        result.current.updateCursorPosition({ x: i, y: i });
      }
    });

    // Should be throttled to maximum 10 updates per second
    expect(mockStore.updateCursorPosition).toHaveBeenCalledTimes(10);
  });

  it('should handle presence updates for multiple users', async () => {
    const { result } = renderHook(() => useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID));

    // Simulate multiple users
    const users = new Map<string, UserPresence>();
    for (let i = 0; i < MAX_USERS; i++) {
      users.set(`user-${i}`, {
        userId: `user-${i}`,
        name: `User ${i}`,
        status: UserStatus.ONLINE,
        lastActive: new Date(),
        cursorPosition: null
      });
    }

    mockStore.users = users;

    await act(async () => {
      result.current.updatePresence(UserStatus.ONLINE);
    });

    expect(result.current.users.size).toBe(MAX_USERS);
    expect(mockStore.updatePresence).toHaveBeenCalledWith(UserStatus.ONLINE);
  });

  it('should clean up resources on unmount', async () => {
    const { unmount } = renderHook(() => useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID));

    unmount();

    expect(mockStore.disconnect).toHaveBeenCalled();
  });

  it('should track performance metrics', async () => {
    const { result } = renderHook(() => 
      useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID, { performanceMode: 'high' })
    );

    // Simulate some actions to generate metrics
    await act(async () => {
      result.current.updateCursorPosition({ x: 0, y: 0 });
      result.current.updatePresence(UserStatus.ONLINE);
    });

    const metrics = result.current.performanceMetrics;
    expect(metrics).toHaveProperty('average');
    expect(metrics).toHaveProperty('max');
    expect(metrics).toHaveProperty('min');
  });

  it('should handle concurrent user operations', async () => {
    const { result } = renderHook(() => useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID));

    // Simulate concurrent operations
    await act(async () => {
      result.current.updateCursorPosition({ x: 0, y: 0 });
      result.current.updatePresence(UserStatus.ONLINE);
      // Simulate another user's update
      mockStore.users.set('other-user', {
        userId: 'other-user',
        name: 'Other User',
        status: UserStatus.ONLINE,
        lastActive: new Date(),
        cursorPosition: { x: 100, y: 100 }
      });
    });

    expect(result.current.users.size).toBe(1);
    expect(mockStore.updateCursorPosition).toHaveBeenCalled();
    expect(mockStore.updatePresence).toHaveBeenCalled();
  });

  it('should handle temporary disconnections', async () => {
    const onConnectionChange = vi.fn();
    
    const { result } = renderHook(() =>
      useCollaboration(TEST_WORKSPACE_ID, TEST_USER_ID, { onConnectionChange })
    );

    // Simulate disconnection
    await act(async () => {
      mockStore.isConnected = false;
    });

    expect(onConnectionChange).toHaveBeenCalledWith(false);
    expect(result.current.connectionStatus).toBe('disconnected');

    // Simulate reconnection
    await act(async () => {
      mockStore.isConnected = true;
    });

    expect(onConnectionChange).toHaveBeenCalledWith(true);
    expect(result.current.connectionStatus).toBe('connected');
  });
});