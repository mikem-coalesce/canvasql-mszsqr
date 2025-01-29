"use client";

import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useIntersectionObserver } from '@hooks/useIntersectionObserver';
import { VirtualScroll } from 'react-virtual-scroll';

import { ProjectCard } from './ProjectCard';
import { CreateProjectDialog } from './CreateProjectDialog';
import { useProjectStore } from '../../store/project.store';
import { Spinner } from '../ui/spinner';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';

// Grid layout configuration based on design specifications
const GRID_BREAKPOINTS = {
  'sm': 'grid-cols-1',
  'md': 'grid-cols-2',
  'lg': 'grid-cols-3',
  'xl': 'grid-cols-4'
} as const;

// Virtual scrolling configuration for performance
const VIRTUAL_SCROLL_CONFIG = {
  itemHeight: 280, // Height of project card
  overscan: 5,     // Number of items to render outside viewport
  threshold: 0.5   // Intersection observer threshold
};

interface ProjectListProps {
  workspaceId: string;
  className?: string;
  onError?: (error: Error) => void;
}

/**
 * A secure and accessible grid of project cards with comprehensive project management.
 * Implements WCAG 2.1 Level AA compliance and shadcn/ui design patterns.
 */
export const ProjectList: React.FC<ProjectListProps> = React.memo(({
  workspaceId,
  className,
  onError
}) => {
  // State management
  const { projects, loading, error, fetchProjects, deleteProject } = useProjectStore();
  const [isCreateDialogOpen, setCreateDialogOpen] = React.useState(false);
  const toast = useToast();

  // Intersection observer for infinite scrolling
  const { ref: loadMoreRef, entry } = useIntersectionObserver({
    threshold: VIRTUAL_SCROLL_CONFIG.threshold
  });

  // Fetch projects on mount and workspace change
  React.useEffect(() => {
    const loadProjects = async () => {
      try {
        await fetchProjects();
      } catch (err) {
        onError?.(err as Error);
        toast.showError('Failed to load projects');
      }
    };

    loadProjects();
  }, [workspaceId, fetchProjects, onError]);

  // Handle project deletion with confirmation
  const handleDeleteProject = React.useCallback(async (projectId: string) => {
    try {
      await deleteProject(projectId);
      toast.showSuccess('Project deleted successfully');
    } catch (err) {
      onError?.(err as Error);
      toast.showError('Failed to delete project');
    }
  }, [deleteProject, onError]);

  // Handle create project success
  const handleCreateSuccess = React.useCallback((projectId: string) => {
    toast.showSuccess('Project created successfully');
    setCreateDialogOpen(false);
  }, []);

  // Error fallback component
  const ErrorFallback = React.useCallback(({ error, resetErrorBoundary }) => (
    <div 
      role="alert" 
      className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-900"
    >
      <h3 className="text-lg font-semibold mb-2">Error Loading Projects</h3>
      <p className="text-sm mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-100 text-red-900 rounded-md hover:bg-red-200 transition-colors"
      >
        Try Again
      </button>
    </div>
  ), []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={onError}>
      <div className="space-y-6">
        {/* Header with create button */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            aria-label="Create new project"
          >
            Create Project
          </button>
        </div>

        {/* Loading state */}
        {loading && !projects.length && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !projects.length && (
          <div 
            className="text-center p-8 border-2 border-dashed rounded-lg"
            role="status"
            aria-label="No projects found"
          >
            <p className="text-muted-foreground">
              No projects yet. Create your first project to get started.
            </p>
          </div>
        )}

        {/* Project grid with virtual scrolling */}
        {projects.length > 0 && (
          <VirtualScroll
            data={projects}
            itemHeight={VIRTUAL_SCROLL_CONFIG.itemHeight}
            overscan={VIRTUAL_SCROLL_CONFIG.overscan}
          >
            {(virtualItems) => (
              <div className={cn(
                "grid gap-6",
                GRID_BREAKPOINTS.sm,
                `sm:${GRID_BREAKPOINTS.md}`,
                `lg:${GRID_BREAKPOINTS.lg}`,
                `xl:${GRID_BREAKPOINTS.xl}`,
                className
              )}>
                {virtualItems.map((virtualItem) => (
                  <ProjectCard
                    key={virtualItem.data.id}
                    project={virtualItem.data}
                    onDelete={handleDeleteProject}
                  />
                ))}
                {/* Infinite scroll trigger */}
                <div ref={loadMoreRef} />
              </div>
            )}
          </VirtualScroll>
        )}

        {/* Create project dialog */}
        <CreateProjectDialog
          workspaceId={workspaceId}
          open={isCreateDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleCreateSuccess}
          onError={onError}
        />
      </div>
    </ErrorBoundary>
  );
});

ProjectList.displayName = 'ProjectList';

export default ProjectList;