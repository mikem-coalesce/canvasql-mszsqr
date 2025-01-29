import { create } from 'zustand'; // v4.4.0
import { devtools, persist } from 'zustand/middleware'; // v4.4.0
import { z } from 'zod'; // v3.22.0
import { SecurityService } from '@security/service'; // v1.0.0

import type {
  Project,
  ProjectState,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectAuditLog,
  SecurityLevel,
  ProjectSchema
} from '../types/project.types';
import type { DiagramState } from '../types/diagram.types';

// Global security service instance
const securityService = new SecurityService();

// State version for persistence migrations
const STATE_VERSION = '1';

// Runtime state validation schema
const ProjectStateSchema = z.object({
  projects: z.array(ProjectSchema),
  currentProject: ProjectSchema.nullable(),
  diagrams: z.array(z.any()), // DiagramState validation handled separately
  loading: z.boolean(),
  error: z.string().nullable(),
  securityLevel: z.nativeEnum(SecurityLevel),
  auditLog: z.array(z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'ACCESS']),
    timestamp: z.date(),
    details: z.record(z.string(), z.any())
  }))
});

// Initial secure state
const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  diagrams: [],
  loading: false,
  error: null,
  securityLevel: SecurityLevel.INTERNAL,
  auditLog: []
};

// Create store with security, persistence and devtools
export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Secure project fetching with validation
        fetchProjects: async () => {
          try {
            set({ loading: true, error: null });
            const projects = await securityService.fetchSecureData('/api/projects');
            ProjectStateSchema.shape.projects.parse(projects);
            set({ projects, loading: false });
            get().logAuditEvent('ACCESS', 'Fetched projects');
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        // Secure project creation with validation
        createProject: async (dto: CreateProjectDTO) => {
          try {
            set({ loading: true, error: null });
            const project = await securityService.postSecureData('/api/projects', dto);
            ProjectSchema.parse(project);
            set(state => ({
              projects: [...state.projects, project],
              currentProject: project,
              loading: false
            }));
            get().logAuditEvent('CREATE', 'Created project', { projectId: project.id });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        // Secure project update with validation
        updateProject: async (id: string, dto: UpdateProjectDTO) => {
          try {
            set({ loading: true, error: null });
            const project = await securityService.putSecureData(`/api/projects/${id}`, dto);
            ProjectSchema.parse(project);
            set(state => ({
              projects: state.projects.map(p => p.id === id ? project : p),
              currentProject: state.currentProject?.id === id ? project : state.currentProject,
              loading: false
            }));
            get().logAuditEvent('UPDATE', 'Updated project', { projectId: id });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        // Secure project deletion with audit
        deleteProject: async (id: string) => {
          try {
            set({ loading: true, error: null });
            await securityService.deleteSecureData(`/api/projects/${id}`);
            set(state => ({
              projects: state.projects.filter(p => p.id !== id),
              currentProject: state.currentProject?.id === id ? null : state.currentProject,
              loading: false
            }));
            get().logAuditEvent('DELETE', 'Deleted project', { projectId: id });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        // Set current project with security check
        setCurrentProject: (project: Project | null) => {
          if (project) {
            securityService.checkAccess(project.securityLevel);
            get().logAuditEvent('ACCESS', 'Accessed project', { projectId: project.id });
          }
          set({ currentProject: project });
        },

        // Update diagrams with validation
        updateDiagrams: (diagrams: DiagramState[]) => {
          set({ diagrams });
        },

        // State validation helper
        validateState: () => {
          const state = get();
          return ProjectStateSchema.safeParse(state);
        },

        // Secure audit logging
        logAuditEvent: (action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS', message: string, details: Record<string, any> = {}) => {
          const auditEntry: ProjectAuditLog = {
            id: crypto.randomUUID(),
            projectId: get().currentProject?.id || '',
            userId: securityService.getCurrentUserId(),
            action,
            timestamp: new Date(),
            details: {
              message,
              securityLevel: get().securityLevel,
              ...details
            }
          };
          set(state => ({
            auditLog: [...state.auditLog, auditEntry]
          }));
        },

        // Security level management
        setSecurityLevel: (level: SecurityLevel) => {
          securityService.checkAccess(level);
          set({ securityLevel: level });
          get().logAuditEvent('UPDATE', 'Changed security level', { level });
        }
      }),
      {
        name: 'project-store',
        version: STATE_VERSION,
        partialize: (state) => ({
          projects: state.projects,
          currentProject: state.currentProject,
          securityLevel: state.securityLevel
        }),
        onRehydrateStorage: () => (state) => {
          // Validate state after rehydration
          if (state) {
            const validation = ProjectStateSchema.safeParse(state);
            if (!validation.success) {
              console.error('State validation failed:', validation.error);
              return initialState;
            }
          }
        }
      }
    ),
    { name: 'ProjectStore' }
  )
);