import React, { useCallback, useEffect, useRef } from 'react';
import { useMediaQuery } from '@react-hook/media-query'; // v1.1.1
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { cn } from 'class-variance-authority'; // v0.7.0

import DiagramCanvas from '../diagram/DiagramCanvas';
import DiagramToolbar from '../diagram/DiagramToolbar';
import DiagramMinimap from '../diagram/DiagramMinimap';
import { useWorkspace } from '../../hooks/useWorkspace';

// Constants for performance monitoring
const PERFORMANCE_THRESHOLD = 100;
const RESIZE_DEBOUNCE = 100;

// Styles with consistent spacing and z-index layers
const CONTENT_STYLES = 'flex flex-col w-full h-full overflow-hidden bg-white dark:bg-gray-900 transition-colors duration-200';
const CANVAS_CONTAINER_STYLES = 'relative flex-1 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const MINIMAP_STYLES = 'absolute bottom-4 right-4 z-50 sm:block hidden';

interface MainContentProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Main content layout component that organizes the diagram workspace
 * with security, accessibility, and performance optimizations
 */
const MainContent: React.FC<MainContentProps> = ({ className, children }) => {
  // Get workspace context and security role
  const { currentWorkspace, workspaceRole } = useWorkspace();
  
  // Track performance metrics
  const renderStartTime = useRef<number>(0);
  const performanceRef = useRef<{ renderTime: number }>({ renderTime: 0 });

  // Set up responsive media queries
  const isMobile = useMediaQuery('(max-width: 640px)');
  const showMinimap = useMediaQuery('(min-width: 768px)');

  /**
   * Handles layout changes with performance tracking
   */
  const handleLayoutChange = useCallback((layout: 'horizontal' | 'vertical') => {
    renderStartTime.current = performance.now();

    // Layout change implementation would go here
    
    const renderTime = performance.now() - renderStartTime.current;
    performanceRef.current.renderTime = renderTime;

    if (renderTime > PERFORMANCE_THRESHOLD) {
      console.warn(`Layout change took ${renderTime}ms, exceeding threshold`);
    }
  }, []);

  /**
   * Monitor performance metrics
   */
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > PERFORMANCE_THRESHOLD) {
          console.warn(`Performance entry ${entry.name} took ${entry.duration}ms`);
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => observer.disconnect();
  }, []);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="flex items-center justify-center h-full p-4 text-red-500">
      <p>Error loading diagram: {error.message}</p>
    </div>
  );

  // Validate workspace access
  if (!currentWorkspace || !workspaceRole) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>No workspace selected or insufficient permissions</p>
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <main
        className={cn(CONTENT_STYLES, className)}
        role="main"
        aria-label="Diagram workspace"
      >
        {/* Toolbar with role-based controls */}
        <DiagramToolbar
          onLayoutChange={handleLayoutChange}
          className={cn(
            'border-b border-border',
            isMobile && 'overflow-x-auto'
          )}
        />

        {/* Main diagram canvas */}
        <div 
          className={CANVAS_CONTAINER_STYLES}
          data-testid="diagram-canvas-container"
        >
          <DiagramCanvas
            diagramId={currentWorkspace.id}
            isReadOnly={workspaceRole === 'VIEWER' || workspaceRole === 'GUEST'}
          />

          {/* Minimap with responsive visibility */}
          {showMinimap && (
            <div className={MINIMAP_STYLES}>
              <DiagramMinimap />
            </div>
          )}
        </div>

        {/* Additional content */}
        {children}
      </main>
    </ErrorBoundary>
  );
};

MainContent.displayName = 'MainContent';

export default MainContent;