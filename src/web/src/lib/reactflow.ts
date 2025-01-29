import { 
  Node, 
  Edge, 
  NodeTypes, 
  EdgeTypes, 
  DefaultEdgeOptions, 
  FitViewOptions,
  PanOnScrollMode
} from 'reactflow';

import TableNode from '../components/diagram/nodes/TableNode';
import RelationshipEdge from '../components/diagram/edges/RelationshipEdge';
import { DiagramNode, DiagramEdge, DiagramViewport } from '../types/diagram.types';

/**
 * Custom node types configuration for React Flow
 * @version 11.0.0
 */
export const NODE_TYPES: NodeTypes = {
  table: TableNode
};

/**
 * Custom edge types configuration for React Flow
 * @version 11.0.0
 */
export const EDGE_TYPES: EdgeTypes = {
  relationship: RelationshipEdge
};

/**
 * Default edge options for relationship connections
 * Optimized for performance with animations disabled by default
 */
export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: 'relationship',
  animated: false
};

/**
 * Enhanced view fitting options optimized for large diagrams
 * Supports up to 100 tables with smooth zooming
 */
export const FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.2,
  minZoom: 0.5,
  maxZoom: 2,
  duration: 500
};

/**
 * Pan on scroll mode configuration for enhanced navigation
 */
export const PAN_ON_SCROLL_MODE = PanOnScrollMode.Free;

/**
 * Creates a new table node with enhanced default settings
 * @param nodeData - Node data containing table information
 * @returns Configured React Flow node
 */
export const createNode = (nodeData: DiagramNode): Node => {
  const { id, data, position } = nodeData;

  return {
    id,
    type: 'table',
    position: {
      x: position?.x || 0,
      y: position?.y || 0
    },
    data: {
      ...data,
      // Ensure required table properties
      schema: data.schema || 'public',
      columns: data.columns || [],
      constraints: data.constraints || [],
      indices: data.indices || []
    },
    // Performance optimizations
    dragHandle: '.drag-handle',
    draggable: true,
    selectable: true
  };
};

/**
 * Creates a new relationship edge with enhanced styling
 * @param edgeData - Edge data containing relationship information
 * @returns Configured React Flow edge
 */
export const createEdge = (edgeData: DiagramEdge): Edge => {
  const { id, source, target, data } = edgeData;

  return {
    id,
    source,
    target,
    type: 'relationship',
    data: {
      ...data,
      // Default to one-to-many if not specified
      type: data.type || 'one_to_many',
      // Default referential actions
      onDelete: data.onDelete || 'NO ACTION',
      onUpdate: data.onUpdate || 'NO ACTION'
    },
    // Performance optimizations
    animated: false,
    deletable: true,
    focusable: true
  };
};

/**
 * Calculates optimal node positions for auto-layout
 * Supports large diagrams with up to 100 tables
 * @param nodes - Array of diagram nodes
 * @param edges - Array of diagram edges
 * @returns Optimized viewport settings
 */
export const calculateLayout = (
  nodes: Node[], 
  edges: Edge[]
): DiagramViewport => {
  // Calculate bounding box
  const bounds = nodes.reduce(
    (acc, node) => {
      acc.minX = Math.min(acc.minX, node.position.x);
      acc.minY = Math.min(acc.minY, node.position.y);
      acc.maxX = Math.max(acc.maxX, node.position.x + 240); // Node width
      acc.maxY = Math.max(acc.maxY, node.position.y + 100); // Min node height
      return acc;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  // Calculate optimal zoom level based on diagram size
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const zoom = Math.min(
    1,
    Math.min(
      window.innerWidth / (width + 100),
      window.innerHeight / (height + 100)
    )
  );

  return {
    x: -(bounds.minX * zoom) + (window.innerWidth - width * zoom) / 2,
    y: -(bounds.minY * zoom) + (window.innerHeight - height * zoom) / 2,
    zoom: Math.max(0.5, Math.min(zoom, 2)), // Clamp between min and max zoom
    minZoom: 0.5,
    maxZoom: 2
  };
};