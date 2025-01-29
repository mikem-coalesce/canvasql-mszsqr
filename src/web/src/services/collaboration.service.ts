import * as Y from 'yjs'; // v13.6.1
import { Position } from 'reactflow'; // v11.0.0
import { throttle } from 'lodash'; // v4.17.21

import { WebSocketClient } from '../lib/websocket';
import { YjsProvider } from '../lib/yjs';
import { 
  CollaborationEventType,
  UserPresence,
  UserStatus,
  CollaborationEvent,
  CursorEvent,
  PresenceEvent,
  SyncEvent,
  HistoryEvent
} from '../types/collaboration.types';

// Constants for performance optimization
const CURSOR_THROTTLE_MS = 50;
const PRESENCE_UPDATE_INTERVAL = 30000;
const MAX_HISTORY_ITEMS = 100;
const SYNC_TIMEOUT = 5000;

interface CollaborationConfig {
  wsUrl: string;
  retryAttempts?: number;
  retryDelay?: number;
}

interface HistoryEntry {
  userId: string;
  action: string;
  timestamp: number;
  data: any;
}

export class CollaborationService {
  private wsClient: WebSocketClient;
  private yjsProvider: YjsProvider;
  private users: Map<string, UserPresence> = new Map();
  private changeHistory: HistoryEntry[] = [];
  private lastSyncTimestamp: number = 0;
  private connectionRetryCount: number = 0;
  private isConnected: boolean = false;
  private changeHandlers: Map<string, Function> = new Map();
  private presenceInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly userId: string,
    private readonly diagramId: string,
    config: CollaborationConfig
  ) {
    // Initialize WebSocket client
    this.wsClient = new WebSocketClient(
      config.wsUrl,
      userId,
      diagramId,
      {
        retryAttempts: config.retryAttempts,
        retryDelay: config.retryDelay
      }
    );

    // Initialize Y.js provider
    this.yjsProvider = new YjsProvider(diagramId, config.wsUrl);

    // Set up event handlers
    this.setupEventHandlers();
    
    // Initialize throttled cursor updates
    this.updateCursor = throttle(this.updateCursor.bind(this), CURSOR_THROTTLE_MS);
  }

  public async connect(): Promise<void> {
    try {
      // Connect WebSocket and Y.js provider
      await Promise.all([
        this.wsClient.connect(),
        this.yjsProvider.connect()
      ]);

      this.isConnected = true;
      this.connectionRetryCount = 0;

      // Initialize presence tracking
      this.startPresenceTracking();

      // Set initial user state
      this.updatePresence({
        userId: this.userId,
        status: UserStatus.ONLINE,
        lastActive: new Date(),
        cursorPosition: null
      } as UserPresence);

    } catch (error) {
      this.isConnected = false;
      throw new Error(`Collaboration connection failed: ${error.message}`);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      // Update presence before disconnecting
      await this.updatePresence({
        userId: this.userId,
        status: UserStatus.OFFLINE,
        lastActive: new Date(),
        cursorPosition: null
      } as UserPresence);

      // Clear presence interval
      if (this.presenceInterval) {
        clearInterval(this.presenceInterval);
      }

      // Disconnect providers
      this.wsClient.disconnect();
      this.yjsProvider.disconnect();

      this.isConnected = false;
      this.users.clear();
      this.changeHistory = [];

    } catch (error) {
      console.error('Error during disconnect:', error);
      throw error;
    }
  }

  public async updateDiagram(data: any, origin: string = 'user'): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to collaboration service');
    }

    try {
      // Start Y.js transaction
      this.yjsProvider.document.transact(() => {
        // Update shared state
        this.yjsProvider.updateState(data);

        // Add to history
        this.addToHistory({
          userId: this.userId,
          action: 'update',
          timestamp: Date.now(),
          data
        });
      }, origin);

      // Broadcast update event
      await this.wsClient.sendMessage(CollaborationEventType.UPDATE, {
        diagramId: this.diagramId,
        data,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error updating diagram:', error);
      throw error;
    }
  }

  public updateCursor(position: Position): void {
    if (!this.isConnected) return;

    const cursorEvent: CursorEvent = {
      userId: this.userId,
      position,
      timestamp: Date.now()
    };

    this.wsClient.sendMessage(CollaborationEventType.CURSOR, cursorEvent);
    
    // Update local user presence
    const userPresence = this.users.get(this.userId);
    if (userPresence) {
      userPresence.cursorPosition = position;
      userPresence.lastActive = new Date();
      this.users.set(this.userId, userPresence);
    }
  }

  public getCollaborators(): UserPresence[] {
    const now = Date.now();
    const activeTimeout = 2 * PRESENCE_UPDATE_INTERVAL;

    // Filter and sort collaborators
    return Array.from(this.users.values())
      .filter(user => user.userId !== this.userId)
      .filter(user => {
        const timeSinceActive = now - user.lastActive.getTime();
        return timeSinceActive < activeTimeout;
      })
      .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
  }

  public onStateChange(handler: (state: any) => void): void {
    this.changeHandlers.set('state', handler);
  }

  public onPresenceChange(handler: (users: UserPresence[]) => void): void {
    this.changeHandlers.set('presence', handler);
  }

  private setupEventHandlers(): void {
    // WebSocket event handlers
    this.wsClient.on(CollaborationEventType.SYNC, this.handleSync.bind(this));
    this.wsClient.on(CollaborationEventType.UPDATE, this.handleUpdate.bind(this));
    this.wsClient.on(CollaborationEventType.CURSOR, this.handleCursor.bind(this));
    this.wsClient.on(CollaborationEventType.PRESENCE, this.handlePresence.bind(this));

    // Y.js awareness changes
    this.yjsProvider.awarenessInstance.on('change', this.handleAwarenessChange.bind(this));
  }

  private startPresenceTracking(): void {
    this.presenceInterval = setInterval(() => {
      if (this.isConnected) {
        this.updatePresence({
          userId: this.userId,
          status: UserStatus.ONLINE,
          lastActive: new Date(),
          cursorPosition: this.users.get(this.userId)?.cursorPosition || null
        } as UserPresence);
      }
    }, PRESENCE_UPDATE_INTERVAL);
  }

  private async updatePresence(presence: UserPresence): Promise<void> {
    this.users.set(presence.userId, presence);
    this.yjsProvider.updateAwareness(presence);

    const presenceEvent: PresenceEvent = {
      userId: presence.userId,
      status: presence.status,
      lastActive: presence.lastActive
    };

    await this.wsClient.sendMessage(CollaborationEventType.PRESENCE, presenceEvent);
  }

  private handleSync(event: SyncEvent): void {
    this.lastSyncTimestamp = Date.now();
    const handler = this.changeHandlers.get('state');
    if (handler) {
      handler(event.state);
    }
  }

  private handleUpdate(event: CollaborationEvent): void {
    if (event.userId !== this.userId) {
      this.addToHistory({
        userId: event.userId,
        action: 'update',
        timestamp: event.timestamp,
        data: event.data
      });
    }
  }

  private handleCursor(event: CursorEvent): void {
    const userPresence = this.users.get(event.userId);
    if (userPresence) {
      userPresence.cursorPosition = event.position;
      userPresence.lastActive = new Date(event.timestamp);
      this.users.set(event.userId, userPresence);
      
      const handler = this.changeHandlers.get('presence');
      if (handler) {
        handler(Array.from(this.users.values()));
      }
    }
  }

  private handlePresence(event: PresenceEvent): void {
    const userPresence = this.users.get(event.userId) || {
      userId: event.userId,
      cursorPosition: null
    } as UserPresence;

    userPresence.status = event.status;
    userPresence.lastActive = event.lastActive;
    this.users.set(event.userId, userPresence);

    const handler = this.changeHandlers.get('presence');
    if (handler) {
      handler(Array.from(this.users.values()));
    }
  }

  private handleAwarenessChange(changes: any): void {
    const handler = this.changeHandlers.get('presence');
    if (handler) {
      handler(Array.from(this.users.values()));
    }
  }

  private addToHistory(entry: HistoryEntry): void {
    this.changeHistory.push(entry);
    if (this.changeHistory.length > MAX_HISTORY_ITEMS) {
      this.changeHistory.shift();
    }
  }
}

export default CollaborationService;