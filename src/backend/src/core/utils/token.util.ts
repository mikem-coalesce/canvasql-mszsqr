/**
 * JWT Token Generation and Validation Utility
 * Implements secure token management using RS256 algorithm with comprehensive validation
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken';
import { authConfig } from '../../config/auth.config';
import { IAuthTokens } from '../interfaces/auth.interface';
import { TokenType } from '../types/auth.types';

// Environment variables for JWT secrets
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 
  (() => { throw new Error('JWT_ACCESS_SECRET is required') })();
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 
  (() => { throw new Error('JWT_REFRESH_SECRET is required') })();

/**
 * Custom error class for token validation failures
 */
class TokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

/**
 * Generates a new pair of JWT access and refresh tokens
 * @param payload - User data and claims to include in tokens
 * @returns Promise resolving to token pair with expiry information
 * @throws Error if token generation fails
 */
export async function generateTokens(payload: Record<string, any>): Promise<IAuthTokens> {
  try {
    // Validate payload
    if (!payload.userId || !payload.email || !payload.role) {
      throw new Error('Invalid token payload: missing required fields');
    }

    // Generate access token
    const accessToken = jwt.sign(
      {
        ...payload,
        type: TokenType.ACCESS,
        iss: authConfig.jwt.issuer,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_ACCESS_SECRET,
      {
        algorithm: 'RS256',
        expiresIn: authConfig.tokens.access.expiresIn
      }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        type: TokenType.REFRESH,
        iss: authConfig.jwt.issuer,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_REFRESH_SECRET,
      {
        algorithm: 'RS256',
        expiresIn: authConfig.tokens.refresh.expiresIn
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: authConfig.tokens.access.expiresIn,
      tokenType: 'Bearer'
    };
  } catch (error) {
    console.error('Token generation failed:', error);
    throw new Error('Failed to generate authentication tokens');
  }
}

/**
 * Validates a JWT token with comprehensive security checks
 * @param token - JWT token to validate
 * @param type - Expected token type (access/refresh)
 * @returns Promise resolving to decoded token payload
 * @throws TokenValidationError if validation fails
 */
export async function verifyToken(
  token: string,
  type: TokenType
): Promise<Record<string, any>> {
  try {
    // Input validation
    if (!token) {
      throw new TokenValidationError('Token is required');
    }

    // Select appropriate secret based on token type
    const secret = type === TokenType.ACCESS ? JWT_ACCESS_SECRET : JWT_REFRESH_SECRET;

    // Verify token with comprehensive checks
    const decoded = jwt.verify(token, secret, {
      algorithms: ['RS256'],
      issuer: authConfig.jwt.issuer,
      clockTolerance: 30, // 30 seconds tolerance for clock skew
    }) as Record<string, any>;

    // Validate token type
    if (decoded.type !== type) {
      throw new TokenValidationError('Invalid token type');
    }

    // Validate required claims
    if (!decoded.userId || !decoded.iat || !decoded.exp) {
      throw new TokenValidationError('Invalid token claims');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenValidationError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new TokenValidationError('Invalid token signature');
    }
    throw error;
  }
}

/**
 * Generates new access token using valid refresh token
 * @param refreshToken - Valid refresh token
 * @returns Promise resolving to new token pair
 * @throws TokenValidationError if refresh token is invalid
 */
export async function refreshAccessToken(refreshToken: string): Promise<IAuthTokens> {
  try {
    // Verify refresh token
    const decoded = await verifyToken(refreshToken, TokenType.REFRESH);

    // Generate new token pair
    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    // Check if refresh token is nearing expiry (less than 24 hours)
    const refreshExp = decoded.exp * 1000; // Convert to milliseconds
    const refreshThreshold = Date.now() + (24 * 60 * 60 * 1000);

    if (refreshExp < refreshThreshold) {
      // Generate completely new token pair if refresh token is nearing expiry
      return generateTokens(payload);
    }

    // Generate only new access token if refresh token is still valid for long
    const accessToken = jwt.sign(
      {
        ...payload,
        type: TokenType.ACCESS,
        iss: authConfig.jwt.issuer,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_ACCESS_SECRET,
      {
        algorithm: 'RS256',
        expiresIn: authConfig.tokens.access.expiresIn
      }
    );

    return {
      accessToken,
      refreshToken, // Return existing refresh token
      expiresIn: authConfig.tokens.access.expiresIn,
      tokenType: 'Bearer'
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new TokenValidationError('Failed to refresh access token');
  }
}