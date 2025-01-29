import winston from 'winston'; // ^3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.0
import { NODE_ENV } from '../../config';
import APIError from '../errors/APIError';

/**
 * Interface for structured log metadata
 */
interface LogMetadata {
  timestamp: Date;
  level: string;
  service: string;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  source: string;
  environment: string;
}

/**
 * Log levels with numeric priorities
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

/**
 * Color scheme for console output
 */
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

/**
 * File rotation configuration
 */
const LOG_FILE_CONFIG = {
  maxSize: '20m',
  maxFiles: '14d',
  dirname: 'logs',
  datePattern: 'YYYY-MM-DD'
};

/**
 * Sensitive fields that should be masked in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'email',
  'creditCard'
];

/**
 * Masks sensitive data in log messages
 */
const maskSensitiveData = (data: any, fields: string[] = SENSITIVE_FIELDS): any => {
  if (!data) return data;
  
  if (typeof data === 'object') {
    const masked = { ...data };
    for (const key in masked) {
      if (fields.includes(key.toLowerCase())) {
        masked[key] = '********';
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskSensitiveData(masked[key], fields);
      }
    }
    return masked;
  }
  
  return data;
};

/**
 * Formats error objects for logging
 */
const formatError = (error: Error, metadata: Record<string, any> = {}): Record<string, any> => {
  const errorData: Record<string, any> = {
    name: error.name,
    message: error.message,
    ...metadata
  };

  if (error instanceof APIError) {
    errorData.statusCode = error.statusCode;
    errorData.details = error.details;
  }

  if (NODE_ENV === 'development') {
    errorData.stack = error.stack;
  }

  return maskSensitiveData(errorData);
};

/**
 * Creates and configures the Winston logger instance
 */
const createLogger = () => {
  // Configure console transport
  const consoleTransport = new winston.transports.Console({
    level: NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.colorize({ colors: LOG_COLORS }),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        const metaString = Object.keys(metadata).length 
          ? `\n${JSON.stringify(metadata, null, 2)}`
          : '';
        return `${timestamp} [${level}]: ${message}${metaString}`;
      })
    )
  });

  // Configure file transport for production
  const fileTransport = new DailyRotateFile({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    filename: 'application-%DATE%.log',
    ...LOG_FILE_CONFIG
  });

  // Create logger instance
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    transports: [consoleTransport]
  });

  // Add file transport in production
  if (NODE_ENV === 'production') {
    logger.add(fileTransport);
  }

  return logger;
};

/**
 * Singleton logger instance with enhanced functionality
 */
const logger = createLogger();

/**
 * Enhanced logging methods with metadata support
 */
export const enhancedLogger = {
  error: (message: string | Error, metadata: Record<string, any> = {}) => {
    const logData = message instanceof Error
      ? formatError(message, metadata)
      : { message, ...maskSensitiveData(metadata) };
    logger.error(logData);
  },

  warn: (message: string, metadata: Record<string, any> = {}) => {
    logger.warn(message, maskSensitiveData(metadata));
  },

  info: (message: string, metadata: Record<string, any> = {}) => {
    logger.info(message, maskSensitiveData(metadata));
  },

  debug: (message: string, metadata: Record<string, any> = {}) => {
    logger.debug(message, maskSensitiveData(metadata));
  }
};

export default enhancedLogger;