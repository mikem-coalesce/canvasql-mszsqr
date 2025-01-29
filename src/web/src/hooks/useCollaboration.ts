import { useEffect, useCallback } from 'react'; // v18.2.0
import { throttle } from 'lodash'; // v4.17.21
import { Position } from 'reactflow'; // v11.0.0

import { CollaborationService } from '../services/collaboration.service';
import { useCollaborationStore } from '../store/collaboration.store';
import { UserPresence, UserStatus } from '../types/collaboration.types';

// Constants for performance optimization and security
const CURSOR_THROTTLE_MS = 50;
const PRESENCE_CHECK_INTERVAL = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;
const UPDATE_RATE_LIMIT = 20;

interface CollaborationOptions {
  onConnectionChange?: (isConnected: boolean) => void;
  onError?: (error: Error) => void;
  onPresenceChange?: (users: UserPresence[]) => void;
  performanceMode?: 'low' | 'medium' | 'high';
}

/**
 * Custom hook for managing real-time collaboration features with optimized performance
 * and enhanced security measures.
 */
export function useCollaboration(
  workspaceId: string,
  userId: string,
  options: CollaborationOptions = {}
) {
  // Access collaboration store
  const {
    initialize,
    disconnect,
    updateCursorPosition: updateStoreCursor,
    updatePresence: updateStorePresence,
    users,
    isConnected,
    latencyMetrics
  } = useCollaborationStore();

  /**
   * Initialize collaboration service with error handling and retry logic
   */
  useEffect(() => {
    let reconnectAttempts = 0;
    let reconnectTimeout: NodeJS.Timeout;

    const setupCollaboration = async () => {
      try {
        await initialize(workspaceId, userId);
        reconnectAttempts = 0;
        options.onConnectionChange?.(true);
      } catch (error) {
        console.error('Collaboration initialization failed:', error);
        options.onError?.(error as Error);

        // Implement retry logic with backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);
          reconnectTimeout = setTimeout(setupCollaboration, delay);
        }
      }
    };

    setupCollaboration();

    // Cleanup function
    return () => {
      clearTimeout(reconnectTimeout);
      disconnect();
      options.onConnectionChange?.(false);
    };
  }, [workspaceId, userId, initialize, disconnect, options]);

  /**
   * Monitor and notify presence changes
   */
  useEffect(() => {
    const checkPresence = () => {
      const activeUsers = Array.from(users.values()).filter(user => 
        user.status !== UserStatus.OFFLINE &&
        Date.now() - user.lastActive.getTime() < PRESENCE_CHECK_INTERVAL
      );
      options.onPresenceChange?.(activeUsers);
    };

    const intervalId = setInterval(checkPresence, PRESENCE_CHECK_INTERVAL);
    checkPresence(); // Initial check

    return () => clearInterval(intervalId);
  }, [users, options]);

  /**
   * Throttled cursor position update with performance optimization
   */
  const handleCursorUpdate = useCallback(
    throttle((position: Position) => {
      if (!isConnected) return;

      const now = Date.now();
      const recentUpdates = latencyMetrics.get('cursor') || [];
      const recentCount = recentUpdates.filter(
        timestamp => now - timestamp < 1000
      ).length;

      // Apply rate limiting
      if (recentCount >= UPDATE_RATE_LIMIT) return;

      // Track performance
      const startTime = performance.now();
      updateStoreCursor(position);
      const updateTime = performance.now() - startTime;

      // Log performance metrics if in high performance mode
      if (options.performanceMode === 'high') {
        console.debug(`Cursor update latency: ${updateTime}ms`);
      }
    }, CURSOR_THROTTLE_MS, { leading: true, trailing: true }),
    [isConnected, updateStoreCursor, latencyMetrics, options.performanceMode]
  );

  /**
   * Enhanced presence update with status validation and timeout handling
   */
  const updatePresence = useCallback((status: UserStatus) => {
    if (!isConnected) return;

    const presence: UserPresence = {
      userId,
      status,
      lastActive: new Date(),
      cursorPosition: null,
      name: userId // This should come from user profile in a real implementation
    };

    updateStorePresence(status);
  }, [isConnected, userId, updateStorePresence]);

  /**
   * Calculate and expose performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    const metrics = Array.from(latencyMetrics.entries()).reduce((acc, [key, values]) => {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      acc[key] = {
        average: avg,
        max: Math.max(...values),
        min: Math.min(...values)
      };
      return acc;
    }, {} as Record<string, { average: number; max: number; min: number }>);

    return metrics;
  }, [latencyMetrics]);

  return {
    // Connection state
    isConnected,
    
    // Collaboration features
    users,
    updateCursorPosition: handleCursorUpdate,
    updatePresence,
    
    // Performance monitoring
    performanceMetrics: getPerformanceMetrics(),
    
    // Active users
    activeUsers: Array.from(users.values()).filter(
      user => user.status !== UserStatus.OFFLINE
    ),
    
    // Connection status
    connectionStatus: isConnected ? 'connected' : 'disconnected'
  };
}

export default useCollaboration;