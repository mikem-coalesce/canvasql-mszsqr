import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { z } from 'zod'; // v3.22.0
import { validateSchema } from '../../core/utils/validation.util';
import { ValidationError } from '../../core/errors/ValidationError';

/**
 * Enum defining possible request validation targets
 */
export enum ValidationTarget {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params'
}

/**
 * Type definition for Express middleware function with async support
 */
export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Creates a type-safe middleware function that validates request data against a Zod schema
 * @param schema - Zod schema to validate the request data against
 * @param target - Which part of the request to validate (body, query, or params)
 * @returns Express middleware function that performs validation
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  target: ValidationTarget
): ExpressMiddleware {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract data to validate based on target
      const dataToValidate = req[target];

      // Validate the data using the provided schema
      const validatedData = await validateSchema(schema, dataToValidate);

      // Type assertion to ensure type safety when assigning validated data
      type ValidatedRequestKey = keyof Request;
      const targetKey = target as ValidatedRequestKey;

      // Attach typed and validated data to request object
      req[targetKey] = validatedData as Request[ValidatedRequestKey];

      // Proceed to next middleware
      next();
    } catch (error) {
      // Handle validation errors
      if (error instanceof ValidationError) {
        next(error);
        return;
      }

      // Handle unexpected errors
      next(new ValidationError({
        _error: [`Unexpected validation error for ${target}: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }));
    }
  };
}

/**
 * Type-safe validation middleware factory
 * Usage example:
 * 
 * const userSchema = z.object({
 *   email: ValidationRules.email,
 *   password: ValidationRules.string
 * });
 * 
 * router.post('/users', validate(userSchema, ValidationTarget.BODY), createUser);
 */
export default validate;