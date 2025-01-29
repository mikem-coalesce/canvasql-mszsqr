import { create } from 'zustand'; // v4.4.1
import { Node, Edge, Viewport, ConnectionMode } from 'reactflow'; // v11.0.0
import { produce } from 'immer'; // v10.0.0
import { debounce } from 'lodash'; // v4.17.21

import { DiagramState, DiagramLayout, DiagramSchema } from '../types/diagram.types';
import DiagramService from '../services/diagram.service';
import YjsProvider from '../lib/yjs';
import { SQLDialect } from '../types/sql.types';
import { CollaborationEventType, UserPresence } from '../types/collaboration.types';

// Constants for configuration
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1, maxZoom: 2, minZoom: 0.1 };
const SYNC_DEBOUNCE_MS = 100;
const BATCH_UPDATE_SIZE = 50;
const MAX_UNDO_STACK = 100;

// Initial state with comprehensive type safety
const INITIAL_STATE: DiagramState = {
  id: '',
  projectId: '',
  name: '',
  sqlDDL: '',
  dialect: SQLDialect.POSTGRESQL,
  parsedDDL: {
    tables: [],
    relationships: [],
    dialect: SQLDialect.POSTGRESQL,
    schemas: [],
    metadata: {
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  },
  layout: {
    nodes: [],
    edges: [],
    viewport: DEFAULT_VIEWPORT,
    gridSize: 20,
    snapToGrid: true
  },
  annotations: {},
  lastModified: new Date().toISOString(),
  version: 1,
  collaborators: []
};

// Service instances
const diagramService = new DiagramService();
let yjsProvider: YjsProvider | null = null;

// Store implementation with real-time collaboration
const useDiagramStore = create<{
  state: DiagramState;
  isLoading: boolean;
  error: Error | null;
  undoStack: DiagramState[];
  redoStack: DiagramState[];
  
  // Actions
  loadDiagram: (diagramId: string) => Promise<void>;
  updateLayout: (layout: Partial<DiagramLayout>) => void;
  updateSQLDDL: (sql: string) => Promise<void>;
  updateAnnotations: (annotations: Record<string, any>) => void;
  undo: () => void;
  redo: () => void;
  startCollaboration: () => Promise<void>;
  stopCollaboration: () => void;
  updatePresence: (presence: UserPresence) => void;
}>((set, get) => ({
  state: INITIAL_STATE,
  isLoading: false,
  error: null,
  undoStack: [],
  redoStack: [],

  // Load diagram with error handling and validation
  loadDiagram: async (diagramId: string) => {
    try {
      set({ isLoading: true, error: null });

      const diagram = await diagramService.getDiagram(diagramId);
      
      // Validate diagram state against schema
      const validatedState = DiagramSchema.parse(diagram);
      
      set({ 
        state: validatedState,
        isLoading: false,
        undoStack: [],
        redoStack: []
      });

      // Initialize collaboration if not already started
      if (!yjsProvider) {
        await get().startCollaboration();
      }
    } catch (error) {
      set({ error: error as Error, isLoading: false });
      throw error;
    }
  },

  // Update layout with optimized batching
  updateLayout: debounce((layout: Partial<DiagramLayout>) => {
    set(produce((state: any) => {
      const currentState = state.state as DiagramState;
      
      // Push current state to undo stack
      if (state.undoStack.length >= MAX_UNDO_STACK) {
        state.undoStack.shift();
      }
      state.undoStack.push({ ...currentState });
      state.redoStack = [];

      // Update layout with type safety
      state.state.layout = {
        ...currentState.layout,
        ...layout,
        nodes: layout.nodes || currentState.layout.nodes,
        edges: layout.edges || currentState.layout.edges,
        viewport: layout.viewport || currentState.layout.viewport
      };

      // Update version and timestamp
      state.state.version++;
      state.state.lastModified = new Date().toISOString();
    }));

    // Sync changes through Y.js if connected
    if (yjsProvider?.connected) {
      yjsProvider.updateState(get().state);
    }
  }, SYNC_DEBOUNCE_MS),

  // Update SQL DDL with parsing and validation
  updateSQLDDL: async (sql: string) => {
    try {
      set(produce((state: any) => {
        state.state.sqlDDL = sql;
      }));

      // Parse and validate SQL
      const response = await diagramService.updateDiagram(get().state.id, {
        sqlDDL: sql
      });

      set(produce((state: any) => {
        state.state.parsedDDL = response.parsedDDL;
        state.state.version++;
        state.state.lastModified = new Date().toISOString();
      }));
    } catch (error) {
      set({ error: error as Error });
      throw error;
    }
  },

  // Update annotations with collaboration sync
  updateAnnotations: (annotations: Record<string, any>) => {
    set(produce((state: any) => {
      state.state.annotations = {
        ...state.state.annotations,
        ...annotations
      };
      state.state.version++;
      state.state.lastModified = new Date().toISOString();
    }));

    if (yjsProvider?.connected) {
      yjsProvider.updateState(get().state);
    }
  },

  // Undo last change with collaboration sync
  undo: () => {
    const { undoStack } = get();
    if (undoStack.length > 0) {
      set(produce((state: any) => {
        const previousState = undoStack.pop()!;
        state.redoStack.push({ ...state.state });
        state.state = previousState;
      }));

      if (yjsProvider?.connected) {
        yjsProvider.undo();
      }
    }
  },

  // Redo last undone change with collaboration sync
  redo: () => {
    const { redoStack } = get();
    if (redoStack.length > 0) {
      set(produce((state: any) => {
        const nextState = redoStack.pop()!;
        state.undoStack.push({ ...state.state });
        state.state = nextState;
      }));

      if (yjsProvider?.connected) {
        yjsProvider.redo();
      }
    }
  },

  // Start real-time collaboration
  startCollaboration: async () => {
    const { state } = get();
    if (!state.id) return;

    try {
      const wsUrl = `${process.env.VITE_WS_URL}/collaborate`;
      yjsProvider = new YjsProvider(state.id, wsUrl);
      await yjsProvider.connect();

      // Set up collaboration event handlers
      yjsProvider.document.on('update', (update: any) => {
        const newState = yjsProvider!.document.getMap('state').get('data');
        if (newState) {
          set({ state: newState });
        }
      });
    } catch (error) {
      set({ error: error as Error });
      throw error;
    }
  },

  // Stop real-time collaboration
  stopCollaboration: () => {
    if (yjsProvider) {
      yjsProvider.disconnect();
      yjsProvider = null;
    }
  },

  // Update user presence in collaboration
  updatePresence: (presence: UserPresence) => {
    if (yjsProvider?.connected) {
      yjsProvider.updateAwareness(presence);
    }
  }
}));

export default useDiagramStore;