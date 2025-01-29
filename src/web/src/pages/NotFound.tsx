import React from 'react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/ui/button';

/**
 * NotFound component that renders a user-friendly 404 error page
 * Implements UI Component Library requirements with proper accessibility
 * and responsive design specifications
 */
const NotFound: React.FC = () => {
  // Track 404 errors for analytics
  React.useEffect(() => {
    // Log 404 error for monitoring
    console.error('404 Error: Page not found', {
      path: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    // Main container with responsive layout and proper spacing
    <main 
      className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background"
      role="main"
      aria-labelledby="error-title"
    >
      {/* Error heading with proper typography scale */}
      <h1 
        id="error-title"
        className="text-7xl font-bold text-primary mb-4 md:text-8xl lg:text-9xl"
        aria-label="404 - Page not found"
      >
        404
      </h1>

      {/* Error message with responsive text sizing */}
      <p className="text-xl text-muted-foreground mb-8 max-w-md mx-auto md:text-2xl">
        Oops! The page you're looking for seems to have wandered off into uncharted territory.
      </p>

      {/* Navigation button with proper focus handling */}
      <Link
        to="/"
        className={buttonVariants({
          variant: "default",
          size: "lg",
          className: "font-semibold"
        })}
        aria-label="Return to homepage"
      >
        Return to Homepage
      </Link>
    </main>
  );
};

// Export for use in router configuration
export default NotFound;