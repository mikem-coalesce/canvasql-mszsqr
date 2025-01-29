/**
 * @fileoverview React hook for secure workspace management with role-based access control,
 * real-time synchronization, and comprehensive error handling.
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { useErrorBoundary } from 'react-error-boundary';
import type {
  Workspace,
  CreateWorkspaceDTO,
  UpdateWorkspaceDTO,
  WorkspaceResponse,
  SecurityContext,
  WorkspaceRole,
  DataClassification
} from '../types/workspace.types';
import { useWorkspaceStore } from '../store/workspace.store';
import WorkspaceService from '../services/workspace.service';

/**
 * Custom hook for secure workspace management with RBAC
 */
export const useWorkspace = () => {
  // Initialize services and utilities
  const toast = useToast();
  const { showBoundary } = useErrorBoundary();
  const workspaceService = useRef<WorkspaceService | null>(null);

  // Get workspace state from store
  const {
    workspaces,
    currentWorkspace,
    loading,
    error,
    securityContext
  } = useWorkspaceStore();

  /**
   * Initialize workspace service with security context
   */
  useEffect(() => {
    if (securityContext?.role) {
      workspaceService.current = new WorkspaceService(
        WorkspaceService,
        securityContext.role
      );
    }
  }, [securityContext]);

  /**
   * Securely fetches authorized workspaces
   */
  const fetchWorkspaces = useCallback(async () => {
    try {
      if (!workspaceService.current || !securityContext) {
        throw new Error('Security context not initialized');
      }

      const response = await workspaceService.current.getAllWorkspaces();
      useWorkspaceStore.setState({ 
        workspaces: response,
        error: null 
      });
    } catch (error) {
      console.error('Fetch workspaces failed:', error);
      showBoundary(error);
      toast({
        title: 'Error',
        description: 'Failed to fetch workspaces',
        variant: 'destructive'
      });
    }
  }, [securityContext, showBoundary, toast]);

  /**
   * Securely fetches a specific workspace by ID
   */
  const fetchWorkspaceById = useCallback(async (id: string) => {
    try {
      if (!workspaceService.current || !securityContext) {
        throw new Error('Security context not initialized');
      }

      const response = await workspaceService.current.getWorkspaceById(id);
      useWorkspaceStore.setState({ 
        currentWorkspace: response.workspace,
        error: null 
      });
    } catch (error) {
      console.error('Fetch workspace failed:', error);
      showBoundary(error);
      toast({
        title: 'Error',
        description: 'Failed to fetch workspace',
        variant: 'destructive'
      });
    }
  }, [securityContext, showBoundary, toast]);

  /**
   * Creates a new workspace with security validation
   */
  const createWorkspace = useCallback(async (data: CreateWorkspaceDTO) => {
    try {
      if (!workspaceService.current || !securityContext) {
        throw new Error('Security context not initialized');
      }

      if (!validateWorkspaceAccess(WorkspaceRole.ADMIN)) {
        throw new Error('Insufficient permissions to create workspace');
      }

      const response = await workspaceService.current.createWorkspace(data);
      useWorkspaceStore.setState(state => ({
        workspaces: [...state.workspaces, response.workspace],
        error: null
      }));

      toast({
        title: 'Success',
        description: 'Workspace created successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('Create workspace failed:', error);
      showBoundary(error);
      toast({
        title: 'Error',
        description: 'Failed to create workspace',
        variant: 'destructive'
      });
    }
  }, [securityContext, showBoundary, toast]);

  /**
   * Updates a workspace with role validation
   */
  const updateWorkspace = useCallback(async (
    id: string,
    data: UpdateWorkspaceDTO
  ) => {
    try {
      if (!workspaceService.current || !securityContext) {
        throw new Error('Security context not initialized');
      }

      const workspace = workspaces.find(w => w.id === id);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (!validateWorkspaceAccess(WorkspaceRole.EDITOR, workspace)) {
        throw new Error('Insufficient permissions to update workspace');
      }

      const response = await workspaceService.current.updateWorkspace(id, data);
      useWorkspaceStore.setState(state => ({
        workspaces: state.workspaces.map(w => 
          w.id === id ? response.workspace : w
        ),
        currentWorkspace: state.currentWorkspace?.id === id ? 
          response.workspace : state.currentWorkspace,
        error: null
      }));

      toast({
        title: 'Success',
        description: 'Workspace updated successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('Update workspace failed:', error);
      showBoundary(error);
      toast({
        title: 'Error',
        description: 'Failed to update workspace',
        variant: 'destructive'
      });
    }
  }, [workspaces, securityContext, showBoundary, toast]);

  /**
   * Deletes a workspace with security verification
   */
  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      if (!workspaceService.current || !securityContext) {
        throw new Error('Security context not initialized');
      }

      const workspace = workspaces.find(w => w.id === id);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (!validateWorkspaceAccess(WorkspaceRole.OWNER, workspace)) {
        throw new Error('Insufficient permissions to delete workspace');
      }

      await workspaceService.current.deleteWorkspace(id);
      useWorkspaceStore.setState(state => ({
        workspaces: state.workspaces.filter(w => w.id !== id),
        currentWorkspace: state.currentWorkspace?.id === id ? 
          null : state.currentWorkspace,
        error: null
      }));

      toast({
        title: 'Success',
        description: 'Workspace deleted successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('Delete workspace failed:', error);
      showBoundary(error);
      toast({
        title: 'Error',
        description: 'Failed to delete workspace',
        variant: 'destructive'
      });
    }
  }, [workspaces, securityContext, showBoundary, toast]);

  /**
   * Validates user access rights for workspace operations
   */
  const validateWorkspaceAccess = useCallback((
    requiredRole: WorkspaceRole,
    workspace?: Workspace
  ): boolean => {
    if (!securityContext?.role) return false;

    const roleHierarchy: Record<WorkspaceRole, number> = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.EDITOR]: 2,
      [WorkspaceRole.VIEWER]: 1,
      [WorkspaceRole.GUEST]: 0
    };

    // Check role hierarchy
    const hasRequiredRole = roleHierarchy[securityContext.role] >= 
      roleHierarchy[requiredRole];

    // Check workspace-specific permissions if workspace provided
    if (workspace) {
      const hasDataAccess = securityContext.clearanceLevel >= 
        workspace.securityLevel;
      return hasRequiredRole && hasDataAccess;
    }

    return hasRequiredRole;
  }, [securityContext]);

  return {
    // State
    workspaces,
    currentWorkspace,
    loading,
    error,
    securityContext,

    // Actions
    fetchWorkspaces,
    fetchWorkspaceById,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    validateWorkspaceAccess
  };
};

export default useWorkspace;