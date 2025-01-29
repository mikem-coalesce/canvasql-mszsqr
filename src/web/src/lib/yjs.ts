import * as Y from 'yjs'; // v13.6.1
import { WebsocketProvider } from 'y-websocket'; // v1.5.0
import { IndexeddbPersistence } from 'y-indexeddb'; // v9.0.0
import { CollaborationState, UserPresence, CollaborationEventType } from '../types/collaboration.types';

// Constants for connection retry logic
const SYNC_RETRY_ATTEMPTS = 3;
const SYNC_RETRY_DELAY = 1000;

/**
 * Provider class for managing Y.js document synchronization, awareness, and state management
 * with automatic conflict resolution and offline support
 */
export class YjsProvider {
  private doc: Y.Doc;
  private state: Y.Map<any>;
  private history: Y.Array<any>;
  private awareness: Y.Awareness;
  private wsProvider: WebsocketProvider;
  private persistence: IndexeddbPersistence;
  private retryCount: number = 0;
  private isConnected: boolean = false;

  /**
   * Initializes Y.js document and providers with error handling and retry logic
   * @param documentId - Unique identifier for the shared document
   * @param wsUrl - WebSocket server URL for real-time sync
   */
  constructor(documentId: string, wsUrl: string) {
    // Initialize Y.js document with unique ID
    this.doc = new Y.Doc();
    
    // Initialize shared state containers
    this.state = this.doc.getMap('state');
    this.history = this.doc.getArray('history');
    
    // Initialize awareness for presence tracking
    this.awareness = new Y.Awareness(this.doc);
    
    // Set up WebSocket provider with connection options
    this.wsProvider = new WebsocketProvider(wsUrl, documentId, this.doc, {
      awareness: this.awareness,
      connect: true,
      maxBackoffTime: 2000,
      disableBc: false // Enable broadcast channel
    });

    // Set up IndexedDB persistence for offline support
    this.persistence = new IndexeddbPersistence(documentId, this.doc);

    // Set up error handlers
    this.setupErrorHandlers();
    
    // Set up connection monitoring
    this.monitorConnection();
  }

  /**
   * Establishes connection and syncs document state with retry logic
   * @returns Promise that resolves when connected and synced
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const attemptConnection = async () => {
        try {
          // Wait for WebSocket connection
          await new Promise<void>((res, rej) => {
            if (this.wsProvider.wsconnected) {
              res();
            } else {
              this.wsProvider.once('status', ({ status }: { status: string }) => {
                status === 'connected' ? res() : rej(new Error('Connection failed'));
              });
            }
          });

          // Wait for persistence to load
          await new Promise<void>((res) => {
            this.persistence.once('synced', () => res());
          });

          this.isConnected = true;
          this.retryCount = 0;
          resolve();

        } catch (error) {
          if (this.retryCount < SYNC_RETRY_ATTEMPTS) {
            this.retryCount++;
            await new Promise(res => setTimeout(res, SYNC_RETRY_DELAY));
            await attemptConnection();
          } else {
            reject(new Error('Failed to connect after retries'));
          }
        }
      };

      attemptConnection();
    });
  }

  /**
   * Gracefully closes connections and cleans up resources
   */
  public disconnect(): void {
    // Clear awareness states
    this.awareness.destroy();
    
    // Destroy providers
    this.wsProvider.destroy();
    this.persistence.destroy();
    
    // Destroy Y.doc
    this.doc.destroy();
    
    this.isConnected = false;
  }

  /**
   * Updates shared document state with transaction batching
   * @param update - State update to apply
   */
  public updateState(update: any): void {
    this.doc.transact(() => {
      // Apply update to shared state
      this.state.set('data', update);
      
      // Add to history for undo/redo
      this.history.push([{
        action: 'update',
        data: update,
        timestamp: Date.now()
      }]);
    });
  }

  /**
   * Updates user awareness state with presence information
   * @param presence - User presence information to update
   */
  public updateAwareness(presence: UserPresence): void {
    this.awareness.setLocalState(presence);
  }

  /**
   * Reverts last change in history with conflict handling
   */
  public undo(): void {
    if (this.history.length > 0) {
      this.doc.transact(() => {
        const lastChange = this.history.get(this.history.length - 1);
        if (lastChange && lastChange.action === 'update') {
          // Revert the state change
          this.state.set('data', lastChange.data);
          // Remove from history
          this.history.delete(this.history.length - 1);
        }
      });
    }
  }

  /**
   * Reapplies last undone change with conflict resolution
   */
  public redo(): void {
    // Implementation would depend on maintaining a separate redo stack
    // Not implemented in this version
  }

  /**
   * Sets up error handlers for various components
   */
  private setupErrorHandlers(): void {
    this.wsProvider.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    this.persistence.on('error', (error: Error) => {
      console.error('Persistence error:', error);
    });

    this.doc.on('error', (error: Error) => {
      console.error('Y.doc error:', error);
    });
  }

  /**
   * Sets up connection status monitoring
   */
  private monitorConnection(): void {
    this.wsProvider.on('status', ({ status }: { status: string }) => {
      this.isConnected = status === 'connected';
    });

    // Handle sync status
    this.persistence.on('synced', () => {
      // Handle successful sync
    });
  }

  /**
   * Getters for accessing internal components
   */
  public get document(): Y.Doc {
    return this.doc;
  }

  public get awarenessInstance(): Y.Awareness {
    return this.awareness;
  }

  public get connected(): boolean {
    return this.isConnected;
  }
}

// Export the provider class
export default YjsProvider;