import dotenv from 'dotenv'; // ^16.0.0

// Load environment variables
dotenv.config();

// Port range constants
const MIN_PORT = 1024;
const MAX_PORT = 65535;

// Timing constants (in milliseconds)
const MIN_HEARTBEAT = 5000;
const MAX_HEARTBEAT = 60000;
const MIN_PING_TIMEOUT = 1000;
const MAX_PING_TIMEOUT = 60000;

// Client limits
const MIN_CLIENTS = 1;
const MAX_CLIENTS = 100;

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const WS_PORT = process.env.WS_PORT || 3001;
const WS_PATH = process.env.WS_PATH || '/ws';
const WS_HEARTBEAT_INTERVAL = process.env.WS_HEARTBEAT_INTERVAL || 30000;
const WS_MAX_CLIENTS = process.env.WS_MAX_CLIENTS || 25;
const WS_PING_TIMEOUT = process.env.WS_PING_TIMEOUT || 5000;

/**
 * Interface defining WebSocket server configuration options with strict validation requirements
 */
export interface WebSocketConfig {
  readonly port: number;
  readonly path: string;
  readonly heartbeatInterval: number;
  readonly maxClientsPerWorkspace: number;
  readonly pingTimeout: number;
  readonly clientTracking: boolean;
  readonly secure: boolean;
}

/**
 * Validates WebSocket configuration values with comprehensive error checking
 * @param config WebSocket configuration object to validate
 * @returns true if configuration is valid, throws detailed error if invalid
 * @throws Error with detailed message if validation fails
 */
export function validateWebSocketConfig(config: WebSocketConfig): boolean {
  // Validate port number
  if (!Number.isInteger(config.port) || config.port < MIN_PORT || config.port > MAX_PORT) {
    throw new Error(
      `Invalid WebSocket port: ${config.port}. Must be an integer between ${MIN_PORT} and ${MAX_PORT}`
    );
  }

  // Validate WebSocket path
  if (!config.path.startsWith('/') || /[.]{2}/.test(config.path)) {
    throw new Error(
      'Invalid WebSocket path. Must start with "/" and cannot contain path traversal characters'
    );
  }

  // Validate heartbeat interval
  if (
    !Number.isInteger(config.heartbeatInterval) ||
    config.heartbeatInterval < MIN_HEARTBEAT ||
    config.heartbeatInterval > MAX_HEARTBEAT
  ) {
    throw new Error(
      `Invalid heartbeat interval: ${config.heartbeatInterval}. Must be between ${MIN_HEARTBEAT} and ${MAX_HEARTBEAT} ms`
    );
  }

  // Validate max clients per workspace
  if (
    !Number.isInteger(config.maxClientsPerWorkspace) ||
    config.maxClientsPerWorkspace < MIN_CLIENTS ||
    config.maxClientsPerWorkspace > MAX_CLIENTS
  ) {
    throw new Error(
      `Invalid max clients per workspace: ${config.maxClientsPerWorkspace}. Must be between ${MIN_CLIENTS} and ${MAX_CLIENTS}`
    );
  }

  // Validate ping timeout
  if (
    !Number.isInteger(config.pingTimeout) ||
    config.pingTimeout < MIN_PING_TIMEOUT ||
    config.pingTimeout > MAX_PING_TIMEOUT
  ) {
    throw new Error(
      `Invalid ping timeout: ${config.pingTimeout}. Must be between ${MIN_PING_TIMEOUT} and ${MAX_PING_TIMEOUT} ms`
    );
  }

  // Validate client tracking flag
  if (typeof config.clientTracking !== 'boolean') {
    throw new Error('Client tracking must be a boolean value');
  }

  // Validate secure flag matches environment
  if (NODE_ENV === 'production' && !config.secure) {
    throw new Error('Secure WebSocket connections are required in production environment');
  }

  return true;
}

/**
 * WebSocket server configuration with security and performance optimizations
 */
export const websocketConfig: WebSocketConfig = {
  port: Number(WS_PORT),
  path: WS_PATH,
  heartbeatInterval: Number(WS_HEARTBEAT_INTERVAL),
  maxClientsPerWorkspace: Number(WS_MAX_CLIENTS),
  pingTimeout: Number(WS_PING_TIMEOUT),
  clientTracking: true,
  secure: NODE_ENV === 'production'
};

// Validate configuration on initialization
validateWebSocketConfig(websocketConfig);

export default websocketConfig;