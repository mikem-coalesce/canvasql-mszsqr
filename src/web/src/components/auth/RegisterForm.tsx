"use client";

import React, { useState, FormEvent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod'; // ^3.0.0
import useAuth from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useRateLimit } from '@/lib/hooks/useRateLimit';
import { PasswordStrengthIndicator } from '@/components/shared/PasswordStrengthIndicator';

// Registration form validation schema
const registerSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
  confirmPassword: z.string(),
  acceptTerms: z.boolean()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine((data) => data.acceptTerms === true, {
  message: 'You must accept the terms and conditions',
  path: ['acceptTerms'],
});

// Form data interface
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

// Validation error interface
interface ValidationError {
  field: string;
  message: string;
}

const RegisterForm: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  // Error handling state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Auth hook and rate limiting
  const { register, isLoading, error } = useAuth();
  const { checkRateLimit, isRateLimited } = useRateLimit('register', 5, 300000); // 5 attempts per 5 minutes

  // Clear validation errors when form data changes
  useEffect(() => {
    setValidationErrors([]);
  }, [formData]);

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Check rate limit
    if (isRateLimited) {
      setValidationErrors([{
        field: 'form',
        message: 'Too many attempts. Please try again later.'
      }]);
      return;
    }

    try {
      // Validate form data
      const validatedData = registerSchema.parse(formData);

      // Attempt registration
      await register({
        email: validatedData.email,
        password: validatedData.password,
      });

      // Update rate limit counter
      checkRateLimit();

    } catch (err) {
      if (err instanceof z.ZodError) {
        setValidationErrors(
          err.errors.map(error => ({
            field: error.path[0] as string,
            message: error.message
          }))
        );
      } else {
        setValidationErrors([{
          field: 'form',
          message: 'Registration failed. Please try again.'
        }]);
      }
    }
  };

  // Get field error message
  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(error => error.field === field)?.message;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md mx-auto" noValidate>
      <h1 className="text-2xl font-bold text-center mb-6 dark:text-white">
        Create Account
      </h1>

      {/* Email field */}
      <Input
        type="email"
        label="Email"
        name="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        error={getFieldError('email')}
        floating
        autoComplete="email"
        required
        aria-required="true"
      />

      {/* Password field */}
      <div className="space-y-2">
        <Input
          type={showPassword ? "text" : "password"}
          label="Password"
          name="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={getFieldError('password')}
          floating
          autoComplete="new-password"
          required
          aria-required="true"
        />
        <PasswordStrengthIndicator password={formData.password} />
      </div>

      {/* Confirm Password field */}
      <Input
        type={showConfirmPassword ? "text" : "password"}
        label="Confirm Password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
        error={getFieldError('confirmPassword')}
        floating
        autoComplete="new-password"
        required
        aria-required="true"
      />

      {/* Terms acceptance */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="acceptTerms"
          name="acceptTerms"
          checked={formData.acceptTerms}
          onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 focus:ring-primary"
          aria-invalid={!!getFieldError('acceptTerms')}
        />
        <label htmlFor="acceptTerms" className="text-sm">
          I accept the <Link to="/terms" className="text-primary hover:underline">terms and conditions</Link>
        </label>
      </div>
      {getFieldError('acceptTerms') && (
        <p className="text-sm text-destructive" role="alert">
          {getFieldError('acceptTerms')}
        </p>
      )}

      {/* Form-level errors */}
      {(error || getFieldError('form')) && (
        <div className="text-sm text-destructive" role="alert">
          {error || getFieldError('form')}
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading}
        disabled={isLoading || isRateLimited}
      >
        Register
      </Button>

      {/* Login link */}
      <p className="text-sm text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
};

export default RegisterForm;