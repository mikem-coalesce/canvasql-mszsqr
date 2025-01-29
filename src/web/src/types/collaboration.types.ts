// @ts-check
import * as Y from 'yjs'; // v13.6.1 - CRDT data types for real-time collaboration
import { Position } from 'reactflow'; // v11.0.0 - Type for cursor position coordinates
import { DiagramData } from '../types/diagram.types';

/**
 * Enum defining possible user presence statuses in the collaborative session
 */
export enum UserStatus {
  ONLINE = 'online',
  IDLE = 'idle',
  OFFLINE = 'offline'
}

/**
 * Interface representing a user's presence information in the collaborative session
 * Includes user identity, status, activity tracking and cursor position
 */
export interface UserPresence {
  userId: string;
  name: string;
  status: UserStatus;
  lastActive: Date;
  cursorPosition: Position | null;
}

/**
 * Interface representing the shared state for real-time collaboration on a diagram
 * Includes Y.js document and awareness for CRDT-based synchronization
 */
export interface CollaborationState {
  diagramId: string;
  users: Map<string, UserPresence>;
  document: Y.Doc;
  awareness: Y.Awareness;
}

/**
 * Enum defining the types of collaboration events that can occur during a session
 * Used for WebSocket message type identification
 */
export enum CollaborationEventType {
  SYNC = 'collaboration.sync',
  UPDATE = 'collaboration.update',
  UNDO = 'collaboration.undo',
  REDO = 'collaboration.redo',
  PRESENCE = 'collaboration.presence',
  CURSOR = 'collaboration.cursor'
}

/**
 * Interface defining the structure of collaboration events sent through WebSocket
 * Includes event type, payload data, originating user and timestamp
 */
export interface CollaborationEvent {
  type: CollaborationEventType;
  data: any;
  userId: string;
  timestamp: number;
}

/**
 * Interface representing a Y.js state update for synchronization
 * Includes binary update data and origin information for conflict resolution
 */
export interface CollaborationUpdate {
  diagramId: string;
  update: Uint8Array;
  origin: string;
}

/**
 * Interface for cursor movement events in the collaborative session
 */
export interface CursorEvent {
  userId: string;
  position: Position;
  timestamp: number;
}

/**
 * Interface for presence update events in the collaborative session
 */
export interface PresenceEvent {
  userId: string;
  status: UserStatus;
  lastActive: Date;
}

/**
 * Interface for diagram state synchronization events
 */
export interface SyncEvent {
  diagramId: string;
  state: Uint8Array;
  version: number;
}

/**
 * Interface for undo/redo stack events in the collaborative session
 */
export interface HistoryEvent {
  userId: string;
  type: CollaborationEventType.UNDO | CollaborationEventType.REDO;
  timestamp: number;
}

/**
 * Type guard to check if an event is a cursor event
 */
export function isCursorEvent(event: CollaborationEvent): event is CollaborationEvent & { data: CursorEvent } {
  return event.type === CollaborationEventType.CURSOR;
}

/**
 * Type guard to check if an event is a presence event
 */
export function isPresenceEvent(event: CollaborationEvent): event is CollaborationEvent & { data: PresenceEvent } {
  return event.type === CollaborationEventType.PRESENCE;
}

/**
 * Type guard to check if an event is a sync event
 */
export function isSyncEvent(event: CollaborationEvent): event is CollaborationEvent & { data: SyncEvent } {
  return event.type === CollaborationEventType.SYNC;
}

/**
 * Type guard to check if an event is a history event
 */
export function isHistoryEvent(event: CollaborationEvent): event is CollaborationEvent & { data: HistoryEvent } {
  return event.type === CollaborationEventType.UNDO || event.type === CollaborationEventType.REDO;
}