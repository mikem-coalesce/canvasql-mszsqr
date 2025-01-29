import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig({
  // Configure plugins for React and TypeScript path resolution
  plugins: [
    react({
      // Enable Fast Refresh for React components
      fastRefresh: true,
    }),
    tsconfigPaths(),
  ],

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all network interfaces
    proxy: {
      // Proxy API requests to backend server
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Proxy WebSocket connections for real-time collaboration
      '/ws': {
        target: 'ws://localhost:4001',
        ws: true,
      },
    },
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
    chunkSizeWarningLimit: 1000, // Increase chunk size warning limit
    rollupOptions: {
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: {
          // Core React dependencies
          'react-vendor': ['react', 'react-dom'],
          // React Flow visualization library
          'reactflow-vendor': ['reactflow'],
          // Y.js collaboration libraries
          'yjs-vendor': ['yjs', 'y-websocket'],
        },
      },
    },
  },

  // Path resolution configuration
  resolve: {
    alias: {
      // Path aliases matching tsconfig.json configuration
      '@': '/src',
      '@components': '/src/components',
      '@hooks': '/src/hooks',
      '@store': '/src/store',
      '@services': '/src/services',
      '@utils': '/src/utils',
      '@types': '/src/types',
      '@styles': '/src/styles',
    },
  },

  // Enable type checking during development
  optimizeDeps: {
    include: ['react', 'react-dom', 'reactflow', 'yjs', 'y-websocket'],
  },

  // CSS configuration
  css: {
    devSourcemap: true, // Enable CSS source maps
  },

  // Enable detailed build analysis in production
  build: {
    reportCompressedSize: true,
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
      },
    },
  },
});