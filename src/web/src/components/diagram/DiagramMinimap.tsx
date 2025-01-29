import React, { memo, useCallback, useEffect } from 'react';
import { MiniMap, useReactFlow } from 'reactflow';
import { cn } from 'class-variance-authority';

import useDiagram from '../../hooks/useDiagram';
import useZoom from '../../hooks/useZoom';
import useTheme from '../../hooks/useTheme';

// Constants for minimap styling and behavior
const MINIMAP_STYLE = {
  height: 120,
  width: 160,
  backgroundColor: 'var(--minimap-bg)',
  maskColor: 'var(--minimap-mask)',
  borderRadius: '0.375rem',
  border: '1px solid var(--border-color)',
  transition: 'background-color 0.2s, border-color 0.2s'
};

// Node colors for different themes
const NODE_COLORS = {
  light: {
    fill: '#4f46e5', // indigo-600
    stroke: '#312e81' // indigo-900
  },
  dark: {
    fill: '#6366f1', // indigo-500
    stroke: '#4f46e5' // indigo-600
  }
};

// Accessibility attributes for the minimap
const ACCESSIBILITY_PROPS = {
  role: 'complementary',
  'aria-label': 'Diagram overview',
  tabIndex: 0,
  'aria-controls': 'diagram-canvas'
};

/**
 * DiagramMinimap component provides a miniature overview of the ERD diagram
 * with real-time collaboration support and theme-aware styling
 */
const DiagramMinimap = memo(() => {
  // Get diagram state and collaborators
  const { diagram } = useDiagram();
  
  // Get viewport control
  const { viewport } = useZoom();
  
  // Get current theme
  const { theme } = useTheme();
  
  // Get React Flow instance
  const { fitView } = useReactFlow();

  // Calculate node colors based on theme
  const nodeColors = theme === 'dark' ? NODE_COLORS.dark : NODE_COLORS.light;

  // Handle minimap click for navigation
  const handleMinimapClick = useCallback((event: React.MouseEvent) => {
    const minimap = event.currentTarget;
    const rect = minimap.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    fitView({
      duration: 500,
      padding: 0.1,
      maxZoom: viewport.maxZoom,
      minZoom: viewport.minZoom
    });
  }, [fitView, viewport]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        fitView();
        event.preventDefault();
        break;
      case 'Escape':
        event.currentTarget.blur();
        break;
    }
  }, [fitView]);

  // Update minimap colors when theme changes
  useEffect(() => {
    const minimapElement = document.querySelector('.react-flow__minimap');
    if (minimapElement) {
      minimapElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <div
      className={cn(
        'minimap-container',
        'fixed bottom-4 right-4',
        'z-10 shadow-lg',
        'transition-opacity duration-200',
        'hover:opacity-100',
        theme === 'dark' ? 'opacity-80' : 'opacity-90'
      )}
      {...ACCESSIBILITY_PROPS}
      onClick={handleMinimapClick}
      onKeyDown={handleKeyDown}
    >
      <MiniMap
        style={MINIMAP_STYLE}
        nodeColor={nodeColors.fill}
        nodeStrokeColor={nodeColors.stroke}
        nodeBorderRadius={4}
        maskStrokeColor={theme === 'dark' ? '#475569' : '#94a3b8'}
        maskStrokeWidth={2}
        position="bottom-right"
        pannable
        zoomable
        ariaLabel="Diagram minimap"
      />
      
      {/* Real-time collaboration indicators */}
      {diagram?.collaborators?.map((collaborator) => (
        <div
          key={collaborator.id}
          className={cn(
            'absolute w-2 h-2 rounded-full',
            'transform -translate-x-1/2 -translate-y-1/2',
            'transition-all duration-200'
          )}
          style={{
            left: `${(collaborator.cursor.x / viewport.zoom) * 100}%`,
            top: `${(collaborator.cursor.y / viewport.zoom) * 100}%`,
            backgroundColor: `var(--user-${collaborator.id}-color, #6366f1)`
          }}
          aria-label={`Collaborator cursor`}
        />
      ))}
    </div>
  );
});

DiagramMinimap.displayName = 'DiagramMinimap';

export default DiagramMinimap;