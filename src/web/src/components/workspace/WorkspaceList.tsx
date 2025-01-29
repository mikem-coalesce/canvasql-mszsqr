/**
 * @fileoverview A secure and performant workspace list component with role-based access control,
 * virtualization, and accessibility features.
 * @version 1.0.0
 */

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { useIntersectionObserver } from '@react-hooks/intersection-observer'; // ^1.0.0
import { cn } from '../../lib/utils';
import { WorkspaceCard } from './WorkspaceCard';
import { useWorkspaceStore } from '../../store/workspace.store';
import type { Workspace, WorkspaceRole } from '../../types/workspace.types';

// Security context interface
interface SecurityContext {
  userId: string;
  role: WorkspaceRole;
  clearanceLevel: string;
}

// Component props with security requirements
interface WorkspaceListProps {
  className?: string;
  securityContext: SecurityContext;
  gridColumns?: number;
  pageSize?: number;
}

/**
 * Custom hook for secure workspace access control
 */
const useWorkspaceAccess = (securityContext: SecurityContext) => {
  const { workspaces, loading, error, fetchWorkspaces } = useWorkspaceStore();

  React.useEffect(() => {
    if (!securityContext.userId || !securityContext.role) {
      console.error('Invalid security context');
      return;
    }

    fetchWorkspaces(securityContext);
  }, [securityContext, fetchWorkspaces]);

  return { workspaces, loading, error };
};

/**
 * A secure and performant workspace list component with virtualization
 */
export const WorkspaceList: React.FC<WorkspaceListProps> = ({
  className,
  securityContext,
  gridColumns = 3,
  pageSize = 12
}) => {
  // Container ref for virtualization
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Secure workspace access
  const { workspaces, loading, error } = useWorkspaceAccess(securityContext);

  // Intersection observer for infinite loading
  const [observerRef, entry] = useIntersectionObserver({
    threshold: 0.1,
    root: null
  });

  // Virtual grid setup
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(workspaces.length / gridColumns),
    getScrollElement: () => containerRef.current,
    estimateSize: () => 300, // Card height estimate
    overscan: 3
  });

  // Load more workspaces when reaching bottom
  React.useEffect(() => {
    if (entry?.isIntersecting && !loading && workspaces.length >= pageSize) {
      fetchWorkspaces(securityContext);
    }
  }, [entry?.isIntersecting, loading, workspaces.length]);

  // Error handling with security context
  if (error) {
    return (
      <div 
        role="alert" 
        className="p-4 text-red-700 bg-red-100 rounded"
        data-security-context={securityContext.role}
      >
        {error}
      </div>
    );
  }

  // Secure loading state
  if (loading && !workspaces.length) {
    return (
      <div 
        role="status"
        className="p-4 animate-pulse"
        data-security-context={securityContext.role}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: pageSize }).map((_, index) => (
            <div 
              key={index}
              className="h-64 bg-gray-200 rounded"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state with security context
  if (!workspaces.length) {
    return (
      <div 
        className="p-4 text-center text-gray-500"
        data-security-context={securityContext.role}
      >
        <p>No workspaces available for your access level.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-[800px] overflow-auto",
        className
      )}
      role="grid"
      aria-label="Workspace list"
      data-security-context={securityContext.role}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowStart = virtualRow.index * gridColumns;
          const rowWorkspaces = workspaces.slice(rowStart, rowStart + gridColumns);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
            >
              {rowWorkspaces.map((workspace: Workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  userRole={securityContext.role}
                  className="h-full"
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={observerRef} className="h-4" />

      {/* Loading indicator for infinite scroll */}
      {loading && workspaces.length > 0 && (
        <div 
          role="status"
          className="p-4 text-center"
          aria-label="Loading more workspaces"
        >
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        </div>
      )}
    </div>
  );
};

// Add display name for debugging
WorkspaceList.displayName = 'WorkspaceList';

// Default export
export default WorkspaceList;