/**
 * @fileoverview Custom React hook for secure project management with enhanced error handling,
 * state encryption, and audit logging capabilities.
 * @version 1.0.0
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import { useErrorBoundary } from 'react-error-boundary';
import { SecurityService } from '@security/service';

import ProjectService from '../services/project.service';
import useProjectStore from '../store/project.store';
import type { 
  Project, 
  CreateProjectDTO, 
  UpdateProjectDTO, 
  SecurityLevel 
} from '../types/project.types';

// Security service instance for state encryption and validation
const securityService = new SecurityService();

// Retry configuration for failed operations
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: 1000,
  timeoutMs: 10000
};

interface UseProjectProps {
  workspaceId: string;
  securityConfig?: {
    level: SecurityLevel;
    encryption: boolean;
    auditEnabled: boolean;
  };
}

/**
 * Enhanced hook for secure project management with state encryption
 */
export const useProject = ({ 
  workspaceId, 
  securityConfig = {
    level: SecurityLevel.INTERNAL,
    encryption: true,
    auditEnabled: true
  }
}: UseProjectProps) => {
  const toast = useToast();
  const { showBoundary } = useErrorBoundary();

  // Get project store state and actions
  const {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects: storeFetchProjects,
    createProject: storeCreateProject,
    updateProject: storeUpdateProject,
    deleteProject: storeDeleteProject,
    setCurrentProject,
    logAuditEvent
  } = useProjectStore();

  /**
   * Securely fetches projects with retry logic and validation
   */
  const fetchProjects = useCallback(async () => {
    let attempts = 0;
    
    while (attempts < RETRY_CONFIG.maxAttempts) {
      try {
        // Validate workspace access
        await securityService.validateAccess(workspaceId, securityConfig.level);
        
        // Fetch and decrypt projects
        const response = await ProjectService.fetchProjects(workspaceId);
        const decryptedProjects = securityConfig.encryption
          ? await securityService.decryptData(response)
          : response;

        // Update store with validated projects
        await storeFetchProjects(decryptedProjects);

        if (securityConfig.auditEnabled) {
          logAuditEvent('ACCESS', 'Fetched projects', { workspaceId });
        }
        
        return;
      } catch (error) {
        attempts++;
        if (attempts === RETRY_CONFIG.maxAttempts) {
          showBoundary(error);
          toast.error('Failed to fetch projects');
        } else {
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_CONFIG.backoffMs * attempts)
          );
        }
      }
    }
  }, [workspaceId, securityConfig, storeFetchProjects]);

  /**
   * Securely creates a new project with validation
   */
  const createProject = useCallback(async (data: CreateProjectDTO) => {
    try {
      await securityService.validateAccess(workspaceId, securityConfig.level);
      
      const encryptedData = securityConfig.encryption
        ? await securityService.encryptData(data)
        : data;

      const project = await ProjectService.createProject({
        ...encryptedData,
        workspaceId,
        securityLevel: securityConfig.level
      });

      await storeCreateProject(project);

      if (securityConfig.auditEnabled) {
        logAuditEvent('CREATE', 'Created project', { projectId: project.id });
      }

      toast.success('Project created successfully');
      return project;
    } catch (error) {
      showBoundary(error);
      toast.error('Failed to create project');
      throw error;
    }
  }, [workspaceId, securityConfig]);

  /**
   * Securely updates an existing project with validation
   */
  const updateProject = useCallback(async (
    projectId: string, 
    data: UpdateProjectDTO
  ) => {
    try {
      await securityService.validateAccess(workspaceId, securityConfig.level);
      
      const encryptedData = securityConfig.encryption
        ? await securityService.encryptData(data)
        : data;

      const project = await ProjectService.updateProject(projectId, encryptedData);
      await storeUpdateProject(projectId, project);

      if (securityConfig.auditEnabled) {
        logAuditEvent('UPDATE', 'Updated project', { projectId });
      }

      toast.success('Project updated successfully');
      return project;
    } catch (error) {
      showBoundary(error);
      toast.error('Failed to update project');
      throw error;
    }
  }, [workspaceId, securityConfig]);

  /**
   * Securely deletes a project with confirmation
   */
  const deleteProject = useCallback(async (projectId: string) => {
    try {
      await securityService.validateAccess(workspaceId, securityConfig.level);
      await ProjectService.deleteProject(projectId);
      await storeDeleteProject(projectId);

      if (securityConfig.auditEnabled) {
        logAuditEvent('DELETE', 'Deleted project', { projectId });
      }

      toast.success('Project deleted successfully');
    } catch (error) {
      showBoundary(error);
      toast.error('Failed to delete project');
      throw error;
    }
  }, [workspaceId, securityConfig]);

  /**
   * Securely selects a project with access validation
   */
  const selectProject = useCallback(async (project: Project | null) => {
    try {
      if (project) {
        await securityService.validateAccess(workspaceId, project.securityLevel);
      }
      setCurrentProject(project);

      if (project && securityConfig.auditEnabled) {
        logAuditEvent('ACCESS', 'Selected project', { projectId: project.id });
      }
    } catch (error) {
      showBoundary(error);
      toast.error('Access denied');
      throw error;
    }
  }, [workspaceId, securityConfig]);

  // Load projects on mount or workspace change
  useEffect(() => {
    fetchProjects();
  }, [workspaceId]);

  // Memoized encrypted projects
  const encryptedProjects = useMemo(() => 
    securityConfig.encryption 
      ? projects.map(p => securityService.encryptData(p))
      : projects,
    [projects, securityConfig.encryption]
  );

  return {
    // Secure state
    projects: encryptedProjects,
    currentProject,
    loading,
    error,

    // Secure operations
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    selectProject
  };
};

export default useProject;