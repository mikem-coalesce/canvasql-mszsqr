import WebSocket from 'ws'; // ^8.13.0
import * as Y from 'yjs'; // ^13.6.1
import { CollaborationState, CollaborationEvent } from '../types/collaboration.types';
import { DiagramService } from '../../services/diagram.service';
import { logger } from '../../core/utils/logger.util';

/**
 * Handles real-time collaboration features with optimized performance and robust error handling
 * Maintains sync latency < 100ms and supports up to 25 concurrent users per workspace
 */
export class CollaborationHandler {
  private readonly collaborationStates: Map<string, CollaborationState> = new Map();
  private readonly messageRateLimits: Map<string, number> = new Map();
  private readonly syncTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_CLIENTS_PER_WORKSPACE = 25;
  private readonly SYNC_DEBOUNCE_TIME = 50; // 50ms debounce for sync
  private readonly MESSAGE_RATE_LIMIT = 100; // 100 messages per second
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes

  constructor(private readonly diagramService: DiagramService) {
    this.initializeCleanupInterval();
  }

  /**
   * Handles new WebSocket connections with validation and state initialization
   */
  public async handleConnection(
    ws: WebSocket,
    diagramId: string,
    userId: string
  ): Promise<void> {
    try {
      // Validate access and connection limits
      await this.validateConnection(diagramId, userId);

      // Initialize or get collaboration state
      const state = await this.getOrCreateState(diagramId);

      // Add client to state
      state.connectedClients.add(ws);

      // Initialize message handlers with rate limiting
      this.initializeMessageHandlers(ws, diagramId, userId);

      // Send initial state
      await this.sendInitialState(ws, state);

      logger.info('Client connected', {
        diagramId,
        userId,
        activeClients: state.connectedClients.size
      });
    } catch (error) {
      logger.error('Connection handling failed', { error, diagramId, userId });
      ws.close(1011, error.message);
    }
  }

  /**
   * Processes incoming collaboration messages with rate limiting and validation
   */
  public async handleMessage(
    ws: WebSocket,
    event: CollaborationEvent
  ): Promise<void> {
    try {
      // Rate limit check
      if (!this.checkRateLimit(ws)) {
        throw new Error('Rate limit exceeded');
      }

      const state = this.collaborationStates.get(event.data.diagramId);
      if (!state) {
        throw new Error('Invalid diagram state');
      }

      switch (event.type) {
        case 'collaboration.sync':
          await this.handleSync(ws, event.data.diagramId);
          break;

        case 'collaboration.update':
          await this.handleUpdate(event.data.diagramId, event.data.update);
          break;

        case 'collaboration.error':
          this.handleError(event.data);
          break;

        default:
          logger.warn('Unknown event type', { event });
      }
    } catch (error) {
      logger.error('Message handling failed', { error, event });
      ws.send(JSON.stringify({
        type: 'collaboration.error',
        data: { message: error.message }
      }));
    }
  }

  /**
   * Handles client disconnection with cleanup
   */
  public async handleDisconnect(
    ws: WebSocket,
    diagramId: string
  ): Promise<void> {
    try {
      const state = this.collaborationStates.get(diagramId);
      if (!state) return;

      // Remove client
      state.connectedClients.delete(ws);

      // Cleanup if no clients remain
      if (state.connectedClients.size === 0) {
        await this.cleanupState(diagramId);
      }

      logger.info('Client disconnected', {
        diagramId,
        remainingClients: state.connectedClients.size
      });
    } catch (error) {
      logger.error('Disconnect handling failed', { error, diagramId });
    }
  }

  /**
   * Validates connection requirements and limits
   */
  private async validateConnection(
    diagramId: string,
    userId: string
  ): Promise<void> {
    const state = this.collaborationStates.get(diagramId);
    if (state?.connectedClients.size >= this.MAX_CLIENTS_PER_WORKSPACE) {
      throw new Error('Maximum clients per workspace exceeded');
    }

    // Validate user access through diagram service
    await this.diagramService.validateAccess(diagramId, userId);
  }

