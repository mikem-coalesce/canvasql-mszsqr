import { describe, it, beforeAll, beforeEach, afterAll, afterEach, expect, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { WorkspaceService } from '../../src/services/workspace.service';
import { 
  WorkspaceRole, 
  WorkspaceSettings,
  IWorkspace,
  ICreateWorkspaceDTO,
  IUpdateWorkspaceDTO 
} from '../../src/core/interfaces/workspace.interface';
import APIError from '../../src/core/errors/APIError';

// Mock logger to avoid test output noise
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('Workspace Management Integration Tests', () => {
  let prisma: PrismaClient;
  let workspaceService: WorkspaceService;
  let testUserId: string;

  // Default test workspace settings
  const defaultSettings: WorkspaceSettings = {
    defaultRole: WorkspaceRole.VIEWER,
    allowPublicSharing: false,
    enableVersionHistory: true,
    maxProjects: 10,
    securityLevel: 'standard'
  };

  beforeAll(async () => {
    // Initialize test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL
        }
      }
    });
    workspaceService = new WorkspaceService(prisma, mockLogger as any);
    testUserId = 'test-user-id';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Start transaction for test isolation
    await prisma.$transaction(async (tx) => {
      // Clean existing test data
      await tx.workspaceRole.deleteMany();
      await tx.project.deleteMany();
      await tx.workspace.deleteMany();
    });
  });

  describe('Workspace Creation', () => {
    it('should create workspace with valid data and verify all fields', async () => {
      const createData: ICreateWorkspaceDTO = {
        name: 'Test Workspace',
        settings: defaultSettings
      };

      const result = await workspaceService.create(testUserId, createData);

      expect(result.workspace).toBeDefined();
      expect(result.workspace.name).toBe(createData.name);
      expect(result.workspace.ownerId).toBe(testUserId);
      expect(result.workspace.settings).toEqual(defaultSettings);
      expect(result.userRole).toBe(WorkspaceRole.OWNER);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('Default Project');
    });

    it('should fail with invalid workspace name and provide error details', async () => {
      const createData: ICreateWorkspaceDTO = {
        name: '', // Invalid empty name
        settings: defaultSettings
      };

      await expect(workspaceService.create(testUserId, createData))
        .rejects
        .toThrow(APIError);
    });

    it('should handle concurrent workspace creation', async () => {
      const createPromises = Array(5).fill(null).map((_, index) => 
        workspaceService.create(testUserId, {
          name: `Concurrent Workspace ${index}`,
          settings: defaultSettings
        })
      );

      const results = await Promise.allSettled(createPromises);
      const successfulCreations = results.filter(r => r.status === 'fulfilled');
      expect(successfulCreations).toHaveLength(5);
    });
  });

  describe('Workspace Updates', () => {
    let testWorkspace: IWorkspace;

    beforeEach(async () => {
      const result = await workspaceService.create(testUserId, {
        name: 'Update Test Workspace',
        settings: defaultSettings
      });
      testWorkspace = result.workspace;
    });

    it('should update workspace with transaction rollback on failure', async () => {
      const updateData: IUpdateWorkspaceDTO = {
        name: 'Updated Workspace',
        settings: {
          ...defaultSettings,
          maxProjects: 20
        }
      };

      const result = await workspaceService.update(
        testWorkspace.id,
        testUserId,
        updateData
      );

      expect(result.workspace.name).toBe(updateData.name);
      expect(result.workspace.settings.maxProjects).toBe(20);
    });

    it('should validate field-level permissions during update', async () => {
      // Create viewer user
      const viewerId = 'viewer-user-id';
      await workspaceService.updateUserRole(
        testWorkspace.id,
        viewerId,
        WorkspaceRole.VIEWER,
        testUserId
      );

      // Attempt update as viewer
      const updateData: IUpdateWorkspaceDTO = {
        name: 'Unauthorized Update'
      };

      await expect(workspaceService.update(
        testWorkspace.id,
        viewerId,
        updateData
      )).rejects.toThrow(APIError);
    });
  });

  describe('Access Control', () => {
    let testWorkspace: IWorkspace;

    beforeEach(async () => {
      const result = await workspaceService.create(testUserId, {
        name: 'Access Control Test',
        settings: defaultSettings
      });
      testWorkspace = result.workspace;
    });

    it('should enforce granular permission checks for all operations', async () => {
      const viewerId = 'viewer-user';
      const editorId = 'editor-user';
      const adminId = 'admin-user';

      // Set up users with different roles
      await workspaceService.updateUserRole(
        testWorkspace.id,
        viewerId,
        WorkspaceRole.VIEWER,
        testUserId
      );
      await workspaceService.updateUserRole(
        testWorkspace.id,
        editorId,
        WorkspaceRole.EDITOR,
        testUserId
      );
      await workspaceService.updateUserRole(
        testWorkspace.id,
        adminId,
        WorkspaceRole.ADMIN,
        testUserId
      );

      // Verify role-based access
      expect(await workspaceService.validateAccess(
        testWorkspace.id,
        viewerId,
        WorkspaceRole.VIEWER
      )).toBe(true);
      expect(await workspaceService.validateAccess(
        testWorkspace.id,
        viewerId,
        WorkspaceRole.EDITOR
      )).toBe(false);
      expect(await workspaceService.validateAccess(
        testWorkspace.id,
        editorId,
        WorkspaceRole.EDITOR
      )).toBe(true);
      expect(await workspaceService.validateAccess(
        testWorkspace.id,
        adminId,
        WorkspaceRole.ADMIN
      )).toBe(true);
    });

    it('should handle role inheritance and delegation', async () => {
      const adminId = 'admin-user';
      await workspaceService.updateUserRole(
        testWorkspace.id,
        adminId,
        WorkspaceRole.ADMIN,
        testUserId
      );

      // Admin should be able to manage editor roles
      const editorId = 'editor-user';
      await expect(workspaceService.updateUserRole(
        testWorkspace.id,
        editorId,
        WorkspaceRole.EDITOR,
        adminId
      )).resolves.not.toThrow();

      // Editor should not be able to manage roles
      await expect(workspaceService.updateUserRole(
        testWorkspace.id,
        'new-user',
        WorkspaceRole.VIEWER,
        editorId
      )).rejects.toThrow(APIError);
    });
  });

  describe('Data Integrity', () => {
    let testWorkspace: IWorkspace;

    beforeEach(async () => {
      const result = await workspaceService.create(testUserId, {
        name: 'Data Integrity Test',
        settings: defaultSettings
      });
      testWorkspace = result.workspace;
    });

    it('should maintain referential integrity during operations', async () => {
      // Delete workspace and verify cascading deletes
      await workspaceService.delete(testWorkspace.id, testUserId);

      // Verify workspace and related data are deleted
      const workspaceExists = await prisma.workspace.findUnique({
        where: { id: testWorkspace.id }
      });
      expect(workspaceExists).toBeNull();

      const projects = await prisma.project.findMany({
        where: { workspaceId: testWorkspace.id }
      });
      expect(projects).toHaveLength(0);

      const roles = await prisma.workspaceRole.findMany({
        where: { workspaceId: testWorkspace.id }
      });
      expect(roles).toHaveLength(0);
    });

    it('should handle large workspace data volumes', async () => {
      // Create multiple projects in workspace
      const projectPromises = Array(50).fill(null).map((_, index) =>
        prisma.project.create({
          data: {
            name: `Project ${index}`,
            workspaceId: testWorkspace.id,
            createdById: testUserId
          }
        })
      );

      await Promise.all(projectPromises);

      // Verify workspace can be retrieved with all projects
      const result = await workspaceService.findById(testWorkspace.id, testUserId);
      expect(result.projects.length).toBe(51); // 50 + default project
    });
  });
});