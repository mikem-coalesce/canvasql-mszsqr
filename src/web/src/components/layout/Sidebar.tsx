"use client";

import React, { useCallback, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { buttonVariants } from '../ui/button';
import { LuPlus, LuFolder, LuChevronDown, LuChevronRight } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from 'react-error-boundary';
import useWorkspace from '../../hooks/useWorkspace';
import useProject from '../../hooks/useProject';
import type { WorkspaceRole } from '../../types/workspace.types';
import type { SecurityLevel } from '../../types/project.types';

// Security context interface
interface SecurityContext {
  role: WorkspaceRole;
  clearanceLevel: SecurityLevel;
}

// Component props with security and accessibility features
interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  userRole: WorkspaceRole;
  securityContext: SecurityContext;
}

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div className="p-4 text-destructive bg-destructive/10" role="alert">
    <h3 className="font-medium">Error Loading Sidebar</h3>
    <p className="text-sm">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
    >
      Try Again
    </button>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  isCollapsed = false,
  userRole,
  securityContext
}) => {
  // Initialize hooks with security context
  const {
    workspaces,
    currentWorkspace,
    fetchWorkspaces,
    validateWorkspaceAccess
  } = useWorkspace();

  const {
    projects,
    fetchProjects,
    createProject,
    selectProject
  } = useProject({
    workspaceId: currentWorkspace?.id || '',
    securityConfig: {
      level: securityContext.clearanceLevel,
      encryption: true,
      auditEnabled: true
    }
  });

  // Fetch data with security validation
  useEffect(() => {
    if (validateWorkspaceAccess(userRole)) {
      fetchWorkspaces();
    }
  }, [userRole, fetchWorkspaces, validateWorkspaceAccess]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchProjects();
    }
  }, [currentWorkspace?.id, fetchProjects]);

  // Virtualization for large lists
  const workspaceVirtualizer = useVirtualizer({
    count: workspaces.length,
    getScrollElement: () => document.querySelector('#workspace-list'),
    estimateSize: () => 40,
    overscan: 5
  });

  const projectVirtualizer = useVirtualizer({
    count: projects.length,
    getScrollElement: () => document.querySelector('#project-list'),
    estimateSize: () => 40,
    overscan: 5
  });

  // Secure workspace selection handler
  const handleWorkspaceSelect = useCallback(async (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace && validateWorkspaceAccess(userRole, workspace)) {
      await selectProject(null); // Clear current project for security
    }
  }, [workspaces, userRole, validateWorkspaceAccess, selectProject]);

  // Secure project creation handler
  const handleCreateProject = useCallback(async () => {
    if (currentWorkspace && validateWorkspaceAccess(userRole, currentWorkspace)) {
      await createProject({
        name: 'New Project',
        workspaceId: currentWorkspace.id,
        description: '',
        securityLevel: securityContext.clearanceLevel
      });
    }
  }, [currentWorkspace, userRole, createProject, securityContext]);

  // Memoized ARIA labels
  const ariaLabels = useMemo(() => ({
    sidebar: 'Navigation Sidebar',
    workspaceList: 'Workspace List',
    projectList: 'Project List',
    createProject: 'Create New Project'
  }), []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <aside
        className={cn(
          "flex flex-col h-full bg-background border-r focus-visible:outline-none",
          isCollapsed ? "w-16" : "w-64",
          "transition-width duration-200",
          className
        )}
        aria-label={ariaLabels.sidebar}
      >
        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b">
          <h2 className={cn(
            "font-semibold truncate",
            isCollapsed && "hidden"
          )}>
            Projects
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Workspaces */}
          <section 
            className="py-2"
            aria-label={ariaLabels.workspaceList}
          >
            <div
              id="workspace-list"
              className="relative"
              style={{ height: `${workspaceVirtualizer.getTotalSize()}px` }}
            >
              {workspaceVirtualizer.getVirtualItems().map(virtualRow => {
                const workspace = workspaces[virtualRow.index];
                return (
                  <button
                    key={workspace.id}
                    className={cn(
                      "flex items-center w-full px-4 py-2 text-sm",
                      "hover:bg-accent focus-visible:ring-2",
                      currentWorkspace?.id === workspace.id && "bg-accent/50"
                    )}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                    onClick={() => handleWorkspaceSelect(workspace.id)}
                    aria-selected={currentWorkspace?.id === workspace.id}
                  >
                    <LuFolder className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span className={cn("truncate", isCollapsed && "hidden")}>
                      {workspace.name}
                    </span>
                    {!isCollapsed && (
                      <LuChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Projects */}
          {currentWorkspace && (
            <section 
              className="py-2 border-t"
              aria-label={ariaLabels.projectList}
            >
              <div
                id="project-list"
                className="relative"
                style={{ height: `${projectVirtualizer.getTotalSize()}px` }}
              >
                {projectVirtualizer.getVirtualItems().map(virtualRow => {
                  const project = projects[virtualRow.index];
                  return (
                    <button
                      key={project.id}
                      className={cn(
                        "flex items-center w-full px-4 py-2 text-sm",
                        "hover:bg-accent focus-visible:ring-2"
                      )}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                      onClick={() => selectProject(project)}
                    >
                      <span className={cn("truncate", isCollapsed && "hidden")}>
                        {project.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Create Project Button */}
              {validateWorkspaceAccess(userRole, currentWorkspace) && (
                <button
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full justify-start px-4"
                  )}
                  onClick={handleCreateProject}
                  aria-label={ariaLabels.createProject}
                >
                  <LuPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  {!isCollapsed && "New Project"}
                </button>
              )}
            </section>
          )}
        </div>
      </aside>
    </ErrorBoundary>
  );
};

export default Sidebar;