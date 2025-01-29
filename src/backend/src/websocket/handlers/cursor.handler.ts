import { WebSocket } from 'ws';
import {
  CursorPosition,
  CursorData,
  CursorEventType,
  CursorUpdate
} from '../types/cursor.types';

/**
 * Handles real-time cursor tracking and synchronization between users in collaborative ERD workspaces
 * Implements optimized performance with < 100ms latency target and workspace isolation
 * @version 1.0.0
 */
export class CursorHandler {
  // Maps workspace IDs to a map of user cursors
  private workspaceCursors: Map<string, Map<string, CursorData>>;
  
  // Maps WebSocket connections to workspace IDs
  private socketToWorkspace: Map<WebSocket, string>;
  
  // Maps workspace IDs to connected WebSockets for efficient broadcasting
  private workspaceConnections: Map<string, Set<WebSocket>>;
  
  // Configuration constants
  private readonly CURSOR_CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CURSORS_PER_WORKSPACE = 25; // From system requirements
  private readonly CURSOR_TIMEOUT = 300000; // 5 minutes of inactivity
  private readonly UPDATE_THROTTLE = 50; // 50ms minimum between updates

  constructor() {
    this.workspaceCursors = new Map();
    this.socketToWorkspace = new Map();
    this.workspaceConnections = new Map();
    
    // Start periodic cleanup of stale cursors
    setInterval(() => this.cleanupStaleCursors(), this.CURSOR_CLEANUP_INTERVAL);
  }

  /**
   * Processes and broadcasts cursor movement events with latency monitoring
   * @param socket WebSocket connection of the user
   * @param update Cursor update event data
   */
  public async handleCursorMove(socket: WebSocket, update: CursorUpdate): Promise<void> {
    try {
      const { cursor, timestamp, workspaceId } = update;
      
      // Validate workspace access
      const currentWorkspaceId = this.socketToWorkspace.get(socket);
      if (!currentWorkspaceId || currentWorkspaceId !== workspaceId) {
        throw new Error('Invalid workspace access');
      }

      // Calculate update latency
      const latency = Date.now() - timestamp;
      if (latency > 100) {
        console.warn(`High cursor latency detected: ${latency}ms`);
      }

      // Get or initialize workspace cursor map
      let workspaceCursorMap = this.workspaceCursors.get(workspaceId);
      if (!workspaceCursorMap) {
        workspaceCursorMap = new Map();
        this.workspaceCursors.set(workspaceId, workspaceCursorMap);
      }

      // Update cursor position
      const existingCursor = workspaceCursorMap.get(cursor.userId);
      if (existingCursor) {
        existingCursor.position = cursor.position;
        workspaceCursorMap.set(cursor.userId, {
          ...existingCursor,
          lastUpdate: Date.now()
        });
      }

      // Broadcast to other users in workspace
      const connections = this.workspaceConnections.get(workspaceId);
      if (connections) {
        const updateMessage = JSON.stringify({
          type: CursorEventType.MOVE,
          cursor: workspaceCursorMap.get(cursor.userId),
          timestamp: Date.now()
        });

        connections.forEach(client => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(updateMessage);
          }
        });
      }
    } catch (error) {
      console.error('Error handling cursor move:', error);
      socket.send(JSON.stringify({ error: 'Failed to update cursor position' }));
    }
  }

  /**
   * Manages cursor initialization when users join a workspace
   * @param socket WebSocket connection of the user
   * @param cursorData Initial cursor data
   * @param workspaceId Target workspace identifier
   */
  public async handleCursorEnter(
    socket: WebSocket,
    cursorData: CursorData,
    workspaceId: string
  ): Promise<void> {
    try {
      // Check workspace capacity
      const connections = this.workspaceConnections.get(workspaceId) || new Set();
      if (connections.size >= this.MAX_CURSORS_PER_WORKSPACE) {
        throw new Error('Workspace at maximum capacity');
      }

      // Initialize workspace connections if needed
      if (!this.workspaceConnections.has(workspaceId)) {
        this.workspaceConnections.set(workspaceId, new Set());
      }

      // Add socket to workspace connections
      this.workspaceConnections.get(workspaceId)!.add(socket);
      this.socketToWorkspace.set(socket, workspaceId);

      // Initialize workspace cursor map if needed
      if (!this.workspaceCursors.has(workspaceId)) {
        this.workspaceCursors.set(workspaceId, new Map());
      }

      // Add cursor to workspace
      const workspaceCursorMap = this.workspaceCursors.get(workspaceId)!;
      workspaceCursorMap.set(cursorData.userId, {
        ...cursorData,
        lastUpdate: Date.now()
      });

      // Send existing cursors to new user
      const existingCursors = Array.from(workspaceCursorMap.values());
      socket.send(JSON.stringify({
        type: 'cursor.init',
        cursors: existingCursors
      }));

      // Broadcast new cursor to other users
      connections.forEach(client => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: CursorEventType.ENTER,
            cursor: cursorData,
            timestamp: Date.now()
          }));
        }
      });
    } catch (error) {
      console.error('Error handling cursor enter:', error);
      socket.send(JSON.stringify({ error: 'Failed to initialize cursor' }));
    }
  }

  /**
   * Manages cursor cleanup when users exit a workspace
   * @param socket WebSocket connection of the leaving user
   */
  public async handleCursorLeave(socket: WebSocket): Promise<void> {
    try {
      const workspaceId = this.socketToWorkspace.get(socket);
      if (!workspaceId) return;

      const workspaceCursorMap = this.workspaceCursors.get(workspaceId);
      const connections = this.workspaceConnections.get(workspaceId);

      if (workspaceCursorMap && connections) {
        // Find and remove the cursor
        let removedCursorId: string | undefined;
        for (const [userId, cursor] of workspaceCursorMap.entries()) {
          if (cursor.userId === userId) {
            workspaceCursorMap.delete(userId);
            removedCursorId = userId;
            break;
          }
        }

        // Broadcast cursor removal
        if (removedCursorId) {
          const leaveMessage = JSON.stringify({
            type: CursorEventType.LEAVE,
            userId: removedCursorId,
            timestamp: Date.now()
          });

          connections.forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(leaveMessage);
            }
          });
        }

        // Clean up connections
        connections.delete(socket);
        if (connections.size === 0) {
          this.workspaceConnections.delete(workspaceId);
          this.workspaceCursors.delete(workspaceId);
        }
      }

      // Remove socket mapping
      this.socketToWorkspace.delete(socket);
    } catch (error) {
      console.error('Error handling cursor leave:', error);
    }
  }

  /**
   * Periodically removes inactive cursors to maintain performance
   * @private
   */
  private cleanupStaleCursors(): void {
    const now = Date.now();

    for (const [workspaceId, cursorMap] of this.workspaceCursors.entries()) {
      for (const [userId, cursor] of cursorMap.entries()) {
        if (now - (cursor as any).lastUpdate > this.CURSOR_TIMEOUT) {
          cursorMap.delete(userId);

          // Notify workspace users about removed cursor
          const connections = this.workspaceConnections.get(workspaceId);
          if (connections) {
            const cleanupMessage = JSON.stringify({
              type: CursorEventType.LEAVE,
              userId,
              timestamp: now
            });

            connections.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(cleanupMessage);
              }
            });
          }
        }
      }

      // Remove empty workspace maps
      if (cursorMap.size === 0) {
        this.workspaceCursors.delete(workspaceId);
        this.workspaceConnections.delete(workspaceId);
      }
    }
  }
}