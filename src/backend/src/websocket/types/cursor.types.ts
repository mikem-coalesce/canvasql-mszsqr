/**
 * Type definitions for real-time cursor tracking and movement in collaborative ERD workspaces
 * @version 1.0.0
 */

import { IAuthUser } from '../../core/interfaces/auth.interface';

/**
 * Defines the x,y coordinates of a cursor in the workspace canvas
 * Used for precise cursor position tracking with < 100ms latency
 */
export interface CursorPosition {
  /** X-coordinate in the workspace canvas */
  x: number;

  /** Y-coordinate in the workspace canvas */
  y: number;
}

/**
 * Defines the complete cursor information including user details and visual properties
 * Associates cursor data with authenticated users for presence tracking
 */
export interface CursorData {
  /** Unique identifier of the user owning this cursor */
  userId: string;

  /** Current cursor position coordinates */
  position: CursorPosition;

  /** Cursor highlight color for visual differentiation */
  color: string;

  /** Display name of the user for cursor label */
  username: string;
}

/**
 * Defines the types of cursor events that can occur in the collaborative workspace
 * Used for real-time cursor state management and updates
 */
export enum CursorEventType {
  /** Cursor position update event */
  MOVE = 'cursor.move',

  /** Cursor entering workspace event */
  ENTER = 'cursor.enter',

  /** Cursor leaving workspace event */
  LEAVE = 'cursor.leave'
}

/**
 * Defines the structure of cursor update events with timing for latency tracking
 * Ensures updates meet < 100ms latency requirement for real-time collaboration
 */
export interface CursorUpdate {
  /** Type of cursor event that occurred */
  type: CursorEventType;

  /** Updated cursor data including position and user info */
  cursor: CursorData;

  /** Unix timestamp in milliseconds for latency calculation */
  timestamp: number;
}