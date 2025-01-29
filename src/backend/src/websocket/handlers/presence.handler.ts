import WebSocket from 'ws'; // ^8.0.0
import { UserStatus, PresenceEventType, UserPresence } from '../types/presence.types';
import { CacheService } from '../../services/cache.service';
import { logger } from '../../core/utils/logger.util';
import APIError from '../../core/errors/APIError';

/**
 * Manages real-time user presence in collaborative workspaces with enhanced error handling,
 * performance optimization, and security measures.
 */
export class PresenceHandler {
  private readonly PRESENCE_TTL = 300; // 5 minutes in seconds
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute in milliseconds
  private readonly RATE_LIMIT_WINDOW = 5000; // 5 seconds in milliseconds
  private readonly MAX_STATUS_UPDATES = 10; // Maximum status updates per rate limit window

  private workspaceConnections: Map<string, Set<WebSocket>>;
  private connectionLimits: Map<string, number>;
  private cleanupTimers: Map<string, NodeJS.Timeout>;
  private statusUpdateCounts: Map<string, { count: number; timestamp: number }>;

  constructor(private readonly cacheService: CacheService) {
    this.workspaceConnections = new Map();
    this.connectionLimits = new Map();
    this.cleanupTimers = new Map();
    this.statusUpdateCounts = new Map();

    // Start periodic cleanup of stale connections
    setInterval(() => this.cleanupStaleConnections(), this.CLEANUP_INTERVAL);
  }

  /**
   * Handles user joining a workspace with connection limits and validation
   */
  public async handleJoin(
    socket: WebSocket,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      // Validate workspace connection limit
      const currentConnections = this.workspaceConnections.get(workspaceId)?.size || 0;
      if (currentConnections >= 25) { // From technical specifications
        throw APIError.badRequest('Workspace connection limit reached');
      }

      // Initialize workspace connections set if not exists
      if (!this.workspaceConnections.has(workspaceId)) {
        this.workspaceConnections.set(workspaceId, new Set());
      }

      // Add socket to workspace connections
      this.workspaceConnections.get(workspaceId)!.add(socket);

      // Create initial presence data
      const presence: UserPresence = {
        userId,
        status: UserStatus.ONLINE,
        lastActive: Date.now(),
        workspaceId,
        cursorPosition: null
      };

      // Update presence in cache
      await this.cacheService.set(
        `presence:${workspaceId}:${userId}`,
        presence,
        this.PRESENCE_TTL
      );

      // Broadcast join event to workspace members
      await this.broadcastToWorkspace(workspaceId, {
        type: PresenceEventType.JOIN,
        userId,
        presence
      });

      logger.info('User joined workspace', {
        userId,
        workspaceId,
        connectionCount: currentConnections + 1
      });
    } catch (error) {
      logger.error('Error handling user join', { error, userId, workspaceId });
      throw error;
    }
  }

  /**
   * Handles user leaving a workspace with proper cleanup
   */
  public async handleLeave(
    socket: WebSocket,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      // Remove socket from workspace connections
      const connections = this.workspaceConnections.get(workspaceId);
      if (connections) {
        connections.delete(socket);
        if (connections.size === 0) {
          this.workspaceConnections.delete(workspaceId);
        }
      }

      // Remove presence data from cache
      await this.cacheService.clearNamespace(`presence:${workspaceId}:${userId}`);

      // Broadcast leave event to workspace
      await this.broadcastToWorkspace(workspaceId, {
        type: PresenceEventType.LEAVE,
        userId,
        timestamp: Date.now()
      });

      logger.info('User left workspace', { userId, workspaceId });
    } catch (error) {
      logger.error('Error handling user leave', { error, userId, workspaceId });
      throw error;
    }
  }

  /**
   * Updates user presence status with rate limiting and validation
   */
  public async updatePresence(
    userId: string,
    workspaceId: string,
    status: UserStatus
  ): Promise<void> {
    try {
      // Apply rate limiting
      if (!this.checkRateLimit(userId)) {
        throw APIError.badRequest('Too many status updates');
      }

      // Validate status
      if (!Object.values(UserStatus).includes(status)) {
        throw APIError.badRequest('Invalid status value');
      }

      // Get current presence data
      const presenceKey = `presence:${workspaceId}:${userId}`;
      const currentPresence = await this.cacheService.get<UserPresence>(presenceKey);

      if (!currentPresence) {
        throw APIError.notFound('User presence not found');
      }

      // Update presence data
      const updatedPresence: UserPresence = {
        ...currentPresence,
        status,
        lastActive: Date.now()
      };

      // Update cache with new presence data
      await this.cacheService.set(presenceKey, updatedPresence, this.PRESENCE_TTL);

      // Broadcast status update
      await this.broadcastToWorkspace(workspaceId, {
        type: PresenceEventType.UPDATE,
        userId,
        presence: updatedPresence
      });

      logger.info('User presence updated', {
        userId,
        workspaceId,
        status
      });
    } catch (error) {
      logger.error('Error updating presence', { error, userId, workspaceId, status });
      throw error;
    }
  }

  /**
   * Broadcasts presence events to workspace members with error handling
   */
  private async broadcastToWorkspace(
    workspaceId: string,
    event: any
  ): Promise<void> {
    const connections = this.workspaceConnections.get(workspaceId);
    if (!connections) return;

    const message = JSON.stringify(event);
    const deadSockets: WebSocket[] = [];

    // Batch send messages to all connected clients
    for (const socket of connections) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        } else {
          deadSockets.push(socket);
        }
      } catch (error) {
        logger.error('Error broadcasting to socket', { error, workspaceId });
        deadSockets.push(socket);
      }
    }

    // Cleanup dead sockets
    deadSockets.forEach(socket => connections.delete(socket));
  }

  /**
   * Checks rate limiting for status updates
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userUpdates = this.statusUpdateCounts.get(userId);

    if (!userUpdates || (now - userUpdates.timestamp) > this.RATE_LIMIT_WINDOW) {
      this.statusUpdateCounts.set(userId, { count: 1, timestamp: now });
      return true;
    }

    if (userUpdates.count >= this.MAX_STATUS_UPDATES) {
      return false;
    }

    userUpdates.count++;
    return true;
  }

  /**
   * Cleans up stale connections and presence data
   */
  private async cleanupStaleConnections(): Promise<void> {
    try {
      for (const [workspaceId, connections] of this.workspaceConnections.entries()) {
        const deadSockets: WebSocket[] = [];

        for (const socket of connections) {
          if (socket.readyState !== WebSocket.OPEN) {
            deadSockets.push(socket);
          }
        }

        // Remove dead sockets
        deadSockets.forEach(socket => connections.delete(socket));

        // Remove workspace if no active connections
        if (connections.size === 0) {
          this.workspaceConnections.delete(workspaceId);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up stale connections', { error });
    }
  }
}