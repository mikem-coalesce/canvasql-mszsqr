/**
 * @fileoverview Main dashboard page component implementing secure workspace management
 * with real-time updates, comprehensive error handling, and role-based access control.
 * @version 1.0.0
 */

import * as React from 'react';
import { useCallback, useEffect, memo } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { analytics } from '@segment/analytics-next';
import { WorkspaceList } from '../components/workspace/WorkspaceList';
import { CreateWorkspaceDialog } from '../components/workspace/CreateWorkspaceDialog';
import { Button, buttonVariants } from '../components/ui/button';
import { useWorkspace } from '../../hooks/useWorkspace';

/**
 * Main dashboard component with security and error handling
 */
const Dashboard = memo(() => {
  // Initialize state and hooks
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const { showBoundary } = useErrorBoundary();
  const {
    workspaces,
    loading,
    error,
    fetchWorkspaces,
    securityContext
  } = useWorkspace();

  // Security context validation
  if (!securityContext) {
    throw new Error('Security context not initialized');
  }

  // Fetch workspaces with security validation
  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchWorkspaces();
        // Track successful workspace load
        analytics.track('Workspaces Loaded', {
          count: workspaces.length,
          userRole: securityContext.role
        });
      } catch (error) {
        console.error('Dashboard load failed:', error);
        showBoundary(error);
      }
    };

    fetchData();

    // Cleanup on unmount
    return () => {
      analytics.track('Dashboard Exited', {
        timeSpent: Date.now() - performance.now()
      });
    };
  }, [fetchWorkspaces, showBoundary]);

  /**
   * Handles workspace creation with security validation
   */
  const handleWorkspaceCreated = useCallback(async () => {
    try {
      await fetchWorkspaces();
      setIsCreateDialogOpen(false);
      
      analytics.track('Workspace Created', {
        userRole: securityContext.role,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Workspace creation failed:', error);
      showBoundary(error);
    }
  }, [fetchWorkspaces, securityContext.role, showBoundary]);

  // Loading state with security context
  if (loading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        data-security-context={securityContext.role}
      >
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Error state with security context
  if (error) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4"
        data-security-context={securityContext.role}
        role="alert"
      >
        <h2 className="text-lg font-semibold text-red-600 mb-2">
          Error Loading Dashboard
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button 
          onClick={() => fetchWorkspaces()}
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <main 
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      data-security-context={securityContext.role}
    >
      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            My Workspaces
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your secure workspaces and projects
          </p>
        </div>

        {/* Create Workspace Button - Only shown for authorized roles */}
        {securityContext.role !== 'GUEST' && (
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className={buttonVariants({ variant: 'default' })}
            data-testid="create-workspace-button"
          >
            Create Workspace
          </Button>
        )}
      </div>

      {/* Workspace List with Security Context */}
      <WorkspaceList
        securityContext={securityContext}
        className="mt-6"
        gridColumns={3}
        pageSize={12}
      />

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onWorkspaceCreated={handleWorkspaceCreated}
        onError={(error) => showBoundary(error)}
      />
    </main>
  );
});

// Set display name for debugging
Dashboard.displayName = 'Dashboard';

// Export component
export default Dashboard;