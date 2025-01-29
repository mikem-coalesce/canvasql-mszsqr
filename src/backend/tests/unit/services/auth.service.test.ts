import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { Redis } from 'redis';
import { AuthService } from '../../src/services/auth.service';
import { AuthError } from '../../../core/errors/AuthError';
import { UserRole, TokenType } from '../../../core/types/auth.types';
import { IAuthCredentials, IAuthUser, IAuthTokens } from '../../../core/interfaces/auth.interface';
import { PrismaClient } from '@prisma/client';
import { CacheService } from '../../../services/cache.service';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../../services/cache.service');
jest.mock('otplib');

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockCacheService: jest.Mocked<CacheService>;

  // Test data
  const testUser: IAuthUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: UserRole.VIEWER,
    mfaEnabled: false,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const testCredentials: IAuthCredentials = {
    email: 'test@example.com',
    password: 'Test@123!',
    mfaToken: '123456'
  };

  const testTokens: IAuthTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Initialize mocked services
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      securityLog: {
        create: jest.fn()
      }
    } as unknown as jest.Mocked<PrismaClient>;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      setHash: jest.fn()
    } as unknown as jest.Mocked<CacheService>;

    // Initialize AuthService with mocked dependencies
    authService = new AuthService();
    (authService as any).prisma = mockPrisma;
    (authService as any).cacheService = mockCacheService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...testUser, password: 'hashed' });

      // Execute
      const result = await authService.register(testCredentials);

      // Assert
      expect(result).toEqual(testUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: testCredentials.email }
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.securityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'user_registered'
        })
      });
    });

    it('should throw error for existing email', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      // Execute & Assert
      await expect(authService.register(testCredentials))
        .rejects
        .toThrow(AuthError);
    });

    it('should throw error for invalid email format', async () => {
      // Execute & Assert
      await expect(authService.register({ ...testCredentials, email: 'invalid' }))
        .rejects
        .toThrow('Invalid email format');
    });

    it('should throw error for weak password', async () => {
      // Execute & Assert
      await expect(authService.register({ ...testCredentials, password: 'weak' }))
        .rejects
        .toThrow('Password does not meet security requirements');
    });
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue({ ...testUser, password: 'hashed' });
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue();

      // Execute
      const result = await authService.login(testCredentials);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockPrisma.securityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'user_login'
        })
      });
    });

    it('should throw error for invalid credentials', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Execute & Assert
      await expect(authService.login(testCredentials))
        .rejects
        .toThrow('Invalid credentials');
    });

    it('should handle MFA validation', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        password: 'hashed',
        mfaEnabled: true,
        mfaSecret: 'secret'
      });

      // Execute & Assert
      await expect(authService.login({ ...testCredentials, mfaToken: undefined }))
        .rejects
        .toThrow('MFA token required');
    });

    it('should enforce rate limiting', async () => {
      // Setup
      mockCacheService.get.mockResolvedValue(5); // Max attempts reached

      // Execute & Assert
      await expect(authService.login(testCredentials))
        .rejects
        .toThrow('Too many login attempts');
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      // Setup
      const session = {
        userId: testUser.id,
        role: testUser.role,
        expiresAt: Date.now() + 3600000
      };
      mockCacheService.get.mockResolvedValue(session);

      // Execute
      const result = await authService.validateSession('valid-token');

      // Assert
      expect(result).toBeTruthy();
      expect(result.userId).toBe(testUser.id);
    });

    it('should throw error for expired session', async () => {
      // Setup
      const session = {
        userId: testUser.id,
        role: testUser.role,
        expiresAt: Date.now() - 1000
      };
      mockCacheService.get.mockResolvedValue(session);

      // Execute & Assert
      await expect(authService.validateSession('expired-token'))
        .rejects
        .toThrow('Session expired');
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid token', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue(testUser);

      // Execute
      const result = await authService.refreshToken('valid-refresh-token');

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      // Execute & Assert
      await expect(authService.refreshToken('invalid-token'))
        .rejects
        .toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      // Setup
      mockCacheService.get.mockResolvedValue({
        userId: testUser.id,
        role: testUser.role
      });

      // Execute
      await authService.logout('valid-token');

      // Assert
      expect(mockPrisma.securityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'user_logout'
        })
      });
    });

    it('should handle invalid session logout', async () => {
      // Setup
      mockCacheService.get.mockResolvedValue(null);

      // Execute & Assert
      await expect(authService.logout('invalid-token'))
        .rejects
        .toThrow('Invalid session');
    });
  });

  describe('security monitoring', () => {
    it('should track failed login attempts', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Execute
      await expect(authService.login(testCredentials)).rejects.toThrow();

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should log security events', async () => {
      // Setup
      mockPrisma.user.findUnique.mockResolvedValue({ ...testUser, password: 'hashed' });

      // Execute
      await authService.login(testCredentials);

      // Assert
      expect(mockPrisma.securityLog.create).toHaveBeenCalled();
    });
  });
});