import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import { PrismaClient } from '@prisma/client'; // v5.0.0
import ProjectService from '../../../src/services/project.service';
import { IProject } from '../../../src/core/interfaces/project.interface';
import APIError from '../../../src/core/errors/APIError';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      project: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn()
      },
      workspace: {
        findUnique: jest.fn()
      },
      diagram: {
        deleteMany: jest.fn()
      },
      $transaction: jest.fn((callback) => callback({
        project: {
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        },
        diagram: {
          deleteMany: jest.fn()
        }
      }))
    }))
  };
});

describe('ProjectService', () => {
  let projectService: ProjectService;
  let prisma: jest.Mocked<PrismaClient>;

  // Helper function to create mock project data
  const createMockProject = (overrides = {}): IProject => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    workspaceId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Project',
    description: 'Test Description',
    metadata: {
      tags: ['test'],
      databaseType: 'POSTGRESQL',
      isArchived: false,
      customSettings: {
        enableVersioning: true,
        autoSave: true,
        exportFormat: 'PNG'
      }
    },
    createdAt: new Date(),
    ...overrides
  });

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    projectService = new ProjectService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create a new project successfully', async () => {
      const mockWorkspace = { id: '123e4567-e89b-12d3-a456-426614174001' };
      const mockProject = createMockProject();
      
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          project: {
            create: jest.fn().mockResolvedValue(mockProject)
          }
        };
        return callback(tx);
      });

      const result = await projectService.create({
        workspaceId: mockWorkspace.id,
        name: 'Test Project',
        description: 'Test Description',
        metadata: mockProject.metadata
      });

      expect(result).toEqual(mockProject);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: mockWorkspace.id }
      });
    });

    it("should throw error if workspace doesn't exist", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(projectService.create({
        workspaceId: 'non-existent',
        name: 'Test Project',
        description: '',
        metadata: createMockProject().metadata
      })).rejects.toThrow(APIError);
    });

    it('should throw error if project name is invalid', async () => {
      await expect(projectService.create({
        workspaceId: '123',
        name: '',
        description: '',
        metadata: createMockProject().metadata
      })).rejects.toThrow(APIError);
    });
  });

  describe('update()', () => {
    it('should update project details successfully', async () => {
      const mockProject = createMockProject();
      const updatedProject = { ...mockProject, name: 'Updated Name' };

      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          project: {
            update: jest.fn().mockResolvedValue(updatedProject)
          }
        };
        return callback(tx);
      });

      const result = await projectService.update(mockProject.id, {
        name: 'Updated Name'
      });

      expect(result).toEqual(updatedProject);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockProject.id }
      });
    });

    it("should throw error if project doesn't exist", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(projectService.update('non-existent', {
        name: 'Updated Name'
      })).rejects.toThrow(APIError);
    });

    it('should maintain workspace association during update', async () => {
      const mockProject = createMockProject();
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          project: {
            update: jest.fn().mockResolvedValue(mockProject)
          }
        };
        return callback(tx);
      });

      await projectService.update(mockProject.id, {
        name: 'Updated Name'
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('should delete project and associated diagrams', async () => {
      const mockProject = createMockProject();
      prisma.project.findUnique.mockResolvedValue(mockProject);

      await projectService.delete(mockProject.id);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockProject.id }
      });
    });

    it("should throw error if project doesn't exist", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(projectService.delete('non-existent'))
        .rejects.toThrow(APIError);
    });

    it('should handle cascade deletion failures', async () => {
      const mockProject = createMockProject();
      prisma.project.findUnique.mockResolvedValue(mockProject);
      prisma.$transaction.mockRejectedValue(new Error('Deletion failed'));

      await expect(projectService.delete(mockProject.id))
        .rejects.toThrow(APIError);
    });
  });

  describe('findById()', () => {
    it('should return project if exists', async () => {
      const mockProject = createMockProject();
      prisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await projectService.findById(mockProject.id);

      expect(result).toEqual(mockProject);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        include: { diagrams: true }
      });
    });

    it('should throw error if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(projectService.findById('non-existent'))
        .rejects.toThrow(APIError);
    });

    it('should include project metadata', async () => {
      const mockProject = createMockProject();
      prisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await projectService.findById(mockProject.id);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.customSettings).toBeDefined();
    });
  });

  describe('findByWorkspace()', () => {
    it('should return all projects in workspace', async () => {
      const mockWorkspace = { id: '123e4567-e89b-12d3-a456-426614174001' };
      const mockProjects = [createMockProject(), createMockProject()];

      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.project.findMany.mockResolvedValue(mockProjects);

      const result = await projectService.findByWorkspace(mockWorkspace.id);

      expect(result).toEqual(mockProjects);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspace.id,
          metadata: {
            path: ['isArchived'],
            equals: false
          }
        },
        include: { diagrams: true },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should return empty array for new workspace', async () => {
      const mockWorkspace = { id: '123e4567-e89b-12d3-a456-426614174001' };
      prisma.workspace.findUnique.mockResolvedValue(mockWorkspace);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await projectService.findByWorkspace(mockWorkspace.id);

      expect(result).toEqual([]);
    });

    it("should throw error if workspace doesn't exist", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(projectService.findByWorkspace('non-existent'))
        .rejects.toThrow(APIError);
    });
  });
});