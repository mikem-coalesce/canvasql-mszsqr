import request from 'supertest';
import { expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import app from '../../src/app';
import { AuthService } from '../../src/services/auth.service';
import { CacheService } from '../../src/services/cache.service';
import prisma from '../../src/config/database.config';

// Test user data
const testUser = {
  email: 'test@example.com',
  password: 'Password123!',
  name: 'Test User',
  mfaEnabled: false
};

const testMFAUser = {
  email: 'mfa@example.com',
  password: 'Password123!',
  name: 'MFA Test User',
  mfaEnabled: true,
  mfaSecret: 'JBSWY3DPEHPK3PXP'
};

describe('Authentication Integration Tests', () => {
  let authService: AuthService;
  let cacheService: CacheService;

  beforeAll(async () => {
    // Initialize services
    authService = new AuthService();
    cacheService = new CacheService();

    // Apply database migrations
    await prisma.$executeRaw`SELECT 1`;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany();
    await prisma.auditLog.deleteMany();
    await cacheService.flushAll();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Registration', () => {
    it('should successfully register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Registration successful');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('role');
      expect(response.body.user).toHaveProperty('mfaEnabled', false);

      // Verify user in database
      const user = await prisma.user.findUnique({
        where: { email: testUser.email }
      });
      expect(user).toBeTruthy();
      expect(user!.password).not.toBe(testUser.password);

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: { userId: user!.id, eventType: 'user_registered' }
      });
      expect(auditLog).toBeTruthy();
    });

    it('should enforce password complexity requirements', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: 'weak',
          name: testUser.name
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toHaveProperty('password');
    });

    it('should prevent duplicate email registration', async () => {
      // Register first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name
        });

      // Attempt duplicate registration
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already registered');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create test user
      await authService.register({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name
      });
    });

    it('should successfully login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('tokenType', 'Bearer');

      // Verify refresh token cookie
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('refreshToken');

      // Verify session in Redis
      const session = await cacheService.getSession(response.body.accessToken);
      expect(session).toBeTruthy();
    });

    it('should handle MFA authentication flow', async () => {
      // Create MFA-enabled user
      await authService.register({
        email: testMFAUser.email,
        password: testMFAUser.password,
        name: testMFAUser.name
      });
      await authService.setupMFA(testMFAUser.email, testMFAUser.mfaSecret);

      // Login without MFA token
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testMFAUser.email,
          password: testMFAUser.password
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('MFA token required');

      // Login with valid MFA token
      const token = authenticator.generate(testMFAUser.mfaSecret);
      const mfaResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testMFAUser.email,
          password: testMFAUser.password,
          mfaToken: token
        });

      expect(mfaResponse.status).toBe(200);
      expect(mfaResponse.body).toHaveProperty('accessToken');
    });

    it('should enforce rate limiting on failed login attempts', async () => {
      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'wrong_password'
          });
      }

      // Attempt login with correct credentials
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Too many login attempts');
    });
  });

  describe('Session Management', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login test user
      await authService.register({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = response.body.accessToken;
      refreshToken = response.headers['set-cookie'][0]
        .split(';')[0]
        .split('=')[1];
    });

    it('should validate active sessions', async () => {
      const response = await request(app)
        .get('/api/v1/auth/validate-session')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body.session).toHaveProperty('userId');
      expect(response.body.session).toHaveProperty('role');
    });

    it('should refresh access tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).not.toBe(accessToken);
    });

    it('should handle logout and session cleanup', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(response.status).toBe(200);

      // Verify session cleanup
      const session = await cacheService.getSession(accessToken);
      expect(session).toBeNull();

      // Verify refresh token invalidation
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(refreshResponse.status).toBe(401);
    });
  });
});