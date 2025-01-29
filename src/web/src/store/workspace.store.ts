import { create } from 'zustand'; // ^4.4.0
import { devtools, persist } from 'zustand/middleware'; // ^4.4.0
import axiosInstance from '../lib/axios';
import type { 
  Workspace, 
  WorkspaceSettings, 
  WorkspaceRole, 
  WorkspaceState,
  WorkspaceResponse,
  SecurityContext,
  DataClassification 
} from '../types/workspace.types';

// Security and validation constants
const SECURITY_LEVELS = {
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  SENSITIVE: 'SENSITIVE',
  CRITICAL: 'CRITICAL'
} as const;

const ROLE_HIERARCHY = {
  [WorkspaceRole.OWNER]: 4,
  [WorkspaceRole.ADMIN]: 3,
  [WorkspaceRole.EDITOR]: 2,
  [WorkspaceRole.VIEWER]: 1,
  [WorkspaceRole.GUEST]: 0
};

// Initial state with security context
const initialState: WorkspaceState = {
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  error: null,
  userRole: WorkspaceRole.GUEST
};

// Security validation functions
const validateSecurityContext = (context: SecurityContext): boolean => {
  if (!context || !context.userId || !context.role) {
    console.error('Invalid security context');
    return false;
  }
  return true;
};

const hasRequiredRole = (requiredRole: WorkspaceRole, userRole: WorkspaceRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

const validateDataClassification = (workspace: Workspace, context: SecurityContext): boolean => {
  if (!workspace.securityLevel || !context.clearanceLevel) {
    return false;
  }
  const securityLevels = Object.keys(SECURITY_LEVELS);
  const workspaceLevel = securityLevels.indexOf(workspace.securityLevel);
  const userLevel = securityLevels.indexOf(context.clearanceLevel);
  return userLevel >= workspaceLevel;
};

// Create workspace store with security middleware
export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Secure workspace list update
        setWorkspaces: (workspaces: Workspace[], securityContext: SecurityContext) => {
          if (!validateSecurityContext(securityContext)) {
            set({ error: 'Invalid security context' });
            return;
          }

          // Filter workspaces based on user's role and clearance
          const filteredWorkspaces = workspaces.filter(workspace => 
            validateDataClassification(workspace, securityContext) &&
            hasRequiredRole(workspace.settings.defaultRole, securityContext.role)
          );

          set({ 
            workspaces: filteredWorkspaces,
            error: null
          });
        },

        // Secure current workspace update
        setCurrentWorkspace: (workspace: Workspace | null, securityContext: SecurityContext) => {
          if (workspace && !validateSecurityContext(securityContext)) {
            set({ error: 'Invalid security context' });
            return;
          }

          if (workspace && !validateDataClassification(workspace, securityContext)) {
            set({ error: 'Insufficient security clearance' });
            return;
          }

          if (workspace && !hasRequiredRole(workspace.settings.defaultRole, securityContext.role)) {
            set({ error: 'Insufficient role permissions' });
            return;
          }

          set({ 
            currentWorkspace: workspace,
            error: null
          });
        },

        // Secure workspace fetch with error handling
        fetchWorkspaces: async (securityContext: SecurityContext) => {
          if (!validateSecurityContext(securityContext)) {
            set({ error: 'Invalid security context' });
            return;
          }

          set({ loading: true, error: null });

          try {
            // Add security headers
            const headers = {
              'X-User-Role': securityContext.role,
              'X-Security-Clearance': securityContext.clearanceLevel
            };

            const response = await axiosInstance.get<WorkspaceResponse>('/api/workspaces', { headers });

            // Validate and filter response data
            const filteredWorkspaces = response.data.workspace.filter(workspace =>
              validateDataClassification(workspace, securityContext) &&
              hasRequiredRole(workspace.settings.defaultRole, securityContext.role)
            );

            set({ 
              workspaces: filteredWorkspaces,
              loading: false,
              error: null
            });

          } catch (error) {
            console.error('Workspace fetch error:', error);
            set({ 
              loading: false,
              error: 'Failed to fetch workspaces'
            });
          }
        },

        // Create workspace with security validation
        createWorkspace: async (
          name: string, 
          settings: WorkspaceSettings,
          securityContext: SecurityContext
        ) => {
          if (!validateSecurityContext(securityContext)) {
            set({ error: 'Invalid security context' });
            return;
          }

          if (!hasRequiredRole(WorkspaceRole.ADMIN, securityContext.role)) {
            set({ error: 'Insufficient permissions to create workspace' });
            return;
          }

          set({ loading: true, error: null });

          try {
            const response = await axiosInstance.post<WorkspaceResponse>('/api/workspaces', {
              name,
              settings,
              securityLevel: securityContext.clearanceLevel
            }, {
              headers: {
                'X-User-Role': securityContext.role,
                'X-Security-Clearance': securityContext.clearanceLevel
              }
            });

            const { workspaces } = get();
            set({ 
              workspaces: [...workspaces, response.data.workspace],
              loading: false,
              error: null
            });

          } catch (error) {
            console.error('Workspace creation error:', error);
            set({ 
              loading: false,
              error: 'Failed to create workspace'
            });
          }
        },

        // Delete workspace with security checks
        deleteWorkspace: async (
          workspaceId: string,
          securityContext: SecurityContext
        ) => {
          if (!validateSecurityContext(securityContext)) {
            set({ error: 'Invalid security context' });
            return;
          }

          const workspace = get().workspaces.find(w => w.id === workspaceId);
          if (!workspace) {
            set({ error: 'Workspace not found' });
            return;
          }

          if (!hasRequiredRole(WorkspaceRole.OWNER, securityContext.role)) {
            set({ error: 'Insufficient permissions to delete workspace' });
            return;
          }

          set({ loading: true, error: null });

          try {
            await axiosInstance.delete(`/api/workspaces/${workspaceId}`, {
              headers: {
                'X-User-Role': securityContext.role,
                'X-Security-Clearance': securityContext.clearanceLevel
              }
            });

            const { workspaces } = get();
            set({ 
              workspaces: workspaces.filter(w => w.id !== workspaceId),
              currentWorkspace: get().currentWorkspace?.id === workspaceId ? null : get().currentWorkspace,
              loading: false,
              error: null
            });

          } catch (error) {
            console.error('Workspace deletion error:', error);
            set({ 
              loading: false,
              error: 'Failed to delete workspace'
            });
          }
        }
      }),
      {
        name: 'workspace-store',
        partialize: (state) => ({
          workspaces: state.workspaces,
          currentWorkspace: state.currentWorkspace
        })
      }
    )
  )
);