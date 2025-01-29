/**
 * @fileoverview Main workspace page component implementing secure workspace management,
 * real-time collaboration, and accessibility features.
 * @version 1.0.0
 */

import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { WorkspaceList } from '../components/workspace/WorkspaceList';
import { CreateWorkspaceDialog } from '../components/workspace/CreateWorkspaceDialog';
import { useWorkspace } from '../hooks/useWorkspace';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { cn } from '../lib/utils';
import type { WorkspaceRole } from '../types/workspace.types';

/**
 * Main workspace page component with security and real-time features
 */
export const Workspace: React.FC = () => {
  // Initialize workspace state and security context
  const {
    workspaces,
    loading,
    error,
    fetchWorkspaces,
    validateWorkspaceAccess,
    securityContext
  } = useWorkspace();

  // Dialog state management
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);

  // Fetch workspaces on mount with security context
  useEffect(() => {
    if (securityContext?.role) {
      fetchWorkspaces();
    }
  }, [fetchWorkspaces, securityContext]);

  // Handle successful workspace creation
  const handleWorkspaceCreated = useCallback(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Check if user can create workspaces
  const canCreateWorkspace = validateWorkspaceAccess(WorkspaceRole.ADMIN);

  return (
    <main 
      className="p-6 max-w-7xl mx-auto"
      aria-busy={loading}
    >
      {/* Header with security-aware actions */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          {/* Real-time collaboration indicator */}
          <p className="text-sm text-muted-foreground">
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Secure workspace creation */}
        {canCreateWorkspace && (
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className={cn(
              "inline-flex items-center gap-2",
              loading && "pointer-events-none opacity-50"
            )}
            aria-disabled={loading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-plus"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Workspace
          </Button>
        )}
      </header>

      {/* Loading state with accessibility */}
      {loading && !workspaces.length ? (
        <div 
          className="flex justify-center items-center min-h-[400px]"
          role="status"
          aria-label="Loading workspaces"
        >
          <Spinner size="lg" />
        </div>
      ) : error ? (
        // Error state with accessibility
        <div 
          className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive"
          role="alert"
        >
          <p className="font-medium">Error loading workspaces</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : !workspaces.length ? (
        // Empty state with accessibility
        <div 
          className="text-center p-8 border rounded-lg bg-muted/50"
          role="status"
        >
          <h2 className="text-lg font-medium mb-2">No workspaces found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {canCreateWorkspace
              ? "Create your first workspace to get started"
              : "You don't have access to any workspaces"}
          </p>
          {canCreateWorkspace && (
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              variant="outline"
            >
              Create Workspace
            </Button>
          )}
        </div>
      ) : (
        // Secure workspace list with real-time updates
        <WorkspaceList
          className="rounded-lg border bg-card"
          securityContext={securityContext}
          gridColumns={3}
          pageSize={12}
        />
      )}

      {/* Secure workspace creation dialog */}
      <CreateWorkspaceDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onWorkspaceCreated={handleWorkspaceCreated}
        onError={(error) => {
          console.error('Workspace creation failed:', error);
        }}
      />
    </main>
  );
};

export default Workspace;