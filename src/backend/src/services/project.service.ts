import { PrismaClient } from '@prisma/client'; // v5.0.0
import { 
  IProject, 
  ICreateProjectDTO, 
  IUpdateProjectDTO,
  ProjectMetadata 
} from '../core/interfaces/project.interface';
import APIError from '../core/errors/APIError';

/**
 * Service class implementing project management operations with comprehensive
 * error handling and monitoring for the ERD visualization tool.
 */
export class ProjectService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates a new project within a workspace with validation and error handling
   * @param projectData Project creation data transfer object
   * @returns Promise resolving to created project instance
   * @throws APIError if validation fails or workspace doesn't exist
   */
  async create(projectData: ICreateProjectDTO): Promise<IProject> {
    try {
      // Validate required fields
      if (!projectData.workspaceId || !projectData.name) {
        throw APIError.badRequest('Missing required project fields', {
          required: ['workspaceId', 'name'],
          received: Object.keys(projectData)
        });
      }

      // Check if workspace exists
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: projectData.workspaceId }
      });

      if (!workspace) {
        throw APIError.notFound('Workspace not found', {
          workspaceId: projectData.workspaceId
        });
      }

      // Initialize default project metadata
      const defaultMetadata: ProjectMetadata = {
        tags: [],
        databaseType: 'POSTGRESQL',
        isArchived: false,
        customSettings: {
          enableVersioning: true,
          autoSave: true,
          exportFormat: 'PNG'
        }
      };

      // Create project with transaction
      const project = await this.prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            workspaceId: projectData.workspaceId,
            name: projectData.name,
            description: projectData.description || '',
            metadata: defaultMetadata
          }
        });

        return created;
      });

      return project;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw APIError.internalServer('Failed to create project', { error });
    }
  }

  /**
   * Updates an existing project with validation and error handling
   * @param projectId ID of project to update
   * @param updateData Project update data transfer object
   * @returns Promise resolving to updated project instance
   * @throws APIError if project not found or validation fails
   */
  async update(projectId: string, updateData: IUpdateProjectDTO): Promise<IProject> {
    try {
      // Check if project exists
      const existingProject = await this.prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!existingProject) {
        throw APIError.notFound('Project not found', { projectId });
      }

      // Update project with transaction
      const updated = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.update({
          where: { id: projectId },
          data: {
            name: updateData.name,
            description: updateData.description,
            metadata: updateData.metadata ? {
              ...existingProject.metadata,
              ...updateData.metadata
            } : undefined
          }
        });

        return project;
      });

      return updated;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw APIError.internalServer('Failed to update project', { error });
    }
  }

  /**
   * Deletes a project and its associated diagrams with cascading deletion
   * @param projectId ID of project to delete
   * @returns Promise resolving when deletion is complete
   * @throws APIError if project not found or deletion fails
   */
  async delete(projectId: string): Promise<void> {
    try {
      // Check if project exists
      const project = await this.prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        throw APIError.notFound('Project not found', { projectId });
      }

      // Delete project and related data with transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete associated diagrams first
        await tx.diagram.deleteMany({
          where: { projectId }
        });

        // Delete project
        await tx.project.delete({
          where: { id: projectId }
        });
      });
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw APIError.internalServer('Failed to delete project', { error });
    }
  }

  /**
   * Retrieves a project by its ID with detailed error handling
   * @param projectId ID of project to find
   * @returns Promise resolving to found project instance
   * @throws APIError if project not found
   */
  async findById(projectId: string): Promise<IProject> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          diagrams: true
        }
      });

      if (!project) {
        throw APIError.notFound('Project not found', { projectId });
      }

      return project;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw APIError.internalServer('Failed to retrieve project', { error });
    }
  }

  /**
   * Retrieves all projects in a workspace with pagination and filtering
   * @param workspaceId ID of workspace to find projects for
   * @returns Promise resolving to array of projects in workspace
   * @throws APIError if workspace not found or query fails
   */
  async findByWorkspace(workspaceId: string): Promise<IProject[]> {
    try {
      // Check if workspace exists
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId }
      });

      if (!workspace) {
        throw APIError.notFound('Workspace not found', { workspaceId });
      }

      // Retrieve projects with optimized query
      const projects = await this.prisma.project.findMany({
        where: { 
          workspaceId,
          metadata: {
            path: ['isArchived'],
            equals: false
          }
        },
        include: {
          diagrams: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return projects;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw APIError.internalServer('Failed to retrieve workspace projects', { error });
    }
  }
}

export default ProjectService;