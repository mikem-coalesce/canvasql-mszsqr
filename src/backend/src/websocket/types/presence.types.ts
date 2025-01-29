/**
 * @fileoverview Type definitions for real-time user presence management in collaborative ERD workspaces
 * @version 1.0.0
 */

import { IAuthUser } from '../../core/interfaces/auth.interface';

/**
 * Enumeration of possible user presence statuses in a workspace
 */
export enum UserStatus {
  /** User is connected and active */
  ONLINE = 'ONLINE',
  
  /** User is connected but inactive for > 5 minutes */
  IDLE = 'IDLE',
  
  /** User is actively making changes to the ERD */
  EDITING = 'EDITING',
  
  /** User is viewing the ERD without making changes */
  VIEWING = 'VIEWING'
}

/**
 * Enumeration of presence event types for real-time state updates
 */
export enum PresenceEventType {
  /** User joined the workspace */
  JOIN = 'JOIN',
  
  /** User left the workspace */
  LEAVE = 'LEAVE',
  
  /** User status or position updated */
  UPDATE = 'UPDATE'
}

/**
 * Interface defining the structure of individual user presence data
 */
export interface UserPresence {
  /** Unique identifier of the user from IAuthUser */
  userId: string;
  
  /** Current presence status of the user */
  status: UserStatus;
  
  /** Timestamp of user's last activity (Unix ms) */
  lastActive: number;
  
  /** ID of workspace user is present in */
  workspaceId: string;
  
  /** User's cursor position on the canvas, null if not actively viewing */
  cursorPosition: { x: number; y: number } | null;
}

/**
 * Interface for tracking presence state at the workspace level
 * Includes user limits and aggregate metrics
 */
export interface WorkspacePresence {
  /** Map of active users in the workspace, keyed by userId */
  users: Map<string, UserPresence>;
  
  /** Timestamp of last workspace presence update */
  lastUpdated: number;
  
  /** Current count of active users */
  activeUsers: number;
  
  /** Maximum allowed concurrent users (25 per workspace) */
  maxUsers: number;
}

/**
 * Interface for presence update event messages
 * Used for broadcasting presence changes to all workspace users
 */
export interface PresenceUpdate {
  /** Type of presence event that occurred */
  type: PresenceEventType;
  
  /** ID of user whose presence changed */
  userId: string;
  
  /** Updated presence data */
  presence: UserPresence;
  
  /** Timestamp when update occurred (Unix ms) */
  timestamp: number;
}