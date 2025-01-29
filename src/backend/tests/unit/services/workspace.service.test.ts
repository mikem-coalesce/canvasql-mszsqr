import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { WorkspaceService } from '../../src/services/workspace.service';
import { IWorkspace, WorkspaceRole } from '../../src/core/interfaces/workspace.interface';
import APIError from '../../src/core/errors/APIError';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    $transaction: jest.fn(callback => callback()),
    workspace: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    workspaceRole: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn()
    }
  }))
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
};

describe('WorkspaceService', () => {
  let workspaceService: WorkspaceService;
  let prisma: jest.Mocked<PrismaClient>;

  const mockWorkspace: IWorkspace = {
    id: 'workspace-1',
    name: 'Test Workspace',
    ownerId: 'user-1',
    settings: {
      defaultRole: WorkspaceRole.VIEWER,
      allowPublicSharing: false,
      enableVersionHistory: true,
      maxProjects: 10,
      securityLevel: 'standard'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockProject = {
    id: 'project-1',
    workspaceId: 'workspace-1',
    name: 'Default Project',
    lastModified: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    workspaceService = new WorkspaceService(prisma, mockLogger);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    const createDTO = {
      name: 'New Workspace',
      settings: {
        defaultRole: WorkspaceRole.VIEWER,
        allowPublicSharing: false,
        enableVersionHistory: true,
        maxProjects: 10,
        securityLevel: 'standard'
      }
    };

    it('should create a workspace with default project successfully', async () => {
      prisma.workspace.create.mockResolvedValue(mockWorkspace);
      prisma.project.create.mockResolvedValue(mockProject);

      const result = await workspaceService.create('user-1', createDTO);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createDTO.name,
          ownerId: 'user-1',
          settings: expect.any(Object),
          roles: expect.any(Object)
        })
      });
      expect(result.workspace).toEqual(mockWorkspace);
      expect(result.projects).toHaveLength(1);
      expect(result.userRole).toBe(WorkspaceRole.OWNER);
    });

    it('should handle transaction rollback on error', async () => {
      const error = new Error('Database error');
      prisma.workspace.create.mockRejectedValue(error);

      await expect(workspaceService.create('user-1', createDTO))
        .rejects.toThrow(APIError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate workspace name uniqueness', async () => {
      prisma.workspace.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint violation'
      });

      await expect(workspaceService.create('user-1', createDTO))
        .rejects.toThrow(APIError);
    });
  });

  describe('update', () => {
    const updateDTO = {
      name: 'Updated Workspace',
      settings: {
        defaultRole: WorkspaceRole.VIEWER,
        allowPublicSharing: true,
        enableVersionHistory: true,
        maxProjects: 15,
        securityLevel: 'high'
      }
    };

    it('should update workspace successfully with admin access', async () => {
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.ADMIN });
      prisma.workspace.update.mockResolvedValue({ ...mockWorkspace, ...updateDTO });
      prisma.project.findMany.mockResolvedValue([mockProject]);

      const result = await workspaceService.update('workspace-1', 'user-1', updateDTO);

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        data: expect.objectContaining(updateDTO)
      });
      expect(result.workspace.name).toBe(updateDTO.name);
    });

    it('should reject updates without sufficient permissions', async () => {
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });

      await expect(workspaceService.update('workspace-1', 'user-1', updateDTO))
        .rejects.toThrow(APIError);
    });
  });

  describe('delete', () => {
    it('should delete workspace and associated data with owner access', async () => {
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.OWNER });

      await workspaceService.delete('workspace-1', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.project.deleteMany).toHaveBeenCalled();
      expect(prisma.workspaceRole.deleteMany).toHaveBeenCalled();
      expect(prisma.workspace.delete).toHaveBeenCalled();
    });

    it('should reject deletion without owner permissions', async () => {
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.ADMIN });

      await expect(workspaceService.delete('workspace-1', 'user-1'))
        .rejects.toThrow(APIError);
    });
  });

  describe('findById', () => {
    it('should return workspace with projects for authorized user', async () => {
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });
      prisma.project.findMany.mockResolvedValue([mockProject]);

      const result = await workspaceService.findById('workspace-1', 'user-1');

      expect(result.workspace).toEqual(mockWorkspace);
      expect(result.projects).toHaveLength(1);
      expect(result.userRole).toBe(WorkspaceRole.VIEWER);
    });

    it('should throw not found error for non-existent workspace', async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(workspaceService.findById('invalid-id', 'user-1'))
        .rejects.toThrow(APIError);
    });
  });

  describe('findByUser', () => {
    it('should return all workspaces accessible to user', async () => {
      const mockWorkspaceRoles = [
        { workspaceId: 'workspace-1', userId: 'user-1', role: WorkspaceRole.OWNER, workspace: mockWorkspace }
      ];
      prisma.workspaceRole.findMany.mockResolvedValue(mockWorkspaceRoles);
      prisma.project.findMany.mockResolvedValue([mockProject]);

      const results = await workspaceService.findByUser('user-1');

      expect(results).toHaveLength(1);
      expect(results[0].workspace).toEqual(mockWorkspace);
      expect(results[0].projects).toHaveLength(1);
    });
  });

  describe('validateAccess', () => {
    it('should validate access based on role hierarchy', async () => {
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.ADMIN });

      const hasAccess = await workspaceService.validateAccess(
        'workspace-1',
        'user-1',
        WorkspaceRole.EDITOR
      );

      expect(hasAccess).toBe(true);
    });

    it('should reject access for insufficient role', async () => {
      prisma.workspaceRole.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });

      const hasAccess = await workspaceService.validateAccess(
        'workspace-1',
        'user-1',
        WorkspaceRole.ADMIN
      );

      expect(hasAccess).toBe(false);
    });
  });
});