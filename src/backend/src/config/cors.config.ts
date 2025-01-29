import { CorsOptions } from 'cors';

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

/**
 * Interface defining strict CORS configuration options
 * @interface CorsConfig
 */
interface CorsConfig extends CorsOptions {
  origin: string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Returns environment-specific CORS configuration with strict security controls
 * @function getCorsConfig
 * @returns {CorsOptions} CORS configuration object with environment-specific settings
 * @version 1.0.0
 */
const getCorsConfig = (): CorsOptions => {
  // Base configuration with strict security controls
  const config: CorsConfig = {
    // Strict origin validation based on environment
    origin: NODE_ENV === 'production' 
      ? ALLOWED_ORIGINS // Whitelist specific origins in production
      : true, // Allow all origins in development for ease of local testing

    // Restrict allowed HTTP methods
    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS'
    ],

    // Define allowed headers with security considerations
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token'
    ],

    // Set exposed headers for security requirements
    exposedHeaders: [
      'Content-Length',
      'X-CSRF-Token'
    ],

    // Enable credentials for authenticated requests
    credentials: true,

    // Optimal preflight request cache duration (1 hour)
    maxAge: 3600,

    // Prevent preflight requests for requests with credentials
    preflightContinue: false,

    // Return 204 No Content for OPTIONS requests
    optionsSuccessStatus: 204
  };

  // Additional security controls for production environment
  if (NODE_ENV === 'production') {
    // Validate origins against whitelist
    config.origin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    };
  }

  return config;
};

export default getCorsConfig;