import { clsx, type ClassValue } from 'clsx'; // v2.0.0
import { twMerge } from 'tailwind-merge'; // v3.0.0
import type { APIError } from '../types/api.types';
import type { AuthUser } from '../types/auth.types';

// Global constants
const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
};

const DEBOUNCE_DEFAULT_DELAY = 300;

const ROLE_HIERARCHY = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
  GUEST: 0
};

// Error message mapping with i18n support
const ERROR_MESSAGES: Record<string, Record<string, string>> = {
  en: {
    VALIDATION_ERROR: 'Invalid input: {details}',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Insufficient permissions',
    NOT_FOUND: 'Resource not found',
    CONFLICT: 'Resource conflict: {details}',
    INTERNAL_ERROR: 'An unexpected error occurred',
    RATE_LIMITED: 'Too many requests, please try again later'
  }
};

/**
 * Enhanced utility for merging class names with Tailwind CSS optimization
 * @param {...ClassValue[]} inputs - Class names to merge
 * @returns {string} Optimized class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Advanced date formatting with locale and timezone support
 * @param {Date | string | number} date - Date to format
 * @param {Intl.DateTimeFormatOptions} options - Formatting options
 * @param {string} locale - Locale identifier
 * @returns {string} Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_FORMAT,
  locale: string = 'en-US'
): string {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date');
    }
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid date';
  }
}

/**
 * Comprehensive error formatting with i18n support
 * @param {APIError} error - API error object
 * @param {string} locale - Locale identifier
 * @returns {string} Localized error message
 */
export function formatError(error: APIError, locale: string = 'en'): string {
  try {
    const messages = ERROR_MESSAGES[locale] || ERROR_MESSAGES.en;
    const template = messages[error.code] || messages.INTERNAL_ERROR;
    
    if (error.details && Object.keys(error.details).length > 0) {
      return template.replace('{details}', Object.values(error.details).join(', '));
    }
    
    return template.replace('{details}', error.message);
  } catch (err) {
    console.error('Error formatting error:', err);
    return ERROR_MESSAGES.en.INTERNAL_ERROR;
  }
}

/**
 * Enhanced permission checking with role hierarchy
 * @param {AuthUser} user - Authenticated user object
 * @param {string} requiredRole - Required role level
 * @param {string[]} requiredPermissions - Required permissions
 * @returns {boolean} Permission status
 */
export function hasPermission(
  user: AuthUser,
  requiredRole: string,
  requiredPermissions: string[] = []
): boolean {
  try {
    // Check role hierarchy level
    const userRoleLevel = ROLE_HIERARCHY[user.role] ?? -1;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] ?? Infinity;
    
    if (userRoleLevel < requiredRoleLevel) {
      return false;
    }
    
    // Check specific permissions if required
    if (requiredPermissions.length > 0) {
      return requiredPermissions.every(permission => 
        user.permissions?.includes(permission)
      );
    }
    
    return true;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Type-safe debouncing utility with cleanup
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {object} options - Debounce options
 * @returns {Function} Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = DEBOUNCE_DEFAULT_DELAY,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;
  
  function debounced(this: any, ...args: Parameters<T>) {
    lastArgs = args;
    
    const executeNow = options.leading && !timeoutId;
    
    const later = () => {
      timeoutId = undefined;
      if (options.trailing && lastArgs) {
        fn.apply(this, lastArgs);
        lastArgs = undefined;
      }
    };
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(later, delay);
    
    if (executeNow) {
      fn.apply(this, args);
    }
  }
  
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = undefined;
    lastArgs = undefined;
  };
  
  return debounced as T & { cancel: () => void };
}