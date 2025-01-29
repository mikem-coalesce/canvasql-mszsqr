"use client";

import React, { useState, useRef, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";

// Schema for email validation with security constraints
const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(5, "Email must be at least 5 characters")
  .max(255, "Email must not exceed 255 characters")
  .regex(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    "Invalid email format"
  );

// Rate limiting constants
const RATE_LIMIT_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 300000; // 5 minutes in milliseconds

// Props interface with className support
interface ForgotPasswordFormProps {
  className?: string;
}

/**
 * Secure and accessible form component for password reset requests
 * Implements WCAG 2.1 Level AA compliance and security best practices
 */
export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  className,
}) => {
  // State management
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  // Hooks
  const { forgotPassword, isLoading } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Handles form submission with rate limiting and validation
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Rate limiting check
    const now = Date.now();
    if (attempts >= RATE_LIMIT_ATTEMPTS && 
        now - lastAttemptTime < RATE_LIMIT_WINDOW) {
      setError("Too many attempts. Please try again later.");
      return;
    }

    try {
      setError(null);

      // Validate email
      const validatedEmail = emailSchema.parse(email);

      // Track attempt
      setAttempts(prev => prev + 1);
      setLastAttemptTime(now);

      // Submit request
      await forgotPassword(validatedEmail);

      // Show success state
      setIsSuccess(true);
      setEmail("");

      // Redirect after delay
      setTimeout(() => {
        navigate("/auth/login");
      }, 3000);

    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
      // Log error to monitoring service
      console.error("Password reset request failed:", err);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full flex-col space-y-4",
        className
      )}
      noValidate
      aria-label="Password reset request form"
    >
      {/* Success message */}
      {isSuccess && (
        <div
          className="rounded-md bg-green-50 p-4 text-sm text-green-700"
          role="alert"
        >
          Password reset instructions have been sent to your email address.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="rounded-md bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Email input */}
      <Input
        type="email"
        label="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading || isSuccess}
        error={error}
        floating={true}
        required
        aria-required="true"
        aria-invalid={!!error}
        aria-describedby={error ? "email-error" : undefined}
        autoComplete="email"
        autoFocus
        placeholder="Enter your email address"
      />

      {/* Submit button */}
      <Button
        type="submit"
        className={cn(
          buttonVariants({ variant: "default" }),
          "w-full"
        )}
        disabled={isLoading || isSuccess}
        isLoading={isLoading}
        aria-disabled={isLoading || isSuccess}
      >
        {isLoading ? "Sending..." : "Reset Password"}
      </Button>

      {/* Back to login link */}
      <Button
        type="button"
        variant="link"
        className="w-full"
        onClick={() => navigate("/auth/login")}
        disabled={isLoading}
      >
        Back to login
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;