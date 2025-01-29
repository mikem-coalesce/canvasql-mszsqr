/**
 * @fileoverview Integration tests for authentication functionality
 * @version 1.0.0
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import AuthService from '../../src/services/auth.service';
import type {
  AuthUser,
  AuthCredentials,
  AuthTokens,
  AuthSession,
  UserRole,
  MFASetup,
  MFAVerification
} from '../../src/types/auth.types';
import { server } from '../mocks/server';

// Test constants
const TEST_USER: AuthCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

const TEST_MFA = {
  secret: 'TESTSECRET123',
  backupCodes: ['12345678', '87654321']
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000'
};

describe('Authentication Integration Tests', () => {
  let authService: AuthService;

  beforeAll(async () => {
    // Start MSW server and configure security headers
    server.listen({ onUnhandledRequest: 'error' });
    server.use((req, res, ctx) => {
      return res(ctx.set(SECURITY_HEADERS));
    });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // Reset handlers and clear any stored tokens
    server.resetHandlers();
    localStorage.clear();
    authService = new AuthService();
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      const response = await authService.login(TEST_USER);
      
      expect(response).toBeDefined();
      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(response.expiresIn).toBe(3600);
      expect(response.tokenType).toBe('Bearer');
    });

    it('should handle invalid credentials', async () => {
      const invalidUser = { ...TEST_USER, password: 'wrong' };
      
      await expect(authService.login(invalidUser)).rejects.toThrow('Invalid credentials');
    });

    it('should enforce rate limiting', async () => {
      const attempts = Array(6).fill(TEST_USER);
      
      for (const attempt of attempts) {
        try {
          await authService.login(attempt);
        } catch (error) {
          expect(error.message).toBe('Too many requests, please try again later');
          expect(error.response.headers['X-RateLimit-Remaining']).toBe('0');
        }
      }
    });
  });

  describe('MFA Verification', () => {
    it('should require MFA verification when enabled', async () => {
      const loginResponse = await authService.login(TEST_USER);
      
      expect(loginResponse.mfaRequired).toBe(true);
      expect(loginResponse.mfaType).toBe('TOTP');
    });

    it('should complete login after valid MFA verification', async () => {
      const loginResponse = await authService.login(TEST_USER);
      const mfaVerification = await authService.verifyMFA({
        code: '123456',
        type: 'TOTP'
      });

      expect(mfaVerification.success).toBe(true);
      expect(mfaVerification.tokens).toBeDefined();
    });

    it('should handle invalid MFA codes', async () => {
      await authService.login(TEST_USER);
      
      await expect(
        authService.verifyMFA({
          code: 'invalid',
          type: 'TOTP'
        })
      ).rejects.toThrow('Invalid MFA code');
    });
  });

  describe('Session Management', () => {
    it('should maintain session with valid tokens', async () => {
      await authService.login(TEST_USER);
      const user = await authService.getCurrentUser();
      
      expect(user).toBeDefined();
      expect(user.email).toBe(TEST_USER.email);
    });

    it('should handle token refresh', async () => {
      const initialTokens = await authService.login(TEST_USER);
      
      // Simulate token expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const refreshedSession = await authService['refreshAuthSession']();
      
      expect(refreshedSession.tokens.accessToken).not.toBe(initialTokens.accessToken);
      expect(refreshedSession.tokens.refreshToken).not.toBe(initialTokens.refreshToken);
    });

    it('should handle session timeout', async () => {
      await authService.login(TEST_USER);
      
      // Simulate session timeout
      await new Promise(resolve => setTimeout(resolve, 31 * 60 * 1000));
      
      await expect(authService.getCurrentUser()).rejects.toThrow('Session expired');
    });
  });

  describe('Security Features', () => {
    it('should enforce secure headers', async () => {
      const response = await authService.login(TEST_USER);
      
      expect(response.headers).toMatchObject(SECURITY_HEADERS);
    });

    it('should handle CSRF protection', async () => {
      const response = await authService.login(TEST_USER);
      
      expect(response.headers['X-CSRF-Token']).toBeDefined();
    });

    it('should detect suspicious activity', async () => {
      // Simulate multiple failed attempts
      const attempts = Array(3).fill({ ...TEST_USER, password: 'wrong' });
      
      for (const attempt of attempts) {
        try {
          await authService.login(attempt);
        } catch (error) {
          expect(error.response.headers['X-Security-Alert']).toBeDefined();
        }
      }
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout and clear session', async () => {
      await authService.login(TEST_USER);
      await authService.logout();
      
      expect(localStorage.getItem('auth_tokens')).toBeNull();
      await expect(authService.getCurrentUser()).rejects.toThrow('No active session');
    });

    it('should invalidate tokens on logout', async () => {
      const { accessToken } = await authService.login(TEST_USER);
      await authService.logout();
      
      // Attempt to use invalidated token
      await expect(
        authService.getCurrentUser()
      ).rejects.toThrow('Token has been invalidated');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      server.close();
      
      await expect(authService.login(TEST_USER)).rejects.toThrow('Network Error');
    });

    it('should handle server errors with retry mechanism', async () => {
      let attempts = 0;
      server.use((req, res, ctx) => {
        attempts++;
        return attempts < 3 
          ? res(ctx.status(500))
          : res(ctx.json({ tokens: {} }));
      });

      const response = await authService.login(TEST_USER);
      expect(attempts).toBe(3);
      expect(response).toBeDefined();
    });
  });
});