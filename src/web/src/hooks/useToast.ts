import { useCallback } from 'react';
import { Toast } from '../components/ui/toast';

// Constants for toast configuration
const DEFAULT_DURATION = 5000;

// ARIA roles based on WCAG 2.1 Level AA compliance
const ARIA_ROLES = {
  ERROR: 'alert',
  DEFAULT: 'status'
} as const;

// ARIA live region settings for screen readers
const ARIA_LIVE = {
  ERROR: 'assertive',
  DEFAULT: 'polite'
} as const;

// Interface for toast notification options with accessibility properties
interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  ariaRole?: 'alert' | 'status';
  ariaLive?: 'polite' | 'assertive';
}

/**
 * Custom hook for managing accessible toast notifications
 * Implements WCAG 2.1 Level AA compliance with proper ARIA attributes
 */
export const useToast = () => {
  /**
   * Base function for showing accessible toast notifications
   * @param title - Toast title text
   * @param description - Optional toast description
   * @param variant - Toast variant for styling and accessibility
   * @param duration - Display duration in milliseconds
   */
  const showToast = useCallback(
    ({ 
      title, 
      description, 
      variant = 'default',
      duration = DEFAULT_DURATION,
      ariaRole,
      ariaLive
    }: ToastOptions) => {
      // Validate required parameters
      if (!title) {
        console.error('Toast title is required');
        return;
      }

      // Determine appropriate ARIA attributes based on variant
      const role = ariaRole || (variant === 'error' ? ARIA_ROLES.ERROR : ARIA_ROLES.DEFAULT);
      const live = ariaLive || (variant === 'error' ? ARIA_LIVE.ERROR : ARIA_LIVE.DEFAULT);

      // Show toast with accessibility attributes
      Toast[variant]({
        title,
        description,
        duration,
        className: `toast-${variant}`,
        'aria-live': live,
        role,
        // Support for RTL languages
        dir: document.dir || 'ltr'
      });
    },
    []
  );

  /**
   * Show success toast with appropriate accessibility attributes
   */
  const showSuccess = useCallback(
    (title: string, description?: string) => {
      showToast({
        title,
        description,
        variant: 'success',
        ariaRole: ARIA_ROLES.DEFAULT,
        ariaLive: ARIA_LIVE.DEFAULT
      });
    },
    [showToast]
  );

  /**
   * Show error toast with high-priority accessibility attributes
   */
  const showError = useCallback(
    (title: string, description?: string) => {
      showToast({
        title,
        description,
        variant: 'error',
        ariaRole: ARIA_ROLES.ERROR,
        ariaLive: ARIA_LIVE.ERROR
      });
    },
    [showToast]
  );

  /**
   * Show warning toast with appropriate accessibility attributes
   */
  const showWarning = useCallback(
    (title: string, description?: string) => {
      showToast({
        title,
        description,
        variant: 'warning',
        ariaRole: ARIA_ROLES.DEFAULT,
        ariaLive: ARIA_LIVE.DEFAULT
      });
    },
    [showToast]
  );

  /**
   * Show info toast with appropriate accessibility attributes
   */
  const showInfo = useCallback(
    (title: string, description?: string) => {
      showToast({
        title,
        description,
        variant: 'info',
        ariaRole: ARIA_ROLES.DEFAULT,
        ariaLive: ARIA_LIVE.DEFAULT
      });
    },
    [showToast]
  );

  return {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
};

export type UseToast = ReturnType<typeof useToast>;