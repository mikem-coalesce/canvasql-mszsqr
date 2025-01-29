"use client";

import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAnalytics } from '@/lib/analytics';

/**
 * Secure login page component implementing Auth.js authentication with MFA support
 * Follows WCAG 2.1 Level AA accessibility standards
 */
const LoginPage: React.FC = () => {
  // Authentication state and operations
  const { 
    isAuthenticated, 
    isLoading, 
    requiresMfa,
    error: authError 
  } = useAuth();

  const navigate = useNavigate();
  const analytics = useAnalytics();

  // Track page view for analytics
  useEffect(() => {
    analytics.trackPageView('login');
  }, []);

  // Redirect to dashboard if already authenticated
  if (isAuthenticated && !requiresMfa) {
    return <Navigate to="/dashboard" replace />;
  }

  // Handle successful authentication
  const handleLoginSuccess = () => {
    analytics.trackEvent('auth', 'login_success');
    navigate('/dashboard');
  };

  // Handle authentication errors
  const handleLoginError = (error: Error) => {
    analytics.trackEvent('auth', 'login_error', { error: error.message });
    console.error('Login error:', error);
  };

  return (
    <main 
      className="min-h-screen flex items-center justify-center p-4 bg-background"
      aria-labelledby="login-title"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle 
            id="login-title"
            className="text-2xl font-bold text-center"
          >
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center">
            {requiresMfa 
              ? 'Please complete two-factor authentication'
              : 'Sign in to your account to continue'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div 
              className="flex justify-center p-8"
              aria-live="polite"
              aria-busy="true"
            >
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              className="space-y-4"
              direction="ltr"
            />
          )}

          {authError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 p-3 rounded bg-destructive/10 text-destructive text-sm"
            >
              {authError}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default LoginPage;