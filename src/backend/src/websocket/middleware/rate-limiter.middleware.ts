import { WebSocket } from 'ws'; // ^8.0.0
import { IncomingMessage } from 'http';
import { APIError } from '../../core/errors/APIError';
import { CacheService } from '../../services/cache.service';
import { websocketConfig } from '../../config/websocket.config';

// Constants for rate limiting and connection tracking
const RATE_LIMIT_PREFIX = 'ws:ratelimit:';
const WORKSPACE_CONNECTION_PREFIX = 'ws:workspace:connections:';
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const ERROR_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 5000;
const CLEANUP_INTERVAL = 60000;

/**
 * Configuration options for rate limiting with sliding window
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  backoffMultiplier: number;
  errorThreshold: number;
}

/**
 * Rate limit tracking information with sliding window data
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
  windowStart: number;
  violations: number;
  backoffUntil: number;
}

/**
 * Tracks concurrent connections per workspace
 */
interface WorkspaceConnectionInfo {
  connectionCount: number;
  userIds: Set<string>;
  lastUpdated: number;
}

const cacheService = new CacheService();

/**
 * Generates sanitized cache keys for rate limiting
 */
function generateRateLimitKey(userId: string, workspaceId: string, connectionType: string): string {
  const sanitizedUserId = encodeURIComponent(userId);
  const sanitizedWorkspaceId = encodeURIComponent(workspaceId);
  return `${RATE_LIMIT_PREFIX}${sanitizedUserId}:${sanitizedWorkspaceId}:${connectionType}`;
}

/**
 * Handles proper cleanup of rate limit data on connection close
 */
async function cleanupRateLimit(userId: string, workspaceId: string): Promise<void> {
  try {
    const workspaceKey = `${WORKSPACE_CONNECTION_PREFIX}${workspaceId}`;
    const pipeline = cacheService.pipeline();

    // Get current workspace connection info
    const workspaceInfo: WorkspaceConnectionInfo | null = await cacheService.get(workspaceKey);
    
    if (workspaceInfo) {
      workspaceInfo.connectionCount = Math.max(0, workspaceInfo.connectionCount - 1);
      workspaceInfo.userIds.delete(userId);
      workspaceInfo.lastUpdated = Date.now();

      if (workspaceInfo.connectionCount === 0) {
        pipeline.del(workspaceKey);
      } else {
        pipeline.set(workspaceKey, workspaceInfo, CLEANUP_INTERVAL / 1000);
      }
    }

    await pipeline.exec();
  } catch (error) {
    console.error('[RateLimiter] Cleanup error:', error);
  }
}

/**
 * WebSocket middleware implementing sliding window rate limiting and concurrent connection tracking
 */
export default async function rateLimiterMiddleware(
  ws: WebSocket,
  req: IncomingMessage
): Promise<void> {
  // Extract user and workspace IDs from authenticated request
  const userId = (req as any).user?.id;
  const workspaceId = (req as any).params?.workspaceId;

  if (!userId || !workspaceId) {
    throw APIError.badRequest('Missing user or workspace identification');
  }

  try {
    const rateLimitKey = generateRateLimitKey(userId, workspaceId, 'ws');
    const workspaceKey = `${WORKSPACE_CONNECTION_PREFIX}${workspaceId}`;
    const now = Date.now();

    // Pipeline Redis operations for performance
    const pipeline = cacheService.pipeline();

    // Check workspace connection limits
    const workspaceInfo: WorkspaceConnectionInfo | null = await cacheService.get(workspaceKey);
    
    if (workspaceInfo) {
      if (workspaceInfo.connectionCount >= websocketConfig.maxClientsPerWorkspace) {
        throw APIError.badRequest('Workspace connection limit exceeded', {
          maxConnections: websocketConfig.maxClientsPerWorkspace
        });
      }
      
      workspaceInfo.connectionCount++;
      workspaceInfo.userIds.add(userId);
      workspaceInfo.lastUpdated = now;
    } else {
      const newWorkspaceInfo: WorkspaceConnectionInfo = {
        connectionCount: 1,
        userIds: new Set([userId]),
        lastUpdated: now
      };
      pipeline.set(workspaceKey, newWorkspaceInfo, CLEANUP_INTERVAL / 1000);
    }

    // Check rate limits with sliding window
    const rateLimitInfo: RateLimitInfo | null = await cacheService.get(rateLimitKey);
    
    if (rateLimitInfo) {
      // Check backoff period
      if (rateLimitInfo.backoffUntil && now < rateLimitInfo.backoffUntil) {
        throw APIError.badRequest('Too many requests, please try again later', {
          retryAfter: Math.ceil((rateLimitInfo.backoffUntil - now) / 1000)
        });
      }

      // Sliding window calculation
      const windowElapsed = now - rateLimitInfo.windowStart;
      const weightedCount = rateLimitInfo.count * (DEFAULT_WINDOW_MS - windowElapsed) / DEFAULT_WINDOW_MS;
      
      if (weightedCount >= DEFAULT_MAX_REQUESTS) {
        rateLimitInfo.violations++;
        
        if (rateLimitInfo.violations >= ERROR_THRESHOLD) {
          rateLimitInfo.backoffUntil = now + (DEFAULT_WINDOW_MS * DEFAULT_BACKOFF_MULTIPLIER);
        }
        
        throw APIError.badRequest('Rate limit exceeded', {
          retryAfter: Math.ceil((rateLimitInfo.resetTime - now) / 1000)
        });
      }

      // Update rate limit info
      rateLimitInfo.count++;
      rateLimitInfo.lastUpdated = now;
      pipeline.set(rateLimitKey, rateLimitInfo, DEFAULT_WINDOW_MS / 1000);
    } else {
      // Initialize new rate limit tracking
      const newRateLimitInfo: RateLimitInfo = {
        count: 1,
        resetTime: now + DEFAULT_WINDOW_MS,
        windowStart: now,
        violations: 0,
        backoffUntil: 0
      };
      pipeline.set(rateLimitKey, newRateLimitInfo, DEFAULT_WINDOW_MS / 1000);
    }

    await pipeline.exec();

    // Set up connection cleanup
    ws.on('close', () => {
      cleanupRateLimit(userId, workspaceId).catch(error => {
        console.error('[RateLimiter] Cleanup error:', error);
      });
    });

  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Handle Redis failures with circuit breaker
    console.error('[RateLimiter] Redis error:', error);
    if (process.env.NODE_ENV === 'production') {
      throw APIError.internalServer('Rate limiting temporarily unavailable');
    }
    // Allow connection in development if Redis fails
    console.warn('[RateLimiter] Bypassing rate limit in development');
  }
}