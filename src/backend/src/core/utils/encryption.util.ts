import argon2 from 'argon2'; // v0.31.0
import { APIError } from '../errors/APIError';

/**
 * Configuration for Argon2id hashing algorithm with enterprise-grade parameters
 * Based on OWASP recommendations and industry best practices for 2023
 */
const HASH_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB in KiB
  timeCost: 3,       // Number of iterations
  parallelism: 4,    // Parallel threads
  hashLength: 32,    // Output hash length in bytes
  saltLength: 16     // Salt length in bytes
} as const;

/**
 * Hashes a plain text password using the Argon2id algorithm with secure parameters.
 * Implements enterprise-grade security with configurable memory cost, time cost,
 * and parallelism factors.
 * 
 * @param password - The plain text password to hash
 * @returns Promise resolving to the complete hash string including parameters
 * @throws APIError if hashing fails or input validation fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Input validation
    if (!password || typeof password !== 'string') {
      throw APIError.badRequest('Invalid password input');
    }

    // Apply pepper if configured in environment
    const pepperedPassword = process.env.PASSWORD_PEPPER 
      ? `${password}${process.env.PASSWORD_PEPPER}`
      : password;

    // Generate hash with secure parameters
    const hash = await argon2.hash(pepperedPassword, {
      ...HASH_CONFIG,
      secret: process.env.PASSWORD_PEPPER 
        ? Buffer.from(process.env.PASSWORD_PEPPER)
        : undefined
    });

    return hash;
  } catch (error) {
    // Handle known argon2 errors
    if (error instanceof argon2.ArgonError) {
      throw APIError.internalServer(
        'Password hashing failed',
        { cause: error.message }
      );
    }
    
    // Re-throw API errors
    if (error instanceof APIError) {
      throw error;
    }

    // Handle unexpected errors
    throw APIError.internalServer(
      'Unexpected error during password hashing',
      { cause: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Verifies a plain text password against a stored hash using time-constant comparison.
 * Supports verification of hashes generated with different Argon2id parameters.
 * 
 * @param password - The plain text password to verify
 * @param storedHash - The complete stored hash string to verify against
 * @returns Promise resolving to boolean indicating if password matches
 * @throws APIError if verification fails or input validation fails
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Input validation
    if (!password || !storedHash) {
      throw APIError.badRequest('Invalid password or hash input');
    }

    if (typeof password !== 'string' || typeof storedHash !== 'string') {
      throw APIError.badRequest('Password and hash must be strings');
    }

    // Apply pepper if configured in environment
    const pepperedPassword = process.env.PASSWORD_PEPPER 
      ? `${password}${process.env.PASSWORD_PEPPER}`
      : password;

    // Verify with time-constant comparison
    const isValid = await argon2.verify(storedHash, pepperedPassword, {
      secret: process.env.PASSWORD_PEPPER 
        ? Buffer.from(process.env.PASSWORD_PEPPER)
        : undefined
    });

    return isValid;
  } catch (error) {
    // Handle known argon2 errors
    if (error instanceof argon2.ArgonError) {
      throw APIError.internalServer(
        'Password verification failed',
        { cause: error.message }
      );
    }

    // Re-throw API errors
    if (error instanceof APIError) {
      throw error;
    }

    // Handle unexpected errors
    throw APIError.internalServer(
      'Unexpected error during password verification',
      { cause: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}