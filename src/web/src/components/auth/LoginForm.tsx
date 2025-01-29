"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next'; // ^13.0.0
import { useTheme } from 'next-themes'; // ^0.2.1
import { Link } from 'react-router-dom'; // ^6.0.0
import { z } from 'zod'; // ^3.0.0
import { useAuth } from '../../hooks/useAuth';
import { Button, buttonVariants } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

// Enhanced login form validation schema with security requirements
const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
  mfaCode: z.string().optional()
});

// Props interface with accessibility and theme support
interface LoginFormProps {
  className?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  direction?: 'ltr' | 'rtl';
}

// Form data interface with MFA support
interface LoginFormData {
  email: string;
  password: string;
  mfaCode?: string;
}

// Rate limiting constants
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 300000; // 5 minutes

export const LoginForm: React.FC<LoginFormProps> = ({
  className,
  onSuccess,
  onError,
  direction = 'ltr'
}) => {
  // Hooks
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { login, isLoading, verifyMFA } = useAuth();

  // Form state
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    mfaCode: ''
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [showMFA, setShowMFA] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lastAttempt, setLastAttempt] = useState(0);

  // Reset rate limiting after window expires
  useEffect(() => {
    if (attempts >= RATE_LIMIT_ATTEMPTS) {
      const timer = setTimeout(() => {
        setAttempts(0);
        setLastAttempt(0);
      }, RATE_LIMIT_WINDOW);
      return () => clearTimeout(timer);
    }
  }, [attempts]);

  // Form submission handler with security measures
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Rate limiting check
    if (attempts >= RATE_LIMIT_ATTEMPTS) {
      const timeLeft = RATE_LIMIT_WINDOW - (Date.now() - lastAttempt);
      setErrors({
        email: t('auth.errors.rateLimited', {
          minutes: Math.ceil(timeLeft / 60000)
        })
      });
      return;
    }

    try {
      // Validate form data
      const validatedData = loginSchema.parse(formData);

      if (showMFA && validatedData.mfaCode) {
        // Handle MFA verification
        await verifyMFA(validatedData.mfaCode, 'TOTP');
        onSuccess?.();
      } else {
        // Handle initial login
        await login({
          email: validatedData.email,
          password: validatedData.password
        });
        setShowMFA(true);
      }
    } catch (error: any) {
      // Update rate limiting state
      setAttempts(prev => prev + 1);
      setLastAttempt(Date.now());

      // Handle validation errors
      if (error instanceof z.ZodError) {
        setErrors(
          error.errors.reduce((acc, curr) => ({
            ...acc,
            [curr.path[0]]: curr.message
          }), {})
        );
      } else {
        setErrors({
          email: error.message || t('auth.errors.generic')
        });
        onError?.(error);
      }
    }
  };

  // Input change handler with validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'space-y-6 w-full max-w-md',
        direction === 'rtl' && 'text-right',
        className
      )}
      noValidate
    >
      {!showMFA ? (
        <>
          <Input
            label={t('auth.email')}
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="email"
            required
            aria-required="true"
            direction={direction}
            floating
          />

          <Input
            label={t('auth.password')}
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="current-password"
            required
            aria-required="true"
            direction={direction}
            floating
          />

          <div className="flex justify-between items-center">
            <Link
              to="/auth/forgot-password"
              className={cn(
                buttonVariants({ variant: 'link' }),
                'px-0'
              )}
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </>
      ) : (
        <Input
          label={t('auth.mfaCode')}
          type="text"
          name="mfaCode"
          value={formData.mfaCode}
          onChange={handleChange}
          error={errors.mfaCode}
          autoComplete="one-time-code"
          required
          aria-required="true"
          direction={direction}
          floating
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
        />
      )}

      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading}
        disabled={attempts >= RATE_LIMIT_ATTEMPTS}
      >
        {showMFA ? t('auth.verifyMFA') : t('auth.signIn')}
      </Button>

      <p className="text-sm text-center text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link
          to="/auth/register"
          className={buttonVariants({ variant: 'link' })}
        >
          {t('auth.signUp')}
        </Link>
      </p>
    </form>
  );
};

export default LoginForm;