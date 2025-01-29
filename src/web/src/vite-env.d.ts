/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for the ERD Tool's REST API endpoints
   */
  readonly VITE_API_URL: string;

  /**
   * WebSocket server URL for real-time collaboration features
   */
  readonly VITE_WS_URL: string;

  /**
   * Authentication service URL for user management
   */
  readonly VITE_AUTH_URL: string;

  /**
   * Current environment mode ('development' | 'production')
   */
  readonly MODE: string;

  /**
   * Flag indicating development environment
   */
  readonly DEV: boolean;

  /**
   * Flag indicating production environment
   */
  readonly PROD: boolean;

  /**
   * Flag indicating server-side rendering environment
   */
  readonly SSR: boolean;
}

interface ImportMeta {
  /**
   * Type-safe environment variable access
   * @example import.meta.env.VITE_API_URL
   */
  readonly env: ImportMetaEnv;
}

/**
 * Static asset imports type augmentation
 */
declare module '*.svg' {
  import type * as React from 'react';
  const SVGComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default SVGComponent;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}

declare module '*.bmp' {
  const content: string;
  export default content;
}

/**
 * CSS modules type augmentation
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { readonly [key: string]: string };
  export default classes;
}