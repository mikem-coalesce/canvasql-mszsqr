import { PrismaClient } from '@prisma/client'; // v5.0.0
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, jest } from 'jest'; // v29.6.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import ProjectService from '../../src/services/project.service';
import { IProject, ICreateProjectDTO, IUpdateProjectDTO, ProjectMetadata } from '../../src/core/interfaces/project.interface';
import APIError from '../../src/core/errors/APIError';

describe('Project Service Integration Tests', () => {
  let prisma: PrismaClient;
  let projectService: ProjectService;
  let testWorkspaceId: string;
  let testProjectData: ICreateProjectDTO;

  // Initialize test database and create required schemas
  beforeAll(async () => {
    prisma = new PrismaClient();
    projectService = new ProjectService(prisma);

    // Verify database connection
    await prisma.$connect();
  });

  // Clean up database after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Set up test data before each test
  beforeEach(async () => {
    // Create test workspace
    testWorkspaceId = uuidv4();
    await prisma.workspace.create({
      data: {
        id: testWorkspaceId,
        name: 'Test Workspace',
        ownerId: uuidv4(),
        settings: {
          defaultRole: 'EDITOR',
          allowPublicSharing: false,
          enableVersionHistory: true,
          maxProjects: 10,
          securityLevel: 'STANDARD'
        }
      }
    });

    // Prepare test project data
    testProjectData = {
      workspaceId: testWorkspaceId,
      name: 'Test Project',
      description: 'Test project description',
      metadata: {
        tags: ['test'],
        databaseType: 'POSTGRESQL',
        isArchived: false,
        customSettings: {
          enableVersioning: true,
          autoSave: true,
          exportFormat: 'PNG'
        }
      }
    };
  });

  // Clean up test data after each test
  afterEach(async () => {
    await prisma.diagram.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspace.deleteMany();
  });

  describe('Project Creation', () => {
    it('should create project with valid data and verify persistence', async () => {
      const project = await projectService.create(testProjectData);

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.workspaceId).toBe(testWorkspaceId);
      expect(project.name).toBe(testProjectData.name);
      expect(project.metadata).toEqual(testProjectData.metadata);

      // Verify persistence
      const persisted = await prisma.project.findUnique({
        where: { id: project.id }
      });
      expect(persisted).toBeDefined();
      expect(persisted?.name).toBe(testProjectData.name);
    });

    it('should fail with invalid workspace ID and rollback transaction', async () => {
      const invalidData = {
        ...testProjectData,
        workspaceId: uuidv4() // Non-existent workspace ID
      };

      await expect(projectService.create(invalidData))
        .rejects
        .toThrow(APIError);

      // Verify no project was created
      const projects = await prisma.project.findMany({
        where: { workspaceId: invalidData.workspaceId }
      });
      expect(projects).toHaveLength(0);
    });

    it('should fail with duplicate project name in same workspace', async () => {
      // Create first project
      await projectService.create(testProjectData);

      // Attempt to create duplicate
      await expect(projectService.create(testProjectData))
        .rejects
        .toThrow(APIError);
    });
  });

  describe('Project Retrieval', () => {
    let testProject: IProject;

    beforeEach(async () => {
      testProject = await projectService.create(testProjectData);
    });

    it('should find project by ID with complete data', async () => {
      const found = await projectService.findById(testProject.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(testProject.id);
      expect(found.name).toBe(testProject.name);
      expect(found.metadata).toEqual(testProject.metadata);
    });

    it('should find all projects in workspace with pagination', async () => {
      // Create additional test projects
      await Promise.all([
        projectService.create({
          ...testProjectData,
          name: 'Test Project 2'
        }),
        projectService.create({
          ...testProjectData,
          name: 'Test Project 3'
        })
      ]);

      const projects = await projectService.findByWorkspace(testWorkspaceId);

      expect(projects).toHaveLength(3);
      expect(projects.map(p => p.name)).toContain(testProject.name);
    });

    it('should throw not found for invalid project ID', async () => {
      const invalidId = uuidv4();

      await expect(projectService.findById(invalidId))
        .rejects
        .toThrow(APIError);
    });
  });

  describe('Project Updates', () => {
    let testProject: IProject;

    beforeEach(async () => {
      testProject = await projectService.create(testProjectData);
    });

    it('should update project with transaction integrity', async () => {
      const updateData: IUpdateProjectDTO = {
        name: 'Updated Project',
        description: 'Updated description',
        metadata: {
          ...testProject.metadata,
          tags: ['updated']
        }
      };

      const updated = await projectService.update(testProject.id, updateData);

      expect(updated.name).toBe(updateData.name);
      expect(updated.description).toBe(updateData.description);
      expect(updated.metadata.tags).toEqual(['updated']);

      // Verify persistence
      const persisted = await prisma.project.findUnique({
        where: { id: testProject.id }
      });
      expect(persisted?.name).toBe(updateData.name);
    });

    it('should handle partial updates correctly', async () => {
      const partialUpdate: IUpdateProjectDTO = {
        name: 'Partially Updated Project'
      };

      const updated = await projectService.update(testProject.id, partialUpdate);

      expect(updated.name).toBe(partialUpdate.name);
      expect(updated.description).toBe(testProject.description);
      expect(updated.metadata).toEqual(testProject.metadata);
    });

    it('should fail update with invalid project ID', async () => {
      const invalidId = uuidv4();
      const updateData: IUpdateProjectDTO = {
        name: 'Invalid Update'
      };

      await expect(projectService.update(invalidId, updateData))
        .rejects
        .toThrow(APIError);
    });
  });

  describe('Project Deletion', () => {
    let testProject: IProject;

    beforeEach(async () => {
      testProject = await projectService.create(testProjectData);
      
      // Create associated diagram
      await prisma.diagram.create({
        data: {
          id: uuidv4(),
          projectId: testProject.id,
          name: 'Test Diagram',
          sql_ddl: 'CREATE TABLE test (id INT);',
          layout: {},
          annotations: {}
        }
      });
    });

    it('should delete project and cascade to related entities', async () => {
      await projectService.delete(testProject.id);

      // Verify project deletion
      const deletedProject = await prisma.project.findUnique({
        where: { id: testProject.id }
      });
      expect(deletedProject).toBeNull();

      // Verify cascade deletion of diagrams
      const diagrams = await prisma.diagram.findMany({
        where: { projectId: testProject.id }
      });
      expect(diagrams).toHaveLength(0);
    });

    it('should fail deletion with invalid project ID', async () => {
      const invalidId = uuidv4();

      await expect(projectService.delete(invalidId))
        .rejects
        .toThrow(APIError);
    });

    it('should maintain referential integrity during deletion', async () => {
      // Create related entities
      const diagramId = uuidv4();
      await prisma.diagram.create({
        data: {
          id: diagramId,
          projectId: testProject.id,
          name: 'Another Diagram',
          sql_ddl: 'CREATE TABLE test2 (id INT);',
          layout: {},
          annotations: {}
        }
      });

      await projectService.delete(testProject.id);

      // Verify all related entities are deleted
      const diagrams = await prisma.diagram.findMany({
        where: { projectId: testProject.id }
      });
      expect(diagrams).toHaveLength(0);
    });
  });
});