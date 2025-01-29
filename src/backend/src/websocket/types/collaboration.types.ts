/**
 * Type definitions for real-time collaboration features including shared document state,
 * change tracking, and synchronization events
 * @version 1.0.0
 */

import * as Y from 'yjs'; // ^13.6.1
import { IDiagram } from '../../core/interfaces/diagram.interface';
import { UserPresence } from './presence.types';
import { CursorData } from './cursor.types';

/**
 * Represents the shared state for real-time collaboration on a diagram
 * Manages concurrent users, document state, and awareness with < 100ms sync latency
 */
export interface CollaborationState {
  /** Unique identifier of the diagram being collaborated on */
  diagramId: string;

  /** Map of active users and their presence information */
  users: Map<string, UserPresence>;

  /** Y.js shared document containing diagram state */
  document: Y.Doc;

  /** Y.js awareness instance for cursor and presence tracking */
  awareness: Y.Awareness;

  /** Maximum number of concurrent users allowed (25 per workspace) */
  userLimit: number;

  /** Timestamp of last state synchronization in milliseconds */
  lastSyncTimestamp: number;
}

/**
 * Enumeration of collaboration event types for real-time updates
 * Covers all synchronization and state management events
 */
export enum CollaborationEventType {
  /** Initial state synchronization */
  SYNC = 'collaboration.sync',

  /** Incremental state update */
  UPDATE = 'collaboration.update',

  /** Undo operation */
  UNDO = 'collaboration.undo',

  /** Redo operation */
  REDO = 'collaboration.redo',

  /** Error during collaboration */
  ERROR = 'collaboration.error',

  /** Client reconnection attempt */
  RECONNECT = 'collaboration.reconnect'
}

/**
 * Structure of collaboration events sent through WebSocket
 * Includes timing data for latency monitoring (target < 100ms)
 */
export interface CollaborationEvent {
  /** Type of collaboration event */
  type: CollaborationEventType;

  /** Event-specific payload data */
  data: any;

  /** ID of user who triggered the event */
  userId: string;

  /** Event timestamp in milliseconds */
  timestamp: number;

  /** Event processing latency in milliseconds */
  latency: number;
}

/**
 * Structure of Y.js state updates for synchronization
 * Used for efficient delta-based state synchronization
 */
export interface CollaborationUpdate {
  /** ID of diagram being updated */
  diagramId: string;

  /** Binary update data from Y.js */
  update: Uint8Array;

  /** Update origin identifier */
  origin: string;

  /** Update timestamp in milliseconds */
  timestamp: number;

  /** Monotonically increasing version number */
  version: number;
}

/**
 * Structure of diagram state snapshot for persistence
 * Used when saving collaboration state to database
 */
export interface CollaborationSnapshot {
  /** Diagram identifier */
  diagramId: string;

  /** Serialized Y.js document state */
  state: Uint8Array;

  /** Vector clock version */
  version: number;

  /** Snapshot timestamp */
  timestamp: number;

  /** User who triggered the snapshot */
  userId: string;
}

/**
 * Configuration options for collaboration features
 */
export interface CollaborationConfig {
  /** Maximum allowed users per diagram */
  maxUsers: number;

  /** Sync interval in milliseconds */
  syncInterval: number;

  /** Awareness update debounce time in milliseconds */
  awarenessDebounce: number;

  /** Whether to enable cursor tracking */
  enableCursors: boolean;

  /** Whether to enable presence indicators */
  enablePresence: boolean;
}

/**
 * Error types specific to collaboration features
 */
export enum CollaborationErrorType {
  /** User limit exceeded */
  USER_LIMIT_EXCEEDED = 'USER_LIMIT_EXCEEDED',

  /** Sync conflict detected */
  SYNC_CONFLICT = 'SYNC_CONFLICT',

  /** Network connectivity issue */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** State corruption detected */
  STATE_CORRUPTION = 'STATE_CORRUPTION',

  /** Permission denied */
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

/**
 * Structure of collaboration error events
 */
export interface CollaborationError {
  /** Error type identifier */
  type: CollaborationErrorType;

  /** Error message */
  message: string;

  /** Error timestamp */
  timestamp: number;

  /** Associated user ID */
  userId: string;

  /** Additional error context */
  context?: Record<string, any>;
}