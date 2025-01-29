import { APIError } from '../errors/APIError';

/**
 * Specialized error class for handling authentication and authorization failures
 * with integrated security monitoring and error tracking capabilities.
 * Extends APIError to maintain consistent error handling patterns.
 */
export class AuthError extends APIError {
  /**
   * Creates a new AuthError instance
   * @param statusCode - HTTP status code for the authentication error
   * @param message - Human-readable error message
   * @param details - Additional error details for tracking and monitoring
   */
  constructor(
    statusCode: number,
    message: string,
    details: Record<string, any> = {}
  ) {
    // Call parent APIError constructor
    super(statusCode, message, details);

    // Set error name for tracking
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);

    // Ensure stack trace capture
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }

  /**
   * Creates a 401 Unauthorized error with tracking details
   * @param message - Error message describing the unauthorized access
   * @param details - Additional context for security monitoring
   * @returns AuthError instance with 401 status code
   */
  static unauthorized(
    message: string,
    details: Record<string, any> = {}
  ): AuthError {
    return new AuthError(401, message, {
      ...details,
      errorCategory: 'authentication',
      timestamp: new Date().toISOString(),
      securityLevel: 'high'
    });
  }

  /**
   * Creates a 403 Forbidden error with tracking details
   * @param message - Error message describing the forbidden access
   * @param details - Additional context for security monitoring
   * @returns AuthError instance with 403 status code
   */
  static forbidden(
    message: string,
    details: Record<string, any> = {}
  ): AuthError {
    return new AuthError(403, message, {
      ...details,
      errorCategory: 'authorization',
      timestamp: new Date().toISOString(),
      securityLevel: 'high'
    });
  }

  /**
   * Creates a 401 Invalid Token error with token-specific tracking
   * @param message - Error message describing the token issue
   * @param details - Token-related details for security monitoring
   * @returns AuthError instance with 401 status code
   */
  static invalidToken(
    message: string,
    details: Record<string, any> = {}
  ): AuthError {
    return new AuthError(401, message, {
      ...details,
      errorCategory: 'token',
      tokenError: true,
      timestamp: new Date().toISOString(),
      securityLevel: 'critical',
      requiresAudit: true
    });
  }

  /**
   * Creates a 401 Session Expired error with session tracking
   * @param message - Error message describing the session expiration
   * @param details - Session-related details for security monitoring
   * @returns AuthError instance with 401 status code
   */
  static sessionExpired(
    message: string,
    details: Record<string, any> = {}
  ): AuthError {
    return new AuthError(401, message, {
      ...details,
      errorCategory: 'session',
      sessionError: true,
      timestamp: new Date().toISOString(),
      securityLevel: 'medium',
      expiryTime: new Date().toISOString()
    });
  }
}