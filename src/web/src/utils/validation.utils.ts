import { z } from 'zod'; // v3.22.0
import type { AuthCredentials } from '../types/auth.types';
import type { CreateWorkspaceDTO } from '../types/workspace.types';
import type { CreateProjectDTO } from '../types/project.types';
import type { DiagramState } from '../types/diagram.types';
import { SQLDialect } from '../types/sql.types';

// Regular expressions for validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\s]{1,48}[a-zA-Z0-9]$/;

// Constants for validation
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com',
  'throwawaymail.com',
  // Add more disposable email domains
]);

const RESERVED_NAMES = new Set([
  'admin',
  'system',
  'root',
  // Add more reserved names
]);

const MAX_DDL_LENGTH = 1048576; // 1MB

// Validation result interface
interface ValidationResult<T = undefined> {
  isValid: boolean;
  error?: string;
  sanitized?: T;
}

/**
 * Validates email format with enhanced security checks
 * @param email - Email address to validate
 * @returns Validation result with detailed error message if invalid
 */
export function validateEmail(email: string): ValidationResult {
  const trimmedEmail = email.trim().toLowerCase();

  // Basic format validation
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Invalid email format'
    };
  }

  // Length validation
  if (trimmedEmail.length < 5 || trimmedEmail.length > 254) {
    return {
      isValid: false,
      error: 'Email must be between 5 and 254 characters'
    };
  }

  // Domain validation
  const [, domain] = trimmedEmail.split('@');
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Disposable email addresses are not allowed'
    };
  }

  return { isValid: true };
}

/**
 * Validates password strength with comprehensive security checks
 * @param password - Password to validate
 * @returns Validation result with strength assessment
 */
export function validatePassword(password: string): ValidationResult {
  // Length validation
  if (password.length < 8 || password.length > 128) {
    return {
      isValid: false,
      error: 'Password must be between 8 and 128 characters'
    };
  }

  // Complexity validation
  if (!PASSWORD_REGEX.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    };
  }

  // Common pattern check
  const commonPatterns = ['password', '123456', 'qwerty'];
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    return {
      isValid: false,
      error: 'Password contains common patterns that are not allowed'
    };
  }

  return { isValid: true };
}

/**
 * Validates and sanitizes workspace name
 * @param name - Workspace name to validate
 * @returns Validation result with sanitized name
 */
export function validateWorkspaceName(name: string): ValidationResult<string> {
  const trimmedName = name.trim();

  // Length validation
  if (trimmedName.length < 3 || trimmedName.length > 50) {
    return {
      isValid: false,
      error: 'Workspace name must be between 3 and 50 characters'
    };
  }

  // Format validation
  if (!NAME_REGEX.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Workspace name can only contain letters, numbers, and spaces'
    };
  }

  // Reserved name check
  if (RESERVED_NAMES.has(trimmedName.toLowerCase())) {
    return {
      isValid: false,
      error: 'This workspace name is reserved'
    };
  }

  // XSS prevention - encode special characters
  const sanitizedName = trimmedName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return {
    isValid: true,
    sanitized: sanitizedName
  };
}

/**
 * Validates and sanitizes project name
 * @param name - Project name to validate
 * @returns Validation result with sanitized name
 */
export function validateProjectName(name: string): ValidationResult<string> {
  const trimmedName = name.trim();

  // Length validation
  if (trimmedName.length < 3 || trimmedName.length > 50) {
    return {
      isValid: false,
      error: 'Project name must be between 3 and 50 characters'
    };
  }

  // Format validation
  if (!NAME_REGEX.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Project name can only contain letters, numbers, and spaces'
    };
  }

  // Reserved name check
  if (RESERVED_NAMES.has(trimmedName.toLowerCase())) {
    return {
      isValid: false,
      error: 'This project name is reserved'
    };
  }

  // XSS prevention - encode special characters
  const sanitizedName = trimmedName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return {
    isValid: true,
    sanitized: sanitizedName
  };
}

/**
 * Validates SQL DDL syntax with dialect-specific checks
 * @param ddl - SQL DDL to validate
 * @param dialect - SQL dialect to use for validation
 * @returns Validation result with detailed error information
 */
export function validateSQLDDL(ddl: string, dialect: SQLDialect): ValidationResult {
  // Length validation
  if (ddl.length === 0) {
    return {
      isValid: false,
      error: 'SQL DDL cannot be empty'
    };
  }

  if (ddl.length > MAX_DDL_LENGTH) {
    return {
      isValid: false,
      error: `SQL DDL exceeds maximum length of ${MAX_DDL_LENGTH} bytes`
    };
  }

  // Basic SQL injection prevention
  const dangerousKeywords = ['DROP', 'TRUNCATE', 'DELETE', 'UPDATE'];
  if (dangerousKeywords.some(keyword => 
    ddl.toUpperCase().includes(keyword + ' ')
  )) {
    return {
      isValid: false,
      error: 'DDL contains dangerous operations that are not allowed'
    };
  }

  // Dialect-specific validation
  try {
    switch (dialect) {
      case SQLDialect.POSTGRESQL:
        // PostgreSQL-specific validation rules
        if (ddl.toLowerCase().includes('postgres_fdw')) {
          return {
            isValid: false,
            error: 'Foreign data wrappers are not supported'
          };
        }
        break;

      case SQLDialect.SNOWFLAKE:
        // Snowflake-specific validation rules
        if (ddl.toLowerCase().includes('external table')) {
          return {
            isValid: false,
            error: 'External tables are not supported'
          };
        }
        break;

      default:
        return {
          isValid: false,
          error: 'Unsupported SQL dialect'
        };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid SQL syntax: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}