import React, { memo, useEffect, useRef } from 'react';
import { Position } from 'reactflow'; // v11.0.0
import { useCursor } from '../../hooks/useCursor';
import { useCollaborationStore } from '../../store/collaboration.store';

// Constants for cursor animation and performance
const CURSOR_UPDATE_INTERVAL = 16; // ~60fps
const CURSOR_INACTIVE_TIMEOUT = 5000;
const CURSOR_FADE_DURATION = 200;

interface CursorOverlayProps {
  currentUserId: string;
  reactFlowInstance: any; // ReactFlow instance type
}

interface CursorData {
  position: Position;
  lastUpdate: number;
  state: 'active' | 'inactive';
}

/**
 * Component that renders real-time cursor positions of all active users
 * with smooth animation and performance optimization
 */
const CursorOverlay: React.FC<CursorOverlayProps> = memo(({ currentUserId, reactFlowInstance }) => {
  const { updatePosition, cursors } = useCursor();
  const { users } = useCollaborationStore();
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<Map<string, number>>(new Map());

  // Set up cursor position update loop
  useEffect(() => {
    const updateCursorPositions = () => {
      const now = Date.now();

      // Update cursor states based on activity
      cursors.forEach((cursor, userId) => {
        const lastUpdate = lastUpdateRef.current.get(userId) || 0;
        const timeSinceUpdate = now - lastUpdate;

        if (timeSinceUpdate > CURSOR_INACTIVE_TIMEOUT) {
          cursor.state = 'inactive';
        }
      });

      animationFrameRef.current = requestAnimationFrame(updateCursorPositions);
    };

    animationFrameRef.current = requestAnimationFrame(updateCursorPositions);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cursors]);

  // Transform cursor position to viewport coordinates
  const transformPosition = (position: Position): Position => {
    if (!reactFlowInstance || !position) return position;

    try {
      const transformed = reactFlowInstance.project({
        x: position.x,
        y: position.y
      });

      return {
        x: Math.round(transformed.x * 100) / 100,
        y: Math.round(transformed.y * 100) / 100
      };
    } catch (error) {
      console.error('Error transforming cursor position:', error);
      return position;
    }
  };

  // Render cursor elements for each active user
  const renderCursors = () => {
    const cursorElements: JSX.Element[] = [];

    cursors.forEach((cursor, userId) => {
      // Skip current user's cursor
      if (userId === currentUserId) return;

      const user = users.get(userId);
      if (!user || !cursor.position) return;

      const transformedPosition = transformPosition(cursor.position);
      if (!transformedPosition) return;

      const isActive = cursor.state === 'active';
      const opacity = isActive ? 1 : 0;

      cursorElements.push(
        <div
          key={userId}
          className="cursor-element"
          style={{
            ...styles.cursor,
            transform: `translate(${transformedPosition.x}px, ${transformedPosition.y}px)`,
            opacity,
            transition: `opacity ${CURSOR_FADE_DURATION}ms ease-out`,
            backgroundColor: `hsl(${hashString(userId) % 360}, 70%, 50%)`
          }}
        >
          <div className="cursor-pointer" style={styles.cursorPointer}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M5,2l15,15l-5,2l-3,3l-3-7L5,2z"
              />
            </svg>
          </div>
          <div className="cursor-label" style={styles.cursorLabel}>
            {user.name}
          </div>
          <div
            className="cursor-state"
            style={{
              ...styles.cursorState,
              backgroundColor: isActive ? '#4caf50' : '#9e9e9e'
            }}
          />
        </div>
      );
    });

    return cursorElements;
  };

  return (
    <div className="cursor-overlay" style={styles.cursorOverlay}>
      {renderCursors()}
    </div>
  );
});

// Utility function to generate consistent colors from strings
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

// Styles
const styles = {
  cursorOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
    zIndex: 100,
    overflow: 'hidden'
  },
  cursor: {
    position: 'absolute' as const,
    width: '24px',
    height: '24px',
    transform: 'translate(-50%, -50%)',
    transition: 'transform 0.1s ease-out',
    pointerEvents: 'none' as const,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
  },
  cursorPointer: {
    width: '100%',
    height: '100%',
    color: 'white'
  },
  cursorLabel: {
    position: 'absolute' as const,
    left: '16px',
    top: '8px',
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    whiteSpace: 'nowrap' as const,
    transition: 'opacity 0.2s ease-out',
    userSelect: 'none' as const
  },
  cursorState: {
    position: 'absolute' as const,
    right: '-4px',
    bottom: '-4px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '2px solid white'
  }
};

CursorOverlay.displayName = 'CursorOverlay';

export default CursorOverlay;