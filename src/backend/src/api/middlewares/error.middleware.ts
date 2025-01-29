import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { APIError } from '../../core/errors/APIError';
import { ValidationError } from '../../core/errors/ValidationError';
import { AuthError } from '../../core/errors/AuthError';
import { logger } from '../../core/utils/logger.util';

/**
 * Interface for enhanced error response with optional stack trace
 */
interface ErrorResponse {
  status: number;
  message: string;
  correlationId?: string;
  details?: Record<string, any>;
  errors?: Record<string, string[]>;
  stack?: string;
}

/**
 * Centralized error handling middleware for Express applications.
 * Processes different types of errors and returns standardized responses.
 * Implements security-conscious error reporting and environment-specific formatting.
 */
const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract correlation ID for request tracing
  const correlationId = req.headers['x-correlation-id'] as string;

  // Log error with security context and correlation ID
  logger.error(error, {
    correlationId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id
  });

  // Initialize error response
  const errorResponse: ErrorResponse = {
    status: 500,
    message: 'Internal Server Error',
    correlationId
  };

  // Process different error types
  if (error instanceof ValidationError) {
    errorResponse.status = 400;
    errorResponse.message = error.message;
    errorResponse.errors = error.toJSON().errors;
  } else if (error instanceof AuthError) {
    const authError = error.toJSON();
    errorResponse.status = authError.status;
    errorResponse.message = authError.message;
    
    // Only include non-sensitive error details
    if (authError.details) {
      errorResponse.details = {
        errorCategory: authError.details.errorCategory,
        timestamp: authError.details.timestamp
      };
    }
  } else if (error instanceof APIError) {
    const apiError = error.toJSON();
    errorResponse.status = apiError.status;
    errorResponse.message = apiError.message;
    errorResponse.details = apiError.details;
  } else {
    // Handle unknown errors
    errorResponse.message = process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'An unexpected error occurred';
  }

  // Include stack trace only in development environment
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.stack = error.stack;
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Send error response
  res.status(errorResponse.status).json(errorResponse);
};

export default errorHandler;