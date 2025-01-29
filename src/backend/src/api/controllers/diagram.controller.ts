import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { z } from 'zod'; // ^3.22.0
import { DiagramService } from '../../services/diagram.service';
import { ValidationError } from '../../core/errors/ValidationError';
import { SQLDialect } from '../../core/types/diagram.types';
import { DiagramValidationSchema } from '../../core/types/diagram.types';
import { ICreateDiagramDTO, IUpdateDiagramDTO } from '../../core/interfaces/diagram.interface';

/**
 * Controller handling diagram-related HTTP endpoints with comprehensive validation
 * and SQL dialect support for the ERD visualization system.
 */
export class DiagramController {
  private readonly validationSchemas: {
    create: z.ZodObject<any>;
    update: z.ZodObject<any>;
  };

  constructor(private readonly diagramService: DiagramService) {
    this.initializeValidationSchemas();
  }

  /**
   * Creates a new diagram with SQL validation and dialect detection
   */
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const validatedData = this.validationSchemas.create.parse(req.body);

      // Create diagram with validated data
      const diagram = await this.diagramService.create({
        projectId: validatedData.projectId,
        name: validatedData.name,
        sqlDDL: validatedData.sqlDDL
      });

      res.status(201).json({
        success: true,
        data: diagram
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError(this.formatZodError(error)));
        return;
      }
      next(error);
    }
  }

  /**
   * Updates an existing diagram with layout and SQL validation
   */
  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = this.validationSchemas.update.parse(req.body);

      const diagram = await this.diagramService.update(id, {
        name: validatedData.name,
        sqlDDL: validatedData.sqlDDL,
        layout: validatedData.layout,
        annotations: validatedData.annotations
      });

      res.status(200).json({
        success: true,
        data: diagram
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError(this.formatZodError(error)));
        return;
      }
      next(error);
    }
  }

  /**
   * Retrieves a diagram by ID with caching support
   */
  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const diagram = await this.diagramService.findById(id, req.user.id);

      res.status(200).json({
        success: true,
        data: diagram
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves all diagrams for a project with pagination
   */
  public async getByProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const diagrams = await this.diagramService.findByProject(projectId, req.user.id);

      res.status(200).json({
        success: true,
        data: diagrams
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a diagram with cleanup of associated resources
   */
  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.diagramService.delete(id, req.user.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Initializes Zod validation schemas for request validation
   */
  private initializeValidationSchemas(): void {
    this.validationSchemas = {
      create: z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(100),
        sqlDDL: z.string().min(1).max(1000000), // Max 1MB SQL
        dialect: z.nativeEnum(SQLDialect).optional()
      }),
      update: z.object({
        name: z.string().min(1).max(100).optional(),
        sqlDDL: z.string().min(1).max(1000000).optional(),
        layout: DiagramValidationSchema.shape.nodes.optional(),
        annotations: z.record(z.any()).optional()
      })
    };
  }

  /**
   * Formats Zod validation errors into API-friendly format
   */
  private formatZodError(error: z.ZodError): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(err.message);
    });

    return errors;
  }
}