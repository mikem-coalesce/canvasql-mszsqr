import ReconnectingWebSocket from 'reconnecting-websocket'; // v4.4.0
import { Position } from 'reactflow'; // v11.0.0
import { CollaborationEventType, CollaborationEvent } from '../types/collaboration.types';
import { YjsProvider } from './yjs';

// Performance monitoring class for WebSocket operations
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private readonly METRICS_WINDOW = 60000; // 1 minute window

  recordLatency(operation: string, latency: number): void {
    const metrics = this.metrics.get(operation) || [];
    metrics.push(latency);
    // Clean old metrics
    const now = Date.now();
    const filtered = metrics.filter(m => now - m < this.METRICS_WINDOW);
    this.metrics.set(operation, filtered);
  }

  getAverageLatency(operation: string): number {
    const metrics = this.metrics.get(operation) || [];
    if (metrics.length === 0) return 0;
    return metrics.reduce((a, b) => a + b, 0) / metrics.length;
  }
}

// Message batching for optimized network usage
class MessageBatcher {
  private batch: CollaborationEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly batchSize: number,
    private readonly batchInterval: number,
    private readonly sendBatch: (events: CollaborationEvent[]) => void
  ) {}

  add(event: CollaborationEvent): void {
    this.batch.push(event);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }

  flush(): void {
    if (this.batch.length > 0) {
      this.sendBatch(this.batch);
      this.batch = [];
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Rate limiting for message sending
class RateLimiter {
  private messageCount: number = 0;
  private readonly resetInterval: NodeJS.Timeout;

  constructor(
    private readonly maxMessages: number,
    private readonly windowMs: number
  ) {
    this.resetInterval = setInterval(() => {
      this.messageCount = 0;
    }, windowMs);
  }

  canSend(): boolean {
    return this.messageCount < this.maxMessages;
  }

  increment(): void {
    this.messageCount++;
  }

  destroy(): void {
    clearInterval(this.resetInterval);
  }
}

// Security manager for WebSocket connections
class SecurityManager {
  private readonly validOrigins: Set<string>;
  private readonly tokenRefreshInterval: NodeJS.Timeout;

  constructor(origins: string[]) {
    this.validOrigins = new Set(origins);
    this.tokenRefreshInterval = setInterval(() => this.refreshToken(), 3600000);
  }

  validateMessage(event: MessageEvent): boolean {
    try {
      const data = JSON.parse(event.data);
      return this.validOrigins.has(event.origin) && 
             typeof data.type === 'string' &&
             typeof data.timestamp === 'number';
    } catch {
      return false;
    }
  }

  private refreshToken(): void {
    // Token refresh logic would go here
  }

  destroy(): void {
    clearInterval(this.tokenRefreshInterval);
  }
}

// Main WebSocket client class
export class WebSocketClient {
  private socket: ReconnectingWebSocket;
  private yjsProvider: YjsProvider;
  private readonly eventHandlers: Map<string, Function> = new Map();
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly messageBatcher: MessageBatcher;
  private readonly rateLimiter: RateLimiter;
  private readonly securityManager: SecurityManager;

  constructor(
    url: string,
    private readonly userId: string,
    private readonly workspaceId: string,
    config: {
      retryAttempts?: number;
      retryDelay?: number;
      origins?: string[];
    } = {}
  ) {
    // Initialize WebSocket with reconnection support
    this.socket = new ReconnectingWebSocket(url, [], {
      maxRetries: config.retryAttempts || WEBSOCKET_RETRY_ATTEMPTS,
      reconnectionDelayGrowFactor: 1.5,
      maxReconnectionDelay: config.retryDelay || WEBSOCKET_RETRY_DELAY,
      minReconnectionDelay: 1000,
      connectionTimeout: 4000
    });

    // Initialize Y.js provider
    this.yjsProvider = new YjsProvider(workspaceId, url);

    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor();

    // Initialize message batching
    this.messageBatcher = new MessageBatcher(
      WEBSOCKET_MESSAGE_BATCH_SIZE,
      WEBSOCKET_MESSAGE_BATCH_INTERVAL,
      (events) => this.sendBatchedMessages(events)
    );

    // Initialize rate limiting
    this.rateLimiter = new RateLimiter(
      WEBSOCKET_RATE_LIMIT_MAX_MESSAGES,
      WEBSOCKET_RATE_LIMIT_WINDOW
    );

    // Initialize security manager
    this.securityManager = new SecurityManager(config.origins || [url]);

    // Set up event handlers
    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers(): void {
    this.socket.addEventListener('message', (event: MessageEvent) => {
      const start = performance.now();
      
      if (!this.securityManager.validateMessage(event)) {
        console.error('Invalid message received');
        return;
      }

      try {
        const message = JSON.parse(event.data) as CollaborationEvent;
        this.handleMessage(message);
        
        const latency = performance.now() - start;
        this.performanceMonitor.recordLatency('messageProcessing', latency);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
  }

  private startHeartbeat(): void {
    setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage(CollaborationEventType.PRESENCE, {
          userId: this.userId,
          timestamp: Date.now()
        });
      }
    }, WEBSOCKET_HEARTBEAT_INTERVAL);
  }

  public async connect(): Promise<void> {
    try {
      await this.yjsProvider.connect();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        this.socket.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        this.socket.addEventListener('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        }, { once: true });
      });
    } catch (error) {
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  public disconnect(): void {
    this.messageBatcher.flush();
    this.rateLimiter.destroy();
    this.securityManager.destroy();
    this.yjsProvider.disconnect();
    this.socket.close();
  }

  public async sendMessage(type: CollaborationEventType, data: any): Promise<void> {
    if (!this.rateLimiter.canSend()) {
      throw new Error('Rate limit exceeded');
    }

    const event: CollaborationEvent = {
      type,
      data,
      timestamp: Date.now()
    };

    this.rateLimiter.increment();
    this.messageBatcher.add(event);
  }

  private async sendBatchedMessages(events: CollaborationEvent[]): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const start = performance.now();
    
    try {
      this.socket.send(JSON.stringify(events));
      const latency = performance.now() - start;
      this.performanceMonitor.recordLatency('messageSending', latency);
    } catch (error) {
      console.error('Error sending messages:', error);
      throw error;
    }
  }

  public updateCursor(position: Position): void {
    this.sendMessage(CollaborationEventType.CURSOR, {
      userId: this.userId,
      position,
      timestamp: Date.now()
    });
  }

  private handleMessage(event: CollaborationEvent): void {
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      handler(event.data);
    }
  }

  public on(type: CollaborationEventType, handler: Function): void {
    this.eventHandlers.set(type, handler);
  }

  public off(type: CollaborationEventType): void {
    this.eventHandlers.delete(type);
  }
}

export default WebSocketClient;