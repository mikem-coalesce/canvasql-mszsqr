import { z } from 'zod'; // v3.22.0
import { validateSchema } from '../../core/utils/validation.util';
import { IAuthCredentials } from '../../core/interfaces/auth.interface';

/**
 * Schema for validating login credentials with enhanced security rules
 * Enforces email format, password complexity, and input sanitization
 */
const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
});

/**
 * Schema for validating user registration data with comprehensive validation rules
 * Includes email, password complexity, and name format validation
 */
const registrationSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .regex(
      /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/,
      'Invalid name format'
    )
});

/**
 * Schema for validating password reset requests
 * Enforces email format validation and sanitization
 */
const passwordResetSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .trim()
});

/**
 * Validates user login credentials with enhanced security rules
 * @param data - Raw login credentials to validate
 * @returns Promise resolving to validated and sanitized login credentials
 * @throws ValidationError if validation fails
 */
export async function validateLoginCredentials(
  data: unknown
): Promise<IAuthCredentials> {
  return validateSchema(loginSchema, data);
}

/**
 * Validates user registration data with comprehensive validation
 * @param data - Raw registration data to validate
 * @returns Promise resolving to validated and sanitized registration data
 * @throws ValidationError if validation fails
 */
export async function validateRegistration(
  data: unknown
): Promise<IAuthCredentials & { name: string }> {
  return validateSchema(registrationSchema, data);
}

/**
 * Validates password reset request data
 * @param data - Raw password reset request data to validate
 * @returns Promise resolving to validated and sanitized email
 * @throws ValidationError if validation fails
 */
export async function validatePasswordReset(
  data: unknown
): Promise<{ email: string }> {
  return validateSchema(passwordResetSchema, data);
}