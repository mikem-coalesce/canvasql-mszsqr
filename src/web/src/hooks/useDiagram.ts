import { useCallback, useEffect, useState, useRef } from 'react'; // ^18.2.0
import { Node, Edge, Viewport, useReactFlow, useOnViewportChange } from 'reactflow'; // ^11.0.0
import { useErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { DiagramState, DiagramLayout, DiagramError } from '../types/diagram.types';
import useDiagramStore from '../store/diagram.store';
import DiagramService from '../services/diagram.service';

// Constants for configuration
const INITIAL_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const RETRY_OPTIONS = { maxRetries: 3, backoff: true };
const PERFORMANCE_THRESHOLDS = { renderTime: 100, syncLatency: 50 };

// Interface for hook options
interface DiagramOptions {
  autoSync?: boolean;
  offlineSupport?: boolean;
  performanceMonitoring?: boolean;
}

// Interface for performance metrics
interface PerformanceMetrics {
  renderTime: number;
  syncLatency: number;
  nodeCount: number;
}

// Type for sync status
type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

/**
 * Enhanced custom hook for managing diagram state and operations
 * Implements real-time collaboration, offline support, and performance monitoring
 */
export function useDiagram(diagramId: string, options: DiagramOptions = {}) {
  // Initialize React Flow instance
  const { fitView, setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  
  // Initialize error boundary
  const { showBoundary } = useErrorBoundary();

  // Initialize local state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<DiagramError | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    renderTime: 0,
    syncLatency: 0,
    nodeCount: 0
  });

  // Initialize refs for tracking
  const renderStartTime = useRef<number>(0);
  const syncStartTime = useRef<number>(0);
  const retryCount = useRef<number>(0);

  // Get diagram store state
  const {
    state: diagram,
    loadDiagram,
    updateLayout,
    updateSQLDDL,
    startCollaboration,
    stopCollaboration
  } = useDiagramStore();

  // Initialize diagram service
  const diagramService = new DiagramService();

  /**
   * Loads diagram data with retry logic and error handling
   */
  const loadDiagramData = useCallback(async () => {
    try {
      setIsLoading(true);
      setSyncStatus('syncing');
      syncStartTime.current = performance.now();

      await loadDiagram(diagramId);

      // Start real-time collaboration if enabled
      if (options.autoSync) {
        await startCollaboration();
      }

      setSyncStatus('synced');
      setPerformance(prev => ({
        ...prev,
        syncLatency: performance.now() - syncStartTime.current
      }));

    } catch (err) {
      if (retryCount.current < RETRY_OPTIONS.maxRetries) {
        retryCount.current++;
        setTimeout(loadDiagramData, RETRY_OPTIONS.backoff ? retryCount.current * 1000 : 1000);
      } else {
        setError(err as DiagramError);
        setSyncStatus('error');
        showBoundary(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [diagramId, loadDiagram, startCollaboration, options.autoSync]);

  /**
   * Updates diagram layout with performance tracking
   */
  const handleLayoutUpdate = useCallback((layout: Partial<DiagramLayout>) => {
    renderStartTime.current = performance.now();

    updateLayout(layout);

    setPerformance(prev => ({
      ...prev,
      renderTime: performance.now() - renderStartTime.current,
      nodeCount: getNodes().length
    }));
  }, [updateLayout, getNodes]);

  /**
   * Parses SQL DDL with error handling and offline support
   */
  const parseSQLDDL = useCallback(async (sql: string) => {
    try {
      setSyncStatus('syncing');
      await updateSQLDDL(sql);
      setSyncStatus('synced');
    } catch (err) {
      if (options.offlineSupport) {
        // Store changes locally for later sync
        localStorage.setItem(`diagram_${diagramId}_pending_sql`, sql);
        setSyncStatus('offline');
      } else {
        setError(err as DiagramError);
        setSyncStatus('error');
      }
    }
  }, [diagramId, updateSQLDDL, options.offlineSupport]);

  /**
   * Handles online/offline status changes
   */
  const handleConnectionChange = useCallback(() => {
    const online = navigator.onLine;
    setIsOffline(!online);
    setSyncStatus(online ? 'syncing' : 'offline');

    if (online && options.offlineSupport) {
      // Sync pending changes
      const pendingSQL = localStorage.getItem(`diagram_${diagramId}_pending_sql`);
      if (pendingSQL) {
        parseSQLDDL(pendingSQL);
        localStorage.removeItem(`diagram_${diagramId}_pending_sql`);
      }
    }
  }, [diagramId, parseSQLDDL, options.offlineSupport]);

  // Setup event listeners and initial load
  useEffect(() => {
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    loadDiagramData();

    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
      stopCollaboration();
    };
  }, [diagramId]);

  // Monitor performance if enabled
  useEffect(() => {
    if (options.performanceMonitoring && performance.renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
      console.warn('Diagram render time exceeded threshold:', performance.renderTime);
    }
  }, [performance.renderTime, options.performanceMonitoring]);

  // Handle viewport changes
  useOnViewportChange({
    onChange: (viewport: Viewport) => {
      handleLayoutUpdate({ viewport });
    }
  });

  return {
    diagram,
    isLoading,
    error,
    updateLayout: handleLayoutUpdate,
    parseSQLDDL,
    isOffline,
    syncStatus,
    performance
  };
}

export default useDiagram;