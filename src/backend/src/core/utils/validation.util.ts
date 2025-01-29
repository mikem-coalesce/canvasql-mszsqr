import { z } from 'zod'; // v3.22.0
import { ValidationError } from '../errors/ValidationError';

/**
 * Maximum allowed length for string fields to prevent DOS attacks
 */
export const MAX_STRING_LENGTH = 500;

/**
 * Minimum required length for string fields to ensure data quality
 */
export const MIN_STRING_LENGTH = 3;

/**
 * Standard prefix for validation error messages
 */
export const VALIDATION_ERROR_PREFIX = 'Validation failed:';

/**
 * Validates input data against a provided Zod schema with comprehensive error handling
 * @param schema - Zod schema to validate against
 * @param data - Input data to validate
 * @returns Promise resolving to validated and typed data
 * @throws ValidationError if validation fails
 */
export async function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<T> {
  try {
    // Ensure input data exists
    if (data === undefined || data === null) {
      throw new ValidationError({
        _error: [`${VALIDATION_ERROR_PREFIX} Input data is required`]
      });
    }

    // Parse and validate data using schema
    const validatedData = await schema.parseAsync(data);

    // Return strongly-typed validated data
    return validatedData;
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const formattedErrors = formatZodError(error);
      throw new ValidationError(formattedErrors);
    }

    // Re-throw ValidationErrors
    if (error instanceof ValidationError) {
      throw error;
    }

    // Handle unexpected errors
    throw new ValidationError({
      _error: [`${VALIDATION_ERROR_PREFIX} An unexpected validation error occurred`]
    });
  }
}

/**
 * Formats Zod validation errors into a structured object with field-level messages
 * @param error - Zod validation error object
 * @returns Object mapping field paths to arrays of error messages
 */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};

  // Process each validation issue
  error.errors.forEach((issue) => {
    // Get field path, defaulting to _error for root issues
    const path = issue.path.length > 0 ? issue.path.join('.') : '_error';

    // Initialize error array for field if not exists
    if (!formattedErrors[path]) {
      formattedErrors[path] = [];
    }

    // Format error message
    let message = issue.message;
    if (!message.startsWith(VALIDATION_ERROR_PREFIX)) {
      message = `${VALIDATION_ERROR_PREFIX} ${message}`;
    }

    // Add formatted message to field errors
    formattedErrors[path].push(message);
  });

  // Sort error messages for consistency
  Object.keys(formattedErrors).forEach((key) => {
    formattedErrors[key].sort();
  });

  return formattedErrors;
}

/**
 * Common schema validation rules
 */
export const ValidationRules = {
  /**
   * Base string validation with length constraints and trimming
   */
  string: z.string()
    .min(MIN_STRING_LENGTH, `${VALIDATION_ERROR_PREFIX} Must be at least ${MIN_STRING_LENGTH} characters`)
    .max(MAX_STRING_LENGTH, `${VALIDATION_ERROR_PREFIX} Must not exceed ${MAX_STRING_LENGTH} characters`)
    .trim(),

  /**
   * UUID validation
   */
  uuid: z.string().uuid(`${VALIDATION_ERROR_PREFIX} Invalid UUID format`),

  /**
   * Email validation
   */
  email: z.string()
    .email(`${VALIDATION_ERROR_PREFIX} Invalid email format`)
    .max(MAX_STRING_LENGTH, `${VALIDATION_ERROR_PREFIX} Email must not exceed ${MAX_STRING_LENGTH} characters`)
    .trim(),

  /**
   * Date validation
   */
  date: z.date({
    required_error: `${VALIDATION_ERROR_PREFIX} Date is required`,
    invalid_type_error: `${VALIDATION_ERROR_PREFIX} Invalid date format`
  }),

  /**
   * Positive number validation
   */
  positiveNumber: z.number()
    .positive(`${VALIDATION_ERROR_PREFIX} Must be a positive number`)
    .finite(`${VALIDATION_ERROR_PREFIX} Must be a finite number`),

  /**
   * Array validation with length constraints
   */
  array: <T extends z.ZodTypeAny>(schema: T) => z.array(schema)
    .nonempty(`${VALIDATION_ERROR_PREFIX} Array must not be empty`)
    .max(100, `${VALIDATION_ERROR_PREFIX} Array must not exceed 100 items`),

  /**
   * Object validation ensuring no unknown keys
   */
  object: <T extends z.ZodRawShape>(shape: T) => z.object(shape)
    .strict(`${VALIDATION_ERROR_PREFIX} Unknown fields are not allowed`)
};