import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'; // v11.0.0
import { cn } from 'class-variance-authority'; // v0.7.0

import { DiagramEdge } from '../../../types/diagram.types';
import { RelationType } from '../../../types/sql.types';

// SVG marker dimensions
const MARKER_SIZE = 15;
const MARKER_OFFSET = 5;

/**
 * Renders SVG marker definitions for different relationship types with theme variants
 */
const renderMarkers = (isDarkTheme: boolean): JSX.Element => {
  const markerColor = isDarkTheme ? '#e2e8f0' : '#1e293b';
  const highlightColor = isDarkTheme ? '#60a5fa' : '#3b82f6';

  return (
    <defs>
      {/* One-to-One Markers */}
      <marker
        id="one-to-one-light"
        viewBox="0 0 15 15"
        refX={MARKER_SIZE - MARKER_OFFSET}
        refY={MARKER_SIZE / 2}
        markerWidth={MARKER_SIZE}
        markerHeight={MARKER_SIZE}
        orient="auto-start-reverse"
      >
        <line
          x1="0"
          y1={MARKER_SIZE / 2}
          x2={MARKER_SIZE}
          y2={MARKER_SIZE / 2}
          stroke={markerColor}
          strokeWidth="2"
        />
        <line
          x1={MARKER_SIZE - 2}
          y1="0"
          x2={MARKER_SIZE - 2}
          y2={MARKER_SIZE}
          stroke={markerColor}
          strokeWidth="2"
        />
      </marker>

      {/* One-to-Many Markers */}
      <marker
        id="one-to-many-light"
        viewBox="0 0 15 15"
        refX={MARKER_SIZE - MARKER_OFFSET}
        refY={MARKER_SIZE / 2}
        markerWidth={MARKER_SIZE}
        markerHeight={MARKER_SIZE}
        orient="auto-start-reverse"
      >
        <path
          d={`M 0 ${MARKER_SIZE / 2} L ${MARKER_SIZE} ${MARKER_SIZE / 2} M ${MARKER_SIZE - 4} 2 L ${MARKER_SIZE - 4} ${MARKER_SIZE - 2}`}
          fill="none"
          stroke={markerColor}
          strokeWidth="2"
        />
        <circle
          cx={MARKER_SIZE - 4}
          cy={MARKER_SIZE / 2}
          r="3"
          fill={markerColor}
        />
      </marker>

      {/* Many-to-Many Markers */}
      <marker
        id="many-to-many-light"
        viewBox="0 0 15 15"
        refX={MARKER_SIZE - MARKER_OFFSET}
        refY={MARKER_SIZE / 2}
        markerWidth={MARKER_SIZE}
        markerHeight={MARKER_SIZE}
        orient="auto-start-reverse"
      >
        <circle
          cx={MARKER_SIZE - 4}
          cy={MARKER_SIZE / 2}
          r="3"
          fill={markerColor}
        />
        <circle
          cx="4"
          cy={MARKER_SIZE / 2}
          r="3"
          fill={markerColor}
        />
      </marker>

      {/* Selected state markers with highlight color */}
      <marker
        id="one-to-one-selected"
        viewBox="0 0 15 15"
        refX={MARKER_SIZE - MARKER_OFFSET}
        refY={MARKER_SIZE / 2}
        markerWidth={MARKER_SIZE}
        markerHeight={MARKER_SIZE}
        orient="auto-start-reverse"
      >
        <line
          x1="0"
          y1={MARKER_SIZE / 2}
          x2={MARKER_SIZE}
          y2={MARKER_SIZE / 2}
          stroke={highlightColor}
          strokeWidth="2"
        />
        <line
          x1={MARKER_SIZE - 2}
          y1="0"
          x2={MARKER_SIZE - 2}
          y2={MARKER_SIZE}
          stroke={highlightColor}
          strokeWidth="2"
        />
      </marker>

      {/* Repeat selected markers for other relationship types... */}
    </defs>
  );
};

/**
 * Determines the marker end type based on relationship type and theme
 */
const getMarkerEnd = (type: RelationType, selected: boolean): string => {
  const suffix = selected ? '-selected' : '-light';
  
  switch (type) {
    case RelationType.ONE_TO_ONE:
      return `url(#one-to-one${suffix})`;
    case RelationType.ONE_TO_MANY:
      return `url(#one-to-many${suffix})`;
    case RelationType.MANY_TO_MANY:
      return `url(#many-to-many${suffix})`;
    default:
      return `url(#one-to-many${suffix})`;
  }
};

/**
 * Generates edge styling based on relationship type and selection state
 */
const getEdgeStyle = (type: RelationType, selected: boolean, animated: boolean) => {
  return {
    strokeWidth: selected ? 2 : 1,
    stroke: selected ? 'var(--color-primary-500)' : 'var(--color-border)',
    animation: animated ? 'flow 20s linear infinite' : 'none',
    strokeDasharray: type === RelationType.MANY_TO_MANY ? '5 5' : 'none',
  };
};

/**
 * A React component that renders relationship edges between table nodes
 * with support for different relationship types, animations, and theme-aware styling
 */
const RelationshipEdge: React.FC<EdgeProps<DiagramEdge['data']>> = memo(({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected = false,
  animated = false,
}) => {
  // Calculate the path for the edge
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get the marker end based on relationship type
  const markerEnd = getMarkerEnd(data.type, selected);

  // Get edge styling
  const style = getEdgeStyle(data.type, selected, animated);

  return (
    <>
      {renderMarkers(false)} {/* Pass theme context here if available */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        className={cn(
          'relationship-edge',
          {
            'relationship-edge--selected': selected,
            'relationship-edge--animated': animated,
          }
        )}
      />
    </>
  );
});

RelationshipEdge.displayName = 'RelationshipEdge';

export default RelationshipEdge;