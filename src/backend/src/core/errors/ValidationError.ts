import { APIError } from './APIError';

/**
 * Specialized error class for handling validation errors with field-level error messages.
 * Extends APIError to provide standardized validation error responses while maintaining
 * proper error inheritance and security considerations.
 */
export class ValidationError extends APIError {
  protected readonly errors: Record<string, string[]>;

  /**
   * Creates a new ValidationError instance with field-level validation errors
   * @param errors - Object containing field names as keys and arrays of error messages as values
   */
  constructor(errors: Record<string, string[]>) {
    // Call parent APIError constructor with 400 Bad Request status code
    super(400, 'Validation Error');

    // Set error name for proper instanceof checks
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);

    // Store validation errors
    this.errors = errors;

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Converts validation error instance to a JSON-serializable object for API responses
   * @returns Standardized error response object including field-level validation errors
   */
  toJSON(): Record<string, any> {
    // Get base error response from parent
    const errorResponse = super.toJSON();

    // Add validation errors to response
    errorResponse.errors = this.errors;

    return errorResponse;
  }
}