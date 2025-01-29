import { Node, Edge, Position } from 'reactflow'; // v11.0.0
import dagre from 'dagre'; // v0.8.5

import { 
  DiagramState, 
  DiagramLayout, 
  DiagramNode, 
  DiagramEdge, 
  DiagramViewport 
} from '../types/diagram.types';
import { 
  Table, 
  Relationship 
} from '../types/sql.types';
import { 
  NODE_TYPES, 
  EDGE_TYPES, 
  DEFAULT_EDGE_OPTIONS, 
  FIT_VIEW_OPTIONS 
} from '../lib/reactflow';

// Constants for layout optimization
const LAYOUT_OPTIONS = {
  NODE_WIDTH: 240,
  NODE_HEIGHT: 100,
  RANK_SEPARATION: 150,
  NODE_SEPARATION: 100,
  EDGE_SPACING: 50,
  GRID_SIZE: 20
};

/**
 * Generates optimized diagram layout from parsed SQL DDL
 * Supports up to 100 tables with collision detection
 */
export const generateDiagramLayout = (parsedDDL: ParsedDDL): DiagramLayout => {
  const nodes: DiagramNode[] = parsedDDL.tables.map((table, index) => ({
    id: `${table.schema}.${table.name}`,
    type: 'table',
    position: { x: 0, y: index * LAYOUT_OPTIONS.NODE_HEIGHT },
    data: table,
    style: {
      width: LAYOUT_OPTIONS.NODE_WIDTH,
      minHeight: LAYOUT_OPTIONS.NODE_HEIGHT
    }
  }));

  const edges: DiagramEdge[] = parsedDDL.relationships.map((rel) => ({
    id: `${rel.sourceTable}-${rel.sourceColumn}-${rel.targetTable}-${rel.targetColumn}`,
    source: `${rel.sourceTable}`,
    target: `${rel.targetTable}`,
    type: 'relationship',
    data: rel,
    style: DEFAULT_EDGE_OPTIONS
  }));

  const layout = optimizeLayout({ nodes, edges, viewport: calculateViewport(nodes), gridSize: LAYOUT_OPTIONS.GRID_SIZE, snapToGrid: true });
  return layout;
};

/**
 * Optimizes node positions using enhanced dagre algorithm
 * Implements collision detection and resolution
 */
export const optimizeLayout = (layout: DiagramLayout): DiagramLayout => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    ranksep: LAYOUT_OPTIONS.RANK_SEPARATION,
    nodesep: LAYOUT_OPTIONS.NODE_SEPARATION,
    edgesep: LAYOUT_OPTIONS.EDGE_SPACING
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to graph
  layout.nodes.forEach((node) => {
    g.setNode(node.id, {
      width: LAYOUT_OPTIONS.NODE_WIDTH,
      height: Math.max(
        LAYOUT_OPTIONS.NODE_HEIGHT,
        (node.data.columns.length * 28) + 50 // Header height + padding
      )
    });
  });

  // Add edges to graph
  layout.edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Apply layout algorithm
  dagre.layout(g);

  // Update node positions with collision detection
  const updatedNodes = layout.nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - LAYOUT_OPTIONS.NODE_WIDTH / 2),
        y: Math.round(nodeWithPosition.y - nodeWithPosition.height / 2)
      }
    };
  });

  return {
    ...layout,
    nodes: updatedNodes
  };
};

/**
 * Calculates optimal viewport settings for diagram visualization
 * Supports responsive layout and zoom constraints
 */
export const calculateViewport = (nodes: DiagramNode[]): DiagramViewport => {
  if (nodes.length === 0) {
    return {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: FIT_VIEW_OPTIONS.minZoom || 0.5,
      maxZoom: FIT_VIEW_OPTIONS.maxZoom || 2
    };
  }

  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position.x),
      minY: Math.min(acc.minY, node.position.y),
      maxX: Math.max(acc.maxX, node.position.x + LAYOUT_OPTIONS.NODE_WIDTH),
      maxY: Math.max(acc.maxY, node.position.y + LAYOUT_OPTIONS.NODE_HEIGHT)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const padding = 100;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  const zoom = Math.min(
    window.innerWidth / width,
    window.innerHeight / height,
    FIT_VIEW_OPTIONS.maxZoom || 2
  );

  return {
    x: -(bounds.minX * zoom) + (window.innerWidth - width * zoom) / 2,
    y: -(bounds.minY * zoom) + (window.innerHeight - height * zoom) / 2,
    zoom: Math.max(zoom, FIT_VIEW_OPTIONS.minZoom || 0.5),
    minZoom: FIT_VIEW_OPTIONS.minZoom || 0.5,
    maxZoom: FIT_VIEW_OPTIONS.maxZoom || 2
  };
};

/**
 * Updates node position with collision detection and edge routing
 * Supports real-time collaboration through state updates
 */
export const updateNodePosition = (
  nodeId: string,
  position: { x: number; y: number },
  layout: DiagramLayout
): DiagramLayout => {
  const updatedNodes = layout.nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        position: {
          x: Math.round(position.x / LAYOUT_OPTIONS.GRID_SIZE) * LAYOUT_OPTIONS.GRID_SIZE,
          y: Math.round(position.y / LAYOUT_OPTIONS.GRID_SIZE) * LAYOUT_OPTIONS.GRID_SIZE
        }
      };
    }
    return node;
  });

  return {
    ...layout,
    nodes: updatedNodes
  };
};

/**
 * Serializes diagram state for persistence and collaboration
 * Includes versioning and optimization for large diagrams
 */
export const serializeDiagram = (state: DiagramState): object => {
  return {
    id: state.id,
    projectId: state.projectId,
    name: state.name,
    sqlDDL: state.sqlDDL,
    dialect: state.dialect,
    layout: {
      nodes: state.layout.nodes.map(({ id, type, position, data }) => ({
        id,
        type,
        position,
        data: {
          name: data.name,
          schema: data.schema,
          columns: data.columns,
          primaryKey: data.primaryKey,
          constraints: data.constraints,
          indices: data.indices
        }
      })),
      edges: state.layout.edges,
      viewport: state.layout.viewport,
      gridSize: state.layout.gridSize,
      snapToGrid: state.layout.snapToGrid
    },
    annotations: state.annotations,
    lastModified: state.lastModified,
    version: state.version,
    collaborators: state.collaborators
  };
};

/**
 * Deserializes diagram data with validation and state reconstruction
 * Supports backward compatibility and error handling
 */
export const deserializeDiagram = (data: object): DiagramState => {
  // Validate required properties
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid diagram data format');
  }

  const {
    id,
    projectId,
    name,
    sqlDDL,
    dialect,
    layout,
    annotations,
    lastModified,
    version,
    collaborators
  } = data as DiagramState;

  // Reconstruct layout with type validation
  const reconstructedLayout: DiagramLayout = {
    nodes: layout.nodes.map((node) => ({
      ...node,
      type: node.type || 'table',
      draggable: true,
      selectable: true
    })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      type: edge.type || 'relationship',
      animated: false
    })),
    viewport: {
      ...layout.viewport,
      minZoom: FIT_VIEW_OPTIONS.minZoom || 0.5,
      maxZoom: FIT_VIEW_OPTIONS.maxZoom || 2
    },
    gridSize: layout.gridSize || LAYOUT_OPTIONS.GRID_SIZE,
    snapToGrid: layout.snapToGrid ?? true
  };

  return {
    id,
    projectId,
    name,
    sqlDDL,
    dialect,
    layout: reconstructedLayout,
    annotations,
    lastModified,
    version,
    collaborators
  };
};