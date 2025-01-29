import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from 'reactflow';

import App from './App';
import './styles/globals.css';

// Initialize performance monitoring if enabled
if (process.env.ENABLE_MONITORING === 'true') {
  const reportWebVitals = async (metric: any) => {
    console.debug('Performance metric:', metric);
  };
  reportWebVitals();
}

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div 
    role="alert" 
    className="flex flex-col items-center justify-center min-h-screen p-4"
  >
    <h2 className="text-2xl font-semibold text-red-600 mb-4">
      Something went wrong
    </h2>
    <pre className="text-sm text-gray-600 mb-4">
      {error.message}
    </pre>
    <button
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    >
      Try again
    </button>
  </div>
);

// Root element ID
const ROOT_ELEMENT_ID = 'root';

// Create root element if it doesn't exist
const rootElement = document.getElementById(ROOT_ELEMENT_ID) || (() => {
  const element = document.createElement('div');
  element.id = ROOT_ELEMENT_ID;
  document.body.appendChild(element);
  return element;
})();

// Create React root with strict mode
const root = ReactDOM.createRoot(rootElement);

// Render app with providers
root.render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider theme={{ direction: document.dir || 'ltr' }}>
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development') {
  if (module.hot) {
    module.hot.accept();
  }

  // Add error overlay for better debugging
  const { ErrorOverlay } = require('@pmmmwh/react-refresh-webpack-plugin');
  ErrorOverlay.setEditorHandler(editorPath => {
    window.open(editorPath);
  });
}