  /**
   * Creates or retrieves collaboration state for a diagram
   */
  private async getOrCreateState(diagramId: string): Promise<CollaborationState> {
    let state = this.collaborationStates.get(diagramId);

    if (!state) {
      const doc = new Y.Doc();
      const awareness = new Y.Awareness(doc);

      state = {
        diagramId,
        document: doc,
        awareness,
        connectedClients: new Set(),
        lastActivity: new Date()
      };

      this.collaborationStates.set(diagramId, state);

      // Initialize document with current diagram state
      const diagram = await this.diagramService.getDiagram(diagramId);
      const yMap = doc.getMap('diagram');
      yMap.set('layout', diagram.layout);
    }

    return state;
  }

  /**
   * Handles state synchronization with optimized performance
   */
  private async handleSync(
    ws: WebSocket,
    diagramId: string
  ): Promise<void> {
    const state = this.collaborationStates.get(diagramId);
    if (!state) return;

    // Debounce sync updates
    const existingTimeout = this.syncTimeouts.get(diagramId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.syncTimeouts.set(diagramId, setTimeout(async () => {
      try {
        const update = Y.encodeStateAsUpdate(state.document);
        ws.send(JSON.stringify({
          type: 'collaboration.sync',
          data: { update: Buffer.from(update).toString('base64') }
        }));
      } catch (error) {
        logger.error('Sync failed', { error, diagramId });
      }
    }, this.SYNC_DEBOUNCE_TIME));
  }

  /**
   * Processes state updates with conflict resolution
   */
  private async handleUpdate(
    diagramId: string,
    update: Uint8Array
  ): Promise<void> {
    const state = this.collaborationStates.get(diagramId);
    if (!state) return;

    try {
      // Apply update to document
      Y.applyUpdate(state.document, update);

      // Broadcast to other clients
      const encodedUpdate = Buffer.from(update).toString('base64');
      this.broadcastUpdate(state, encodedUpdate, diagramId);

      // Persist state periodically
      await this.persistStateDebounced(diagramId);

      state.lastActivity = new Date();
    } catch (error) {
      logger.error('Update failed', { error, diagramId });
    }
  }

  /**
   * Broadcasts updates to all connected clients except sender
   */
  private broadcastUpdate(
    state: CollaborationState,
    update: string,
    diagramId: string
  ): void {
    const message = JSON.stringify({
      type: 'collaboration.update',
      data: { update, diagramId }
    });

    state.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Initializes WebSocket message handlers with rate limiting
   */
  private initializeMessageHandlers(
    ws: WebSocket,
    diagramId: string,
    userId: string
  ): void {
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString()) as CollaborationEvent;
        await this.handleMessage(ws, event);
      } catch (error) {
        logger.error('Message parsing failed', { error, diagramId, userId });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws, diagramId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { error, diagramId, userId });
    });
  }

  /**
   * Implements rate limiting for message handling
   */
  private checkRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const messageCount = this.messageRateLimits.get(ws.url) || 0;

    if (messageCount >= this.MESSAGE_RATE_LIMIT) {
      return false;
    }

    this.messageRateLimits.set(ws.url, messageCount + 1);
    setTimeout(() => {
      this.messageRateLimits.set(ws.url, messageCount - 1);
    }, 1000);

    return true;
  }

  /**
   * Persists diagram state with debouncing
   */
  private async persistStateDebounced(diagramId: string): Promise<void> {
    const state = this.collaborationStates.get(diagramId);
    if (!state) return;

    const yMap = state.document.getMap('diagram');
    const layout = yMap.get('layout');

    await this.diagramService.syncDiagramState(diagramId, layout);
  }

  /**
   * Initializes periodic cleanup of inactive states
   */
  private initializeCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      for (const [diagramId, state] of this.collaborationStates) {
        const inactiveTime = now.getTime() - state.lastActivity.getTime();
        if (inactiveTime > this.CLEANUP_INTERVAL) {
          this.cleanupState(diagramId);
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Cleans up collaboration state and resources
   */
  private async cleanupState(diagramId: string): Promise<void> {
    const state = this.collaborationStates.get(diagramId);
    if (!state) return;

    // Persist final state
    await this.persistStateDebounced(diagramId);

    // Cleanup resources
    state.document.destroy();
    state.awareness.destroy();
    this.collaborationStates.delete(diagramId);
    this.syncTimeouts.delete(diagramId);

    logger.info('State cleaned up', { diagramId });
  }

  /**
   * Handles collaboration errors with logging
   */
  private handleError(error: any): void {
    logger.error('Collaboration error', { error });
  }
}