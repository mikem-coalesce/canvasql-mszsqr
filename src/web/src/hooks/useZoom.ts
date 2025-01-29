import { useCallback, useState, useRef } from 'react';
import { useReactFlow, Viewport } from 'reactflow';
import { FIT_VIEW_OPTIONS } from '../lib/reactflow';

// Constants for zoom control
const ZOOM_INCREMENT = 0.2;
const ZOOM_TRANSITION_DURATION = 300;
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/**
 * Custom hook for managing zoom and viewport controls in the ERD diagram canvas
 * Provides smooth transitions and optimized viewport management for large diagrams
 * @version 1.0.0
 */
export const useZoom = () => {
  // Get React Flow instance for viewport manipulation
  const { zoomTo, getViewport, setViewport, fitView } = useReactFlow();
  
  // Track current viewport state
  const [viewport, setViewportState] = useState<Viewport>(DEFAULT_VIEWPORT);
  
  // Reference for animation frame to handle cleanup
  const animationFrameRef = useRef<number>();

  /**
   * Cancels any ongoing zoom animation
   */
  const cancelZoomAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  /**
   * Smoothly animates viewport changes
   */
  const animateViewport = useCallback((
    startViewport: Viewport,
    endViewport: Viewport,
    duration: number,
    onComplete?: () => void
  ) => {
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing function
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      const currentViewport = {
        x: startViewport.x + (endViewport.x - startViewport.x) * eased,
        y: startViewport.y + (endViewport.y - startViewport.y) * eased,
        zoom: startViewport.zoom + (endViewport.zoom - startViewport.zoom) * eased
      };

      setViewport(currentViewport);
      setViewportState(currentViewport);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    cancelZoomAnimation();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [setViewport]);

  /**
   * Increases zoom level with smooth transition
   */
  const zoomIn = useCallback(() => {
    const currentViewport = getViewport();
    const newZoom = Math.min(
      currentViewport.zoom + ZOOM_INCREMENT,
      FIT_VIEW_OPTIONS.maxZoom
    );

    animateViewport(
      currentViewport,
      { ...currentViewport, zoom: newZoom },
      ZOOM_TRANSITION_DURATION
    );
  }, [getViewport, animateViewport]);

  /**
   * Decreases zoom level with smooth transition
   */
  const zoomOut = useCallback(() => {
    const currentViewport = getViewport();
    const newZoom = Math.max(
      currentViewport.zoom - ZOOM_INCREMENT,
      FIT_VIEW_OPTIONS.minZoom
    );

    animateViewport(
      currentViewport,
      { ...currentViewport, zoom: newZoom },
      ZOOM_TRANSITION_DURATION
    );
  }, [getViewport, animateViewport]);

  /**
   * Resets viewport to default position and zoom level
   */
  const resetZoom = useCallback(() => {
    const currentViewport = getViewport();
    
    animateViewport(
      currentViewport,
      DEFAULT_VIEWPORT,
      ZOOM_TRANSITION_DURATION
    );
  }, [getViewport, animateViewport]);

  /**
   * Fits all diagram elements within the viewport
   * Uses React Flow's built-in fitView with custom options
   */
  const fitViewport = useCallback(() => {
    fitView({
      ...FIT_VIEW_OPTIONS,
      duration: ZOOM_TRANSITION_DURATION,
      padding: FIT_VIEW_OPTIONS.padding
    });
    
    // Update viewport state after fit animation
    setTimeout(() => {
      setViewportState(getViewport());
    }, ZOOM_TRANSITION_DURATION);
  }, [fitView, getViewport]);

  return {
    viewport,
    zoomIn,
    zoomOut,
    resetZoom,
    fitView: fitViewport,
    minZoom: FIT_VIEW_OPTIONS.minZoom,
    maxZoom: FIT_VIEW_OPTIONS.maxZoom
  };
};