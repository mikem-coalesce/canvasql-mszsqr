"use client";

import React, { useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useErrorBoundary } from 'react-error-boundary';
import { useAnalytics } from '@analytics/react';

import useProject from '../hooks/useProject';
import DiagramCanvas from '../components/diagram/DiagramCanvas';
import ProjectList from '../components/project/ProjectList';
import { Spinner } from '../components/ui/spinner';

// Constants for layout and performance
const PAGE_PADDING = 24;
const SIDEBAR_WIDTH = 320;
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

/**
 * Project page component with secure project management and real-time collaboration
 */
const ProjectPage: React.FC = () => {
  // Routing and navigation
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showBoundary } = useErrorBoundary();
  const analytics = useAnalytics();

  // Initialize project state with security configuration
  const {
    projects,
    selectedProject,
    isLoading,
    validateAccess,
    auditLog
  } = useProject({
    workspaceId: workspaceId!,
    securityConfig: {
      level: 'INTERNAL',
      encryption: true,
      auditEnabled: true
    }
  });

  // Validate access and load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        const hasAccess = await validateAccess(projectId!);
        if (!hasAccess) {
          throw new Error('Insufficient permissions');
        }

        // Track page view
        analytics.track('project_view', {
          projectId,
          workspaceId
        });

        // Log audit event
        auditLog('ACCESS', 'Viewed project', { projectId });

      } catch (error) {
        showBoundary(error);
        navigate('/dashboard');
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId, workspaceId, validateAccess]);

  // Handle project selection with security validation
  const handleProjectSelect = useCallback(async (selectedId: string) => {
    try {
      const hasAccess = await validateAccess(selectedId);
      if (!hasAccess) {
        throw new Error('Insufficient permissions');
      }

      navigate(`/workspaces/${workspaceId}/projects/${selectedId}`);
      
      // Track selection
      analytics.track('project_select', {
        projectId: selectedId,
        workspaceId
      });

      // Log audit event
      auditLog('ACCESS', 'Selected project', { projectId: selectedId });

    } catch (error) {
      showBoundary(error);
    }
  }, [workspaceId, validateAccess, navigate]);

  // Memoized layout classes for responsive design
  const layoutClasses = useMemo(() => ({
    container: `
      min-h-screen
      bg-background
      flex
      overflow-hidden
    `,
    sidebar: `
      w-[${SIDEBAR_WIDTH}px]
      border-r
      border-border
      p-${PAGE_PADDING}
      hidden
      md:block
      overflow-y-auto
    `,
    content: `
      flex-1
      overflow-hidden
      p-${PAGE_PADDING}
    `
  }), []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={layoutClasses.container}>
      {/* Project Sidebar */}
      <aside className={layoutClasses.sidebar}>
        <ProjectList
          workspaceId={workspaceId!}
          onError={showBoundary}
          className="mb-8"
        />
      </aside>

      {/* Main Content */}
      <main className={layoutClasses.content}>
        {selectedProject ? (
          <DiagramCanvas
            diagramId={selectedProject.id}
            isReadOnly={!selectedProject.metadata.canEdit}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              {t('project.selectPrompt')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

// Add error boundary and analytics tracking
const ProjectPageWithErrorBoundary = () => (
  <ErrorBoundary
    FallbackComponent={({ error }) => (
      <div className="p-6 text-destructive">
        <h2 className="text-lg font-semibold mb-2">
          {t('error.projectLoadFailed')}
        </h2>
        <p className="text-sm">{error.message}</p>
      </div>
    )}
  >
    <ProjectPage />
  </ErrorBoundary>
);

export default ProjectPageWithErrorBoundary;