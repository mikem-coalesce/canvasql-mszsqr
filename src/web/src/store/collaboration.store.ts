import { create } from 'zustand'; // v4.4.1
import { devtools } from 'zustand/middleware'; // v4.4.1
import { Position } from 'reactflow'; // v11.0.0
import { throttle } from 'lodash'; // v4.17.21

import { CollaborationService } from '../services/collaboration.service';
import { CollaborationState, UserPresence, UserStatus } from '../types/collaboration.types';

// Constants for performance optimization
const CURSOR_THROTTLE_MS = 50;
const PRESENCE_UPDATE_INTERVAL = 30000;
const MAX_LATENCY_SAMPLES = 100;
const PERFORMANCE_WINDOW_MS = 60000;

interface CollaborationStore {
  // Service and connection state
  service: CollaborationService | null;
  diagramId: string | null;
  isConnected: boolean;
  isInitializing: boolean;

  // User and presence tracking
  users: Map<string, UserPresence>;
  userCount: number;
  lastSyncTimestamp: number;

  // Performance metrics
  latencyMetrics: Map<string, number[]>;
  averageLatency: number;

  // Actions
  initialize: (diagramId: string, userId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  updateCursorPosition: (position: Position) => void;
  updatePresence: (status: UserStatus) => void;
  getActiveUsers: () => UserPresence[];
  getLatencyMetrics: () => { average: number; max: number; min: number };
}

export const useCollaborationStore = create<CollaborationStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      service: null,
      diagramId: null,
      isConnected: false,
      isInitializing: false,
      users: new Map(),
      userCount: 0,
      lastSyncTimestamp: 0,
      latencyMetrics: new Map(),
      averageLatency: 0,

      // Initialize collaboration service with performance monitoring
      initialize: async (diagramId: string, userId: string) => {
        try {
          set({ isInitializing: true });

          const service = new CollaborationService(userId, diagramId, {
            wsUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
            retryAttempts: 3,
            retryDelay: 1000
          });

          // Set up performance monitoring
          const monitorLatency = (operation: string, latency: number) => {
            const metrics = get().latencyMetrics;
            const samples = metrics.get(operation) || [];
            const now = Date.now();

            // Keep only recent samples within the performance window
            const recentSamples = [
              ...samples.filter(s => now - s < PERFORMANCE_WINDOW_MS),
              latency
            ].slice(-MAX_LATENCY_SAMPLES);

            metrics.set(operation, recentSamples);
            set({ latencyMetrics: new Map(metrics) });
          };

          // Connect with performance tracking
          const startTime = performance.now();
          await service.connect();
          monitorLatency('connection', performance.now() - startTime);

          // Set up throttled cursor updates
          const throttledCursorUpdate = throttle(
            (position: Position) => {
              const updateStart = performance.now();
              service.updateCursor(position);
              monitorLatency('cursorUpdate', performance.now() - updateStart);
            },
            CURSOR_THROTTLE_MS,
            { leading: true, trailing: true }
          );

          // Set up presence monitoring
          setInterval(() => {
            const { users } = get();
            set({ userCount: users.size });
          }, PRESENCE_UPDATE_INTERVAL);

          // Update store state
          set({
            service,
            diagramId,
            isConnected: true,
            users: new Map(),
            lastSyncTimestamp: Date.now()
          });

          // Set up event handlers
          service.onStateChange((state: CollaborationState) => {
            set({ 
              users: state.users,
              lastSyncTimestamp: Date.now()
            });
          });

        } catch (error) {
          console.error('Failed to initialize collaboration:', error);
          throw error;
        } finally {
          set({ isInitializing: false });
        }
      },

      // Disconnect and cleanup
      disconnect: async () => {
        const { service } = get();
        if (service) {
          await service.disconnect();
          set({
            service: null,
            diagramId: null,
            isConnected: false,
            users: new Map(),
            userCount: 0
          });
        }
      },

      // Update cursor position with throttling and latency tracking
      updateCursorPosition: (position: Position) => {
        const { service } = get();
        if (service && position) {
          const startTime = performance.now();
          service.updateCursor(position);
          const latency = performance.now() - startTime;
          
          const metrics = get().latencyMetrics;
          const cursorMetrics = metrics.get('cursor') || [];
          metrics.set('cursor', [...cursorMetrics, latency].slice(-MAX_LATENCY_SAMPLES));
          
          set({ latencyMetrics: new Map(metrics) });
        }
      },

      // Update user presence status
      updatePresence: (status: UserStatus) => {
        const { service } = get();
        if (service) {
          const startTime = performance.now();
          service.updatePresence({
            status,
            lastActive: new Date(),
            cursorPosition: null
          } as UserPresence);
          
          const latency = performance.now() - startTime;
          const metrics = get().latencyMetrics;
          const presenceMetrics = metrics.get('presence') || [];
          metrics.set('presence', [...presenceMetrics, latency].slice(-MAX_LATENCY_SAMPLES));
          
          set({ latencyMetrics: new Map(metrics) });
        }
      },

      // Get list of active users
      getActiveUsers: () => {
        const { users } = get();
        const activeTimeout = PRESENCE_UPDATE_INTERVAL * 2;
        const now = Date.now();
        
        return Array.from(users.values())
          .filter(user => {
            const timeSinceActive = now - user.lastActive.getTime();
            return timeSinceActive < activeTimeout;
          })
          .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
      },

      // Get performance metrics
      getLatencyMetrics: () => {
        const { latencyMetrics } = get();
        const allLatencies = Array.from(latencyMetrics.values()).flat();
        
        return {
          average: allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length || 0,
          max: Math.max(...allLatencies, 0),
          min: Math.min(...allLatencies, 0)
        };
      }
    }),
    { name: 'collaboration-store' }
  )
);

export default useCollaborationStore;