/**
 * Authentication and authorization configuration using Auth.js
 * Implements JWT tokens with RS256 signing and secure session management
 * @version 1.0.0
 */

import { AuthOptions } from 'next-auth';
import { TokenType } from '../core/types/auth.types';
import crypto from 'crypto';

// Required environment variables for JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 
  (() => { throw new Error('JWT_SECRET is required') })();

const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || 
  (() => { throw new Error('JWT_PRIVATE_KEY is required') })();

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || 
  (() => { throw new Error('JWT_PUBLIC_KEY is required') })();

// Token expiration times in seconds
const ACCESS_TOKEN_EXPIRY = 3600;        // 1 hour
const REFRESH_TOKEN_EXPIRY = 604800;     // 7 days
const SESSION_UPDATE_AGE = 300;          // 5 minutes

/**
 * Comprehensive Auth.js configuration with JWT tokens and secure sessions
 * Implements RS256 signing algorithm and Redis-based session management
 */
export const authConfig: AuthOptions = {
  // JWT Configuration
  jwt: {
    secret: JWT_SECRET,
    signingKey: JWT_PRIVATE_KEY,
    verificationKey: JWT_PUBLIC_KEY,
    // RS256 signing options for enhanced security
    signingOptions: {
      algorithm: 'RS256',
      expiresIn: ACCESS_TOKEN_EXPIRY
    },
    // Token verification settings with clock tolerance
    verificationOptions: {
      algorithms: ['RS256'],
      ignoreExpiration: false,
      clockTolerance: 30 // 30 seconds tolerance for clock skew
    }
  },

  // Session Configuration
  session: {
    strategy: 'jwt',
    maxAge: ACCESS_TOKEN_EXPIRY,
    updateAge: SESSION_UPDATE_AGE,
    // Generate cryptographically secure session tokens
    generateSessionToken: () => crypto.randomBytes(32).toString('hex')
  },

  // Token Configuration
  tokens: {
    // Short-lived access tokens
    access: {
      type: TokenType.ACCESS,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      algorithm: 'RS256'
    },
    // Long-lived refresh tokens
    refresh: {
      type: TokenType.REFRESH,
      expiresIn: REFRESH_TOKEN_EXPIRY,
      algorithm: 'RS256'
    }
  },

  // Cookie Configuration
  cookies: {
    // Session token cookie settings
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        maxAge: ACCESS_TOKEN_EXPIRY,
        domain: process.env.COOKIE_DOMAIN
      }
    },
    // Callback URL cookie settings
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    },
    // CSRF token cookie settings
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    }
  },

  // Additional security headers
  debug: process.env.NODE_ENV === 'development',
  secret: JWT_SECRET,
  useSecureCookies: true,
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error'
  }
};

export default authConfig;