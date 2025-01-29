import { Socket } from 'socket.io';
import { Redis } from 'ioredis';
import winston from 'winston';
import { AuthError } from '../../core/errors/AuthError';
import { verifyToken } from '../../core/utils/token.util';
import { IAuthUser, UserRole } from '../../core/interfaces/auth.interface';
import { TokenType } from '../../core/types/auth.types';

// Initialize Redis client for session management
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
});

// Initialize logger for security monitoring
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'websocket-auth' },
  transports: [
    new winston.transports.File({ filename: 'logs/websocket-auth.log' })
  ]
});

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_CONNECTIONS_PER_WINDOW = 100;

// Session configuration
const SESSION_PREFIX = 'ws:session:';
const SESSION_TTL = 3600; // 1 hour in seconds

/**
 * WebSocket authentication middleware
 * Validates JWT tokens and manages user sessions with Redis backing
 */
export const authenticateWebSocket = async (socket: Socket, next: Function): Promise<void> => {
  try {
    // Extract token from handshake auth or query
    const token = extractToken(socket);
    if (!token) {
      throw AuthError.invalidToken('Authentication token is required');
    }

    // Check rate limiting
    const clientId = getClientIdentifier(socket);
    await enforceRateLimit(clientId);

    // Verify JWT token
    const decodedToken = await verifyToken(token, TokenType.ACCESS);
    
    // Validate user data from token
    const user: IAuthUser = validateUserData(decodedToken);

    // Check and update session in Redis
    await validateAndUpdateSession(socket, user);

    // Attach user data to socket
    socket.data.user = user;

    // Set up connection monitoring
    setupConnectionMonitoring(socket);

    // Log successful authentication
    logger.info('WebSocket authentication successful', {
      userId: user.id,
      role: user.role,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });

    next();
  } catch (error) {
    handleAuthError(socket, error);
    next(error);
  }
};

/**
 * Extracts JWT token from socket handshake
 */
const extractToken = (socket: Socket): string | null => {
  const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!authHeader) {
    return socket.handshake.query?.token as string;
  }
  return authHeader.replace('Bearer ', '');
};

/**
 * Generates unique client identifier for rate limiting
 */
const getClientIdentifier = (socket: Socket): string => {
  return `${socket.handshake.address}:${socket.handshake.headers['user-agent']}`;
};

/**
 * Enforces connection rate limiting using Redis
 */
const enforceRateLimit = async (clientId: string): Promise<void> => {
  const key = `ratelimit:${clientId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW / 1000);
  }
  
  if (count > MAX_CONNECTIONS_PER_WINDOW) {
    throw AuthError.rateLimitExceeded('Connection rate limit exceeded');
  }
};

/**
 * Validates user data from decoded token
 */
const validateUserData = (decodedToken: any): IAuthUser => {
  if (!decodedToken.id || !decodedToken.role || !Object.values(UserRole).includes(decodedToken.role)) {
    throw AuthError.invalidToken('Invalid user data in token');
  }
  
  return {
    id: decodedToken.id,
    email: decodedToken.email,
    role: decodedToken.role,
    workspaceId: decodedToken.workspaceId,
    mfaEnabled: decodedToken.mfaEnabled || false,
    lastLoginAt: new Date(decodedToken.lastLoginAt),
    createdAt: new Date(decodedToken.createdAt),
    updatedAt: new Date(decodedToken.updatedAt)
  };
};

/**
 * Validates and updates user session in Redis
 */
const validateAndUpdateSession = async (socket: Socket, user: IAuthUser): Promise<void> => {
  const sessionKey = `${SESSION_PREFIX}${user.id}`;
  const sessionData = {
    userId: user.id,
    role: user.role,
    socketId: socket.id,
    ip: socket.handshake.address,
    userAgent: socket.handshake.headers['user-agent'],
    lastActivity: Date.now()
  };

  await redis.set(sessionKey, JSON.stringify(sessionData), 'EX', SESSION_TTL);
};

/**
 * Sets up connection monitoring and activity tracking
 */
const setupConnectionMonitoring = (socket: Socket): void => {
  const userId = socket.data.user.id;
  const sessionKey = `${SESSION_PREFIX}${userId}`;

  // Update last activity on ping
  socket.on('ping', async () => {
    await redis.expire(sessionKey, SESSION_TTL);
  });

  // Clean up on disconnect
  socket.on('disconnect', async () => {
    await redis.del(sessionKey);
    logger.info('WebSocket connection closed', {
      userId,
      reason: socket.disconnectReason
    });
  });
};

/**
 * Handles authentication errors with appropriate logging
 */
const handleAuthError = (socket: Socket, error: any): void => {
  const errorDetails = {
    ip: socket.handshake.address,
    userAgent: socket.handshake.headers['user-agent'],
    timestamp: new Date().toISOString()
  };

  logger.error('WebSocket authentication failed', {
    ...errorDetails,
    error: error.message,
    stack: error.stack
  });

  socket.disconnect(true);
};

export default authenticateWebSocket;