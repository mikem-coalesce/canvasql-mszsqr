import { PrismaClient } from '@prisma/client'; // ^5.0.0
import { authenticator } from 'otplib'; // ^12.0.1
import { IAuthUser, IAuthCredentials, IAuthTokens, IAuthSession } from '../core/interfaces/auth.interface';
import { AuthError } from '../core/errors/AuthError';
import { hashPassword, verifyPassword } from '../core/utils/encryption.util';
import { generateTokens, verifyToken } from '../core/utils/token.util';
import { CacheService } from './cache.service';
import { TokenType, UserRole } from '../core/types/auth.types';

/**
 * Service implementing secure authentication and authorization functionality
 * with MFA support, security monitoring, and comprehensive session management
 */
export class AuthService {
  private readonly prisma: PrismaClient;
  private readonly cacheService: CacheService;
  private readonly sessionPrefix = 'session:';
  private readonly rateLimitPrefix = 'ratelimit:';
  private readonly maxLoginAttempts = 5;
  private readonly loginLockoutTime = 900; // 15 minutes in seconds

  constructor() {
    this.prisma = new PrismaClient();
    this.cacheService = new CacheService();
    authenticator.options = { 
      window: 1,
      step: 30 
    };
  }

  /**
   * Registers a new user with enhanced security features
   * @param credentials User registration credentials
   * @returns Created user data
   * @throws AuthError if validation fails or user exists
   */
  public async register(credentials: IAuthCredentials): Promise<IAuthUser> {
    try {
      // Validate email format
      if (!this.validateEmail(credentials.email)) {
        throw AuthError.badRequest('Invalid email format');
      }

      // Validate password strength
      if (!this.validatePasswordStrength(credentials.password)) {
        throw AuthError.badRequest('Password does not meet security requirements');
      }

      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: credentials.email }
      });

      if (existingUser) {
        throw AuthError.badRequest('Email already registered');
      }

      // Hash password with Argon2id
      const hashedPassword = await hashPassword(credentials.password);

      // Generate MFA secret
      const mfaSecret = authenticator.generateSecret();

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: credentials.email,
          password: hashedPassword,
          role: UserRole.VIEWER, // Default role
          mfaEnabled: false,
          mfaSecret,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Log security event
      await this.logSecurityEvent('user_registered', {
        userId: user.id,
        email: user.email
      });

      // Return user data without sensitive fields
      return {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        mfaEnabled: user.mfaEnabled,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw AuthError.internalServer('Registration failed');
    }
  }

  /**
   * Authenticates user with MFA support and security monitoring
   * @param credentials Login credentials with optional MFA token
   * @returns JWT token pair
   * @throws AuthError for invalid credentials or MFA
   */
  public async login(credentials: IAuthCredentials): Promise<IAuthTokens> {
    try {
      // Check rate limiting
      await this.checkLoginRateLimit(credentials.email);

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: credentials.email }
      });

      if (!user) {
        await this.incrementLoginAttempts(credentials.email);
        throw AuthError.unauthorized('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await verifyPassword(
        credentials.password,
        user.password
      );

      if (!isValidPassword) {
        await this.incrementLoginAttempts(credentials.email);
        throw AuthError.unauthorized('Invalid credentials');
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!credentials.mfaToken) {
          throw AuthError.unauthorized('MFA token required');
        }

        const isValidMfa = authenticator.verify({
          token: credentials.mfaToken,
          secret: user.mfaSecret
        });

        if (!isValidMfa) {
          await this.incrementLoginAttempts(credentials.email);
          throw AuthError.unauthorized('Invalid MFA token');
        }
      }

      // Generate tokens
      const tokens = await generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      // Create session
      const session: IAuthSession = {
        userId: user.id,
        role: user.role as UserRole,
        expiresAt: Date.now() + (3600 * 1000), // 1 hour
        lastActivityAt: Date.now()
      };

      // Store session in Redis
      await this.cacheService.set(
        `${this.sessionPrefix}${tokens.accessToken}`,
        session,
        3600 // 1 hour TTL
      );

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Log security event
      await this.logSecurityEvent('user_login', {
        userId: user.id,
        email: user.email,
        mfaUsed: user.mfaEnabled
      });

      return tokens;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw AuthError.internalServer('Login failed');
    }
  }

  /**
   * Validates and refreshes session token
   * @param refreshToken Valid refresh token
   * @returns New token pair
   * @throws AuthError for invalid or expired token
   */
  public async refreshToken(refreshToken: string): Promise<IAuthTokens> {
    try {
      const decoded = await verifyToken(refreshToken, TokenType.REFRESH);
      
      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw AuthError.unauthorized('User not found');
      }

      // Generate new tokens
      return generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role
      });
    } catch (error) {
      throw AuthError.unauthorized('Invalid refresh token');
    }
  }

  /**
   * Validates email format
   * @param email Email to validate
   * @returns True if valid
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates password strength
   * @param password Password to validate
   * @returns True if meets requirements
   */
  private validatePasswordStrength(password: string): boolean {
    // Minimum 8 characters, at least one uppercase, lowercase, number and special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  /**
   * Checks login rate limiting
   * @param email User email
   * @throws AuthError if rate limit exceeded
   */
  private async checkLoginRateLimit(email: string): Promise<void> {
    const attempts = await this.cacheService.get<number>(
      `${this.rateLimitPrefix}${email}`
    );

    if (attempts && attempts >= this.maxLoginAttempts) {
      throw AuthError.unauthorized('Too many login attempts. Try again later.');
    }
  }

  /**
   * Increments failed login attempts
   * @param email User email
   */
  private async incrementLoginAttempts(email: string): Promise<void> {
    const key = `${this.rateLimitPrefix}${email}`;
    const attempts = await this.cacheService.get<number>(key) || 0;
    
    await this.cacheService.set(
      key,
      attempts + 1,
      this.loginLockoutTime
    );
  }

  /**
   * Logs security events for monitoring
   * @param eventType Type of security event
   * @param data Event data
   */
  private async logSecurityEvent(
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    await this.prisma.securityLog.create({
      data: {
        eventType,
        data,
        timestamp: new Date()
      }
    });
  }
}