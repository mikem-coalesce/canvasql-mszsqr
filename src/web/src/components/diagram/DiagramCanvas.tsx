import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  NodeTypes,
  EdgeTypes,
  useReactFlow,
  useOnViewportChange,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  Viewport
} from 'reactflow'; // v11.0.0
import { cn } from 'class-variance-authority'; // v0.7.0
import { throttle } from 'lodash'; // v4.17.21
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

import TableNode from './nodes/TableNode';
import RelationshipEdge from './edges/RelationshipEdge';
import useDiagram from '../../hooks/useDiagram';
import useCollaboration from '../../hooks/useCollaboration';

// Constants for canvas configuration
const CANVAS_PADDING = 50;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const DEBOUNCE_DELAY = 100;
const THROTTLE_DELAY = 16;
const VIEWPORT_UPDATE_DELAY = 32;

// Node and edge type definitions
const nodeTypes: NodeTypes = {
  tableNode: TableNode
};

const edgeTypes: EdgeTypes = {
  relationshipEdge: RelationshipEdge
};

interface DiagramCanvasProps {
  diagramId: string;
  isReadOnly?: boolean;
}

/**
 * DiagramCanvas component for rendering interactive ERD visualizations
 * with real-time collaboration and virtualization support
 */
const DiagramCanvas: React.FC<DiagramCanvasProps> = memo(({ diagramId, isReadOnly = false }) => {
  // Initialize React Flow instance
  const { fitView, setNodes, setEdges } = useReactFlow();
  
  // Initialize diagram state and collaboration hooks
  const { diagram, updateLayout, error } = useDiagram(diagramId);
  const { isConnected, updateCursorPosition, awareness } = useCollaboration(diagramId);

  // Performance monitoring refs
  const renderStartTime = useRef<number>(0);
  const frameRequestRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);

  // Virtualization container ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up virtualization for large diagrams
  const rowVirtualizer = useVirtualizer({
    count: diagram?.layout.nodes.length || 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  // Memoize node and edge data
  const { nodes, edges } = useMemo(() => ({
    nodes: diagram?.layout.nodes || [],
    edges: diagram?.layout.edges || []
  }), [diagram?.layout]);

  /**
   * Optimized node change handler with throttling
   */
  const handleNodesChange = useCallback(
    throttle((changes: NodeChange[]) => {
      const now = performance.now();
      if (now - lastUpdateTime.current < THROTTLE_DELAY) return;
      lastUpdateTime.current = now;

      setNodes((nds: Node[]) => {
        const updatedNodes = [...nds];
        changes.forEach((change) => {
          if (change.type === 'position' && change.position) {
            const nodeIndex = updatedNodes.findIndex((n) => n.id === change.id);
            if (nodeIndex !== -1) {
              updatedNodes[nodeIndex] = {
                ...updatedNodes[nodeIndex],
                position: change.position
              };
            }
          }
        });
        return updatedNodes;
      });

      // Update layout in store
      updateLayout({ nodes: nodes });

    }, THROTTLE_DELAY),
    [nodes, updateLayout]
  );

  /**
   * Optimized edge change handler with validation
   */
  const handleEdgesChange = useCallback(
    throttle((changes: EdgeChange[]) => {
      setEdges((eds: Edge[]) => {
        const updatedEdges = [...eds];
        changes.forEach((change) => {
          if (change.type === 'select') {
            const edgeIndex = updatedEdges.findIndex((e) => e.id === change.id);
            if (edgeIndex !== -1) {
              updatedEdges[edgeIndex] = {
                ...updatedEdges[edgeIndex],
                selected: change.selected
              };
            }
          }
        });
        return updatedEdges;
      });

      // Update layout in store
      updateLayout({ edges: edges });
    }, THROTTLE_DELAY),
    [edges, updateLayout]
  );

  /**
   * Handle viewport changes with debouncing
   */
  useOnViewportChange({
    onChange: throttle((viewport: Viewport) => {
      updateLayout({ viewport });
    }, VIEWPORT_UPDATE_DELAY)
  });

  /**
   * Handle cursor position updates for collaboration
   */
  const handleMouseMove = useCallback(
    throttle((event: React.MouseEvent) => {
      if (!isConnected) return;

      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: (event.clientX - bounds.left) / diagram?.layout.viewport.zoom,
        y: (event.clientY - bounds.top) / diagram?.layout.viewport.zoom
      };

      updateCursorPosition(position);
    }, THROTTLE_DELAY),
    [isConnected, diagram?.layout.viewport.zoom, updateCursorPosition]
  );

  /**
   * Initialize diagram on mount
   */
  useEffect(() => {
    if (diagram && containerRef.current) {
      renderStartTime.current = performance.now();
      
      // Set initial viewport
      fitView({
        padding: CANVAS_PADDING,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM
      });

      // Log render performance
      const renderTime = performance.now() - renderStartTime.current;
      console.debug(`Diagram render time: ${renderTime}ms`);
    }
  }, [diagram, fitView]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="flex items-center justify-center h-full p-4 text-red-500">
      <p>Error loading diagram: {error.message}</p>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        ref={containerRef}
        className={cn(
          'w-full h-full',
          'bg-white dark:bg-gray-900',
          'relative overflow-hidden'
        )}
        onMouseMove={handleMouseMove}
        data-testid="diagram-canvas"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          fitView
          attributionPosition="bottom-right"
          nodesConnectable={!isReadOnly}
          nodesDraggable={!isReadOnly}
          zoomOnScroll={!isReadOnly}
          panOnDrag={!isReadOnly}
        >
          <Background />
          <Controls />
          
          {/* Collaboration cursors */}
          {isConnected && awareness?.states.size > 1 && (
            <div className="absolute top-0 left-0 pointer-events-none">
              {Array.from(awareness.states.entries()).map(([clientId, state]) => {
                if (!state.cursor || clientId === awareness.clientID) return null;
                return (
                  <div
                    key={clientId}
                    className="absolute w-4 h-4 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: state.cursor.x,
                      top: state.cursor.y,
                      backgroundColor: state.color
                    }}
                  />
                );
              })}
            </div>
          )}
        </ReactFlow>
      </div>
    </ErrorBoundary>
  );
});

DiagramCanvas.displayName = 'DiagramCanvas';

export default DiagramCanvas;