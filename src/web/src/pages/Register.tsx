"use client";

import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import RegisterForm from '../components/auth/RegisterForm';
import { Loader } from '@/components/ui/loader';
import { useRateLimit } from '@auth/rate-limit';

/**
 * Registration page component with enhanced security features and accessibility support
 * Implements secure user registration flow with Auth.js integration
 */
const Register: React.FC = () => {
  // Get authentication state and navigation
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Rate limiting for registration attempts
  const { isRateLimited } = useRateLimit('register', 5, 300000); // 5 attempts per 5 minutes

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader size="lg" />
        </div>
      </div>
    );
  }

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show rate limit message
  if (isRateLimited) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md p-6 space-y-6 bg-card rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-center text-foreground tracking-tight">
            Too Many Attempts
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main 
      role="main" 
      aria-label="Registration Page"
      className="min-h-screen flex items-center justify-center bg-background"
    >
      <div className="w-full max-w-md p-6 space-y-6 bg-card rounded-lg shadow-lg">
        <div role="form" aria-labelledby="registration-title">
          <h1 
            id="registration-title"
            className="text-3xl font-bold text-center text-foreground tracking-tight"
          >
            Create Account
          </h1>
          <p 
            id="registration-description"
            className="text-sm text-muted-foreground text-center mb-6"
          >
            Sign up to start collaborating on database designs
          </p>
          <RegisterForm />
        </div>
      </div>
    </main>
  );
};

export default Register;