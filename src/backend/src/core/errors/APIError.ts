/**
 * Base error class for API errors providing standardized error handling with HTTP status codes
 * and consistent error response formatting. Extends the native Error class to maintain proper
 * error inheritance and stack trace capture.
 */
export class APIError extends Error {
  readonly statusCode: number;
  readonly details: Record<string, any>;

  /**
   * Creates a new APIError instance
   * @param statusCode - HTTP status code for the error
   * @param message - Human-readable error message
   * @param details - Optional additional error details
   */
  constructor(
    statusCode: number,
    message: string,
    details: Record<string, any> = {}
  ) {
    // Call parent Error constructor with message
    super(message);

    // Ensure proper inheritance chain
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);

    // Set error properties
    this.statusCode = statusCode;
    this.details = details;

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Converts the error to a JSON-serializable object suitable for API responses
   * @returns Standardized error response object
   */
  toJSON(): Record<string, any> {
    const errorResponse: Record<string, any> = {
      status: this.statusCode,
      message: this.message
    };

    // Include additional details if present
    if (Object.keys(this.details).length > 0) {
      errorResponse.details = this.details;
    }

    // Include stack trace in development environment
    if (process.env.NODE_ENV === 'development' && this.stack) {
      errorResponse.stack = this.stack;
    }

    return errorResponse;
  }

  /**
   * Creates a 400 Bad Request error
   * @param message - Error message
   * @param details - Optional error details
   * @returns New APIError instance
   */
  static badRequest(
    message: string,
    details?: Record<string, any>
  ): APIError {
    return new APIError(400, message, details);
  }

  /**
   * Creates a 404 Not Found error
   * @param message - Error message
   * @param details - Optional error details
   * @returns New APIError instance
   */
  static notFound(
    message: string,
    details?: Record<string, any>
  ): APIError {
    return new APIError(404, message, details);
  }

  /**
   * Creates a 500 Internal Server error
   * @param message - Error message
   * @param details - Optional error details
   * @returns New APIError instance
   */
  static internalServer(
    message: string,
    details?: Record<string, any>
  ): APIError {
    return new APIError(500, message, details);
  }
}