import { Request, Response } from 'express'; // ^4.18.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import { createLogger } from 'winston'; // ^3.8.0
import { AuthService } from '../../services/auth.service';
import { validateLoginCredentials, validateRegistration } from '../validators/auth.validator';
import { AuthError } from '../../core/errors/AuthError';
import { IAuthTokens, IAuthUser } from '../../core/interfaces/auth.interface';
import redis from '../../config/redis.config';

/**
 * Controller handling authentication endpoints with comprehensive security measures
 * Implements rate limiting, secure session management, and security monitoring
 */
export class AuthController {
  private readonly authService: AuthService;
  private readonly rateLimiter: RateLimiterRedis;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: process.env.COOKIE_DOMAIN,
    path: '/'
  };

  constructor() {
    this.authService = new AuthService();
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiterRedis({
      storeClient: redis.client,
      keyPrefix: 'rate_limit_auth:',
      points: 5, // Number of attempts
      duration: 60 * 15, // Per 15 minutes
      blockDuration: 60 * 15 // Block for 15 minutes
    });

    // Initialize security logger
    this.logger = createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'auth-controller' },
      transports: [
        new winston.transports.File({ filename: 'logs/auth-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/auth.log' })
      ]
    });
  }

  /**
   * Handles user registration with security measures and MFA setup
   * @param req Express request object
   * @param res Express response object
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      // Rate limiting check
      await this.checkRateLimit(req);

      // Validate registration data
      const validatedData = await validateRegistration(req.body);

      // Log registration attempt
      this.logger.info('Registration attempt', {
        email: validatedData.email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Register user
      const user: IAuthUser = await this.authService.register(validatedData);

      // Log successful registration
      this.logger.info('Registration successful', {
        userId: user.id,
        email: user.email
      });

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          mfaEnabled: user.mfaEnabled
        }
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Handles user login with MFA validation and secure session management
   * @param req Express request object
   * @param res Express response object
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      // Rate limiting check
      await this.checkRateLimit(req);

      // Validate login credentials
      const validatedData = await validateLoginCredentials(req.body);

      // Log login attempt
      this.logger.info('Login attempt', {
        email: validatedData.email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Authenticate user
      const tokens: IAuthTokens = await this.authService.login(validatedData);

      // Set secure refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, this.cookieOptions);

      // Log successful login
      this.logger.info('Login successful', {
        email: validatedData.email,
        ip: req.ip
      });

      res.status(200).json({
        message: 'Login successful',
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Handles user logout and session termination
   * @param req Express request object
   * @param res Express response object
   */
  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        // Invalidate session
        await this.authService.logout(refreshToken);
        
        // Clear refresh token cookie
        res.clearCookie('refreshToken', this.cookieOptions);
      }

      // Log logout
      this.logger.info('Logout successful', {
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Refreshes access token using valid refresh token
   * @param req Express request object
   * @param res Express response object
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        throw AuthError.unauthorized('Refresh token not provided');
      }

      // Generate new token pair
      const tokens = await this.authService.refreshToken(refreshToken);

      // Set new refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, this.cookieOptions);

      res.status(200).json({
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Validates current session and token
   * @param req Express request object
   * @param res Express response object
   */
  public validateSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (!accessToken) {
        throw AuthError.unauthorized('Access token not provided');
      }

      // Validate session
      const session = await this.authService.validateSession(accessToken);

      res.status(200).json({
        valid: true,
        session: {
          userId: session.userId,
          role: session.role,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      this.handleError(error, req, res);
    }
  };

  /**
   * Checks rate limiting for the request
   * @param req Express request object
   */
  private async checkRateLimit(req: Request): Promise<void> {
    try {
      await this.rateLimiter.consume(req.ip);
    } catch (error) {
      this.logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      throw AuthError.unauthorized('Too many requests. Please try again later.');
    }
  }

  /**
   * Handles and logs errors with appropriate responses
   * @param error Error instance
   * @param req Express request object
   * @param res Express response object
   */
  private handleError(error: any, req: Request, res: Response): void {
    // Log error with context
    this.logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path
    });

    // Handle known error types
    if (error instanceof AuthError) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }

    // Handle unexpected errors
    res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}