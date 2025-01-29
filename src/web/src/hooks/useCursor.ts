import { useCallback, useEffect } from 'react'; // v18.2.0
import { throttle } from 'lodash'; // v4.17.21
import { Position } from '../types/collaboration.types';
import { useCollaborationStore } from '../store/collaboration.store';

// Throttle delay for cursor updates to meet sync latency requirements (<100ms)
const CURSOR_THROTTLE_DELAY = 50;

/**
 * Interface for cursor position and metadata
 */
interface CursorData {
  position: Position;
  userId: string;
  userName: string;
  timestamp: number;
  isActive: boolean;
}

/**
 * React hook for managing real-time cursor tracking and synchronization
 * with optimized performance and type safety
 * 
 * @param userId - Unique identifier of the current user
 * @param userName - Display name of the current user
 * @returns Object containing cursor management functions and state
 */
export const useCursor = (userId: string, userName: string) => {
  // Access collaboration store for cursor state management
  const { updateCursor, cursors, removeCursor } = useCollaborationStore();

  // Create throttled cursor update function for performance optimization
  const throttledUpdateCursor = useCallback(
    throttle((position: Position) => {
      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        return;
      }

      // Normalize cursor position
      const normalizedPosition: Position = {
        x: Math.round(position.x * 100) / 100, // 2 decimal precision
        y: Math.round(position.y * 100) / 100
      };

      // Update cursor in collaboration store
      updateCursor({
        position: normalizedPosition,
        userId,
        userName,
        timestamp: Date.now(),
        isActive: true
      });
    }, CURSOR_THROTTLE_DELAY, { leading: true, trailing: true }),
    [userId, userName, updateCursor]
  );

  // Set up mouse move event listener with error handling
  useEffect(() => {
    let isTracking = true;

    const handleMouseMove = (event: MouseEvent) => {
      if (!isTracking) return;

      try {
        // Get cursor position relative to viewport
        const position: Position = {
          x: event.clientX,
          y: event.clientY
        };

        throttledUpdateCursor(position);
      } catch (error) {
        console.error('Error tracking cursor:', error);
        isTracking = false;
      }
    };

    // Add event listener with passive option for performance
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Clean up event listener and throttled function
    return () => {
      isTracking = false;
      window.removeEventListener('mousemove', handleMouseMove);
      throttledUpdateCursor.cancel();
      removeCursor(userId);
    };
  }, [userId, throttledUpdateCursor, removeCursor]);

  /**
   * Manual cursor position update function
   * @param position - New cursor position
   */
  const updatePosition = useCallback((position: Position) => {
    throttledUpdateCursor(position);
  }, [throttledUpdateCursor]);

  return {
    updatePosition,
    cursors,
    isTracking: true
  };
};

export type { CursorData };
export default useCursor;