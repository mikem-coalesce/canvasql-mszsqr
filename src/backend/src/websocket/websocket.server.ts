import WebSocket from 'ws'; // ^8.13.0
import http from 'node:http';
import jwt from 'jsonwebtoken'; // ^9.0.0
import rateLimit from 'express-rate-limit'; // ^7.0.0
import { MetricsService } from '@metrics/service'; // ^1.0.0
import { websocketConfig } from '../config/websocket.config';
import { CollaborationHandler } from './handlers/collaboration.handler';
import { CursorHandler } from './handlers/cursor.handler';
import { PresenceHandler } from './handlers/presence.handler';
import { logger } from '../core/utils/logger.util';

/**
 * Enhanced WebSocket server implementation for real-time collaboration
 * with comprehensive security, monitoring, and performance features
 */
export class WebSocketServer {
  private readonly wss: WebSocket.Server;
  private readonly collaborationHandler: CollaborationHandler;
  private readonly cursorHandler: CursorHandler;
  private readonly presenceHandler: PresenceHandler;
  private readonly workspaceConnections: Map<string, Set<WebSocket>>;
  private readonly connectionMetadata: Map<WebSocket, ConnectionMetadata>;
  private readonly metricsService: MetricsService;
  private readonly circuitBreaker: {
    failures: number;
    lastFailure: number;
    threshold: number;
    resetTimeout: number;
  };

  constructor(
    httpServer: http.Server,
    metricsService: MetricsService
  ) {
    // Initialize WebSocket server with secure configuration
    this.wss = new WebSocket.Server({
      server: httpServer,
      path: websocketConfig.path,
      clientTracking: true,
      maxPayload: 50 * 1024, // 50KB max payload
      perMessageDeflate: true
    });

    // Initialize handlers and state tracking
    this.collaborationHandler = new CollaborationHandler();
    this.cursorHandler = new CursorHandler();
    this.presenceHandler = new PresenceHandler();
    this.workspaceConnections = new Map();
    this.connectionMetadata = new Map();
    this.metricsService = metricsService;

    // Initialize circuit breaker
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      threshold: 5,
      resetTimeout: 30000 // 30 seconds
    };

    // Setup connection handling
    this.wss.on('connection', this.handleConnection.bind(this));

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Starts the WebSocket server with monitoring
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting WebSocket server', {
        port: websocketConfig.port,
        path: websocketConfig.path
      });

      // Initialize metrics collection
      this.metricsService.gauge('ws_connections_total', 0);
      this.metricsService.gauge('ws_messages_per_second', 0);
      this.metricsService.histogram('ws_message_latency', [0.1, 0.5, 1, 2, 5]);

      // Start heartbeat interval
      setInterval(() => this.checkHeartbeats(), websocketConfig.heartbeatInterval);

      logger.info('WebSocket server started successfully');
    } catch (error) {
      logger.error('Failed to start WebSocket server', { error });
      throw error;
    }
  }

  /**
   * Handles new WebSocket connections with security validation
   */
  private async handleConnection(
    socket: WebSocket,
    request: http.IncomingMessage
  ): Promise<void> {
    try {
      // Validate authentication token
      const token = this.extractToken(request);
      const decoded = await this.validateToken(token);

      // Apply rate limiting
      if (!this.checkRateLimit(request)) {
        socket.close(1008, 'Rate limit exceeded');
        return;
      }

      // Validate workspace connection limit
      const workspaceId = decoded.workspaceId;
      if (!this.checkWorkspaceLimit(workspaceId)) {
        socket.close(1013, 'Workspace connection limit exceeded');
        return;
      }

      // Register connection
      this.registerConnection(socket, workspaceId, decoded.userId);

      // Setup message handling
      socket.on('message', async (data: WebSocket.Data) => {
        try {
          await this.handleMessage(socket, data);
        } catch (error) {
          logger.error('Error handling message', { error });
          this.handleError(socket, error);
        }
      });

      // Setup disconnect handling
      socket.on('close', () => this.handleDisconnect(socket));

      // Setup error handling
      socket.on('error', (error) => {
        logger.error('WebSocket error', { error });
        this.handleError(socket, error);
      });

      // Initialize presence
      await this.presenceHandler.handleJoin(socket, decoded.userId, workspaceId);

      // Track metrics
      this.metricsService.increment('ws_connections_total');

      logger.info('Client connected', {
        userId: decoded.userId,
        workspaceId
      });
    } catch (error) {
      logger.error('Connection handling failed', { error });
      socket.close(1011, 'Authentication failed');
    }
  }

  /**
   * Handles incoming messages with validation and routing
   */
  private async handleMessage(
    socket: WebSocket,
    data: WebSocket.Data
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const message = JSON.parse(data.toString());
      const metadata = this.connectionMetadata.get(socket);

      if (!metadata) {
        throw new Error('Connection metadata not found');
      }

      // Validate message format
      if (!message.type || !message.data) {
        throw new Error('Invalid message format');
      }

      // Route message to appropriate handler
      switch (message.type) {
        case 'collaboration':
          await this.collaborationHandler.handleMessage(socket, message.data);
          break;
        case 'cursor':
          await this.cursorHandler.handleCursorMove(socket, message.data);
          break;
        case 'presence':
          await this.presenceHandler.updatePresence(
            metadata.userId,
            metadata.workspaceId,
            message.data.status
          );
          break;
        default:
          logger.warn('Unknown message type', { type: message.type });
      }

      // Track message latency
      const latency = Date.now() - startTime;
      this.metricsService.observe('ws_message_latency', latency);

    } catch (error) {
      logger.error('Message handling failed', { error });
      this.handleError(socket, error);
    }
  }

  /**
   * Handles client disconnection with cleanup
   */
  private async handleDisconnect(socket: WebSocket): Promise<void> {
    try {
      const metadata = this.connectionMetadata.get(socket);
      if (!metadata) return;

      // Clean up presence
      await this.presenceHandler.handleLeave(
        socket,
        metadata.userId,
        metadata.workspaceId
      );

      // Clean up cursor
      await this.cursorHandler.handleCursorLeave(socket);

      // Clean up collaboration
      await this.collaborationHandler.handleDisconnect(socket);

      // Remove from tracking maps
      this.removeConnection(socket);

      // Update metrics
      this.metricsService.decrement('ws_connections_total');

      logger.info('Client disconnected', {
        userId: metadata.userId,
        workspaceId: metadata.workspaceId
      });
    } catch (error) {
      logger.error('Disconnect handling failed', { error });
    }
  }

  /**
   * Monitors server health and performance
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      try {
        const metrics = {
          connections: this.wss.clients.size,
          workspaces: this.workspaceConnections.size,
          messageRate: this.calculateMessageRate(),
          memoryUsage: process.memoryUsage()
        };

        this.metricsService.gauge('ws_health', metrics);
        
        // Check circuit breaker
        this.checkCircuitBreaker();

      } catch (error) {
        logger.error('Health monitoring failed', { error });
      }
    }, 5000); // Every 5 seconds
  }

  // Helper methods...
  private extractToken(request: http.IncomingMessage): string {
    const header = request.headers['authorization'];
    if (!header) throw new Error('No authorization header');
    return header.replace('Bearer ', '');
  }

  private async validateToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, process.env.JWT_PUBLIC_KEY!);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private checkRateLimit(request: http.IncomingMessage): boolean {
    const limiter = rateLimit({
      windowMs: websocketConfig.rateLimit.windowMs,
      max: websocketConfig.rateLimit.max
    });
    return limiter(request as any, {} as any, () => true);
  }

  private checkWorkspaceLimit(workspaceId: string): boolean {
    const connections = this.workspaceConnections.get(workspaceId);
    return !connections || connections.size < websocketConfig.maxConnectionsPerWorkspace;
  }

  private registerConnection(
    socket: WebSocket,
    workspaceId: string,
    userId: string
  ): void {
    // Add to workspace connections
    let connections = this.workspaceConnections.get(workspaceId);
    if (!connections) {
      connections = new Set();
      this.workspaceConnections.set(workspaceId, connections);
    }
    connections.add(socket);

    // Store connection metadata
    this.connectionMetadata.set(socket, {
      userId,
      workspaceId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now()
    });
  }

  private removeConnection(socket: WebSocket): void {
    const metadata = this.connectionMetadata.get(socket);
    if (metadata) {
      const connections = this.workspaceConnections.get(metadata.workspaceId);
      if (connections) {
        connections.delete(socket);
        if (connections.size === 0) {
          this.workspaceConnections.delete(metadata.workspaceId);
        }
      }
      this.connectionMetadata.delete(socket);
    }
  }

  private checkCircuitBreaker(): void {
    const now = Date.now();
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      if (now - this.circuitBreaker.lastFailure < this.circuitBreaker.resetTimeout) {
        logger.error('Circuit breaker triggered - server may be unhealthy');
        // Implement circuit breaker actions here
      } else {
        // Reset circuit breaker
        this.circuitBreaker.failures = 0;
      }
    }
  }

  private calculateMessageRate(): number {
    // Implementation for message rate calculation
    return 0; // Placeholder
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [socket, metadata] of this.connectionMetadata.entries()) {
      if (now - metadata.lastHeartbeat > websocketConfig.heartbeatInterval * 2) {
        logger.warn('Client heartbeat timeout', {
          userId: metadata.userId,
          workspaceId: metadata.workspaceId
        });
        socket.terminate();
      }
    }
  }

  private handleError(socket: WebSocket, error: any): void {
    logger.error('WebSocket error', { error });
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    socket.send(JSON.stringify({ error: 'Internal server error' }));
  }
}

interface ConnectionMetadata {
  userId: string;
  workspaceId: string;
  connectedAt: number;
  lastHeartbeat: number;
}

export default WebSocketServer;