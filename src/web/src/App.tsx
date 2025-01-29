import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';

// Lazy-loaded page components
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Workspace = React.lazy(() => import('./pages/Workspace'));
const Project = React.lazy(() => import('./pages/Project'));
const Diagram = React.lazy(() => import('./pages/Diagram'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

// Auth hook for protected routes
import { useAuth } from './hooks/useAuth';

// Loading spinner for Suspense fallback
import { Spinner } from './components/ui/spinner';

/**
 * Protected route wrapper with authentication and loading states
 */
const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, loading, checkAuth } = useAuth();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

/**
 * Error fallback component for ErrorBoundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    role="alert" 
    className="flex flex-col items-center justify-center min-h-screen p-4"
  >
    <h2 className="text-2xl font-bold text-red-600 mb-4">
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

/**
 * Root application component implementing routing, authentication,
 * and global layout structure with error boundaries and toast notifications
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <Spinner size="lg" />
            </div>
          }
        >
          {/* Main application layout */}
          <div className="min-h-screen bg-background font-sans antialiased">
            {/* Main content area with proper ARIA landmarks */}
            <main className="relative flex min-h-screen flex-col">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/workspaces" element={
                  <ProtectedRoute>
                    <Workspace />
                  </ProtectedRoute>
                } />
                <Route path="/workspaces/:workspaceId/projects" element={
                  <ProtectedRoute>
                    <Project />
                  </ProtectedRoute>
                } />
                <Route path="/workspaces/:workspaceId/projects/:projectId/diagrams/:diagramId" element={
                  <ProtectedRoute>
                    <Diagram />
                  </ProtectedRoute>
                } />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>

            {/* Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 5000,
                className: 'toast',
                ariaProps: {
                  role: 'alert',
                  'aria-live': 'polite',
                }
              }}
            />
          </div>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;