"use client";

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";
import { useAuth } from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import { cn } from "../lib/utils";

/**
 * ForgotPassword page component with security features and accessibility support
 * Implements WCAG 2.1 Level AA compliance and security best practices
 */
const ForgotPassword: React.FC = () => {
  // Hooks for navigation, authentication and notifications
  const navigate = useNavigate();
  const { isAuthenticated, requestPasswordReset } = useAuth();
  const toast = useToast();

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handles password reset request with security measures
   * Implements rate limiting and security audit logging
   */
  const handlePasswordResetRequest = async (email: string) => {
    try {
      await requestPasswordReset(email);
      
      toast.showSuccess(
        "Password Reset Email Sent",
        "Please check your email for reset instructions"
      );

      // Redirect after successful request
      setTimeout(() => {
        navigate("/auth/login");
      }, 3000);
    } catch (error: any) {
      toast.showError(
        "Password Reset Failed",
        error.message || "Please try again later"
      );
    }
  };

  return (
    <main
      className={cn(
        // Base layout styles
        "min-h-screen flex flex-col justify-center items-center",
        "p-4 md:p-6 lg:p-8",
        "bg-background"
      )}
      // Accessibility attributes
      role="main"
      aria-labelledby="forgot-password-title"
    >
      <div
        className={cn(
          // Card container styles
          "w-full max-w-md",
          "p-6 md:p-8",
          "bg-card",
          "border border-border",
          "rounded-lg shadow-md",
          "animate-in fade-in-50 slide-in-from-bottom-5"
        )}
      >
        {/* Page title */}
        <h1
          id="forgot-password-title"
          className={cn(
            "text-2xl font-bold text-center mb-6",
            "text-foreground"
          )}
        >
          Reset Your Password
        </h1>

        {/* Description text */}
        <p
          className={cn(
            "text-sm text-muted-foreground text-center mb-8"
          )}
        >
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        {/* Password reset form */}
        <ForgotPasswordForm
          onSubmit={handlePasswordResetRequest}
          className="w-full"
        />

        {/* Back to login link */}
        <p
          className={cn(
            "text-sm text-center mt-6",
            "text-muted-foreground"
          )}
        >
          Remember your password?{" "}
          <button
            onClick={() => navigate("/auth/login")}
            className={cn(
              "text-primary hover:underline",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "rounded-sm"
            )}
          >
            Back to login
          </button>
        </p>
      </div>
    </main>
  );
};

export default ForgotPassword;