/**
 * @fileoverview React hook for managing authentication state and operations with enhanced security features
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import useAuthStore from '../store/auth.store';
import type { 
  AuthCredentials, 
  AuthUser, 
  AuthSession, 
  SecurityLevel,
  MFAType 
} from '../types/auth.types';

// Constants for security configuration
const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const ACTIVITY_TIMEOUT = 1800000; // 30 minutes
const authService = new AuthService();

/**
 * Custom hook for managing authentication state and operations with security features
 */
export const useAuth = () => {
  const navigate = useNavigate();
  const refreshTimerRef = useRef<NodeJS.Timeout>();

  // Get auth store state and actions
  const {
    user,
    session,
    loading,
    error,
    mfaVerified,
    securityLevel,
    failedAttempts,
    isLocked,
    login: storeLogin,
    logout: storeLogout,
    checkAuth: storeCheckAuth,
    verifyMFA: storeVerifyMFA,
    updateSecurityLevel,
    trackActivity,
    handleFailedAttempt,
    resetFailedAttempts,
    setError,
    clearError
  } = useAuthStore();

  /**
   * Handles user login with security validation and MFA support
   */
  const handleLogin = useCallback(async (credentials: AuthCredentials) => {
    try {
      if (isLocked) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      clearError();
      
      // Validate security requirements
      await authService.validateSecurityLevel(securityLevel);

      // Attempt login
      const response = await authService.login(credentials);
      
      // Handle MFA if required
      if (response.user.mfaEnabled && !mfaVerified) {
        navigate('/auth/mfa');
        return;
      }

      // Update auth state
      await storeLogin(response);
      resetFailedAttempts();
      trackActivity();

      // Setup session refresh
      setupSessionRefresh();

      navigate('/dashboard');
    } catch (error: any) {
      handleFailedAttempt();
      setError(error.message);
      throw error;
    }
  }, [securityLevel, mfaVerified, isLocked]);

  /**
   * Handles user registration with security validation
   */
  const handleRegister = useCallback(async (credentials: AuthCredentials) => {
    try {
      clearError();

      // Validate security requirements
      await authService.validateSecurityLevel(securityLevel);

      // Register new user
      const response = await authService.register(credentials);

      // Handle MFA setup if required
      if (response.user.mfaEnabled) {
        navigate('/auth/mfa/setup');
        return;
      }

      navigate('/auth/login');
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  }, [securityLevel]);

  /**
   * Handles secure logout and session cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      // Clear refresh timer
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }

      // Perform logout
      await authService.logout();
      await storeLogout();

      navigate('/auth/login');
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  }, []);

  /**
   * Sets up automatic session refresh timer
   */
  const setupSessionRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    refreshTimerRef.current = setInterval(async () => {
      try {
        await storeCheckAuth();
        trackActivity();
      } catch (error) {
        handleLogout();
      }
    }, SESSION_CHECK_INTERVAL);
  }, []);

  /**
   * Checks authentication state and session validity
   */
  const checkAuth = useCallback(async () => {
    try {
      // Validate security level
      await authService.validateSecurityLevel(securityLevel);

      // Check and refresh session if needed
      await storeCheckAuth();
      trackActivity();

      // Setup new refresh timer
      setupSessionRefresh();
    } catch (error: any) {
      setError(error.message);
      handleLogout();
      throw error;
    }
  }, [securityLevel]);

  /**
   * Handles MFA verification with type-specific validation
   */
  const handleMFAVerify = useCallback(async (token: string, type: MFAType) => {
    try {
      clearError();
      await storeVerifyMFA(token, type);
      trackActivity();
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  }, []);

  // Initialize auth state and session refresh
  useEffect(() => {
    checkAuth().catch(() => navigate('/auth/login'));

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  // Monitor user activity for session management
  useEffect(() => {
    const handleActivity = () => trackActivity();
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  return {
    // Authentication state
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user && !!session,
    mfaVerified,
    securityLevel,
    failedAttempts,
    isLocked,

    // Authentication operations
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    verifyMFA: handleMFAVerify,
    checkAuth,

    // Security operations
    updateSecurityLevel,
    clearError
  };
};

export default useAuth;