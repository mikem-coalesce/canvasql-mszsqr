import { useEffect, useCallback } from 'react';
import { useThemeStore } from '../store/theme.store';
import { cn } from '../lib/utils';

// Media query constants
const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// DOM attribute constants
const THEME_ATTRIBUTE = 'data-theme';
const THEMES = ['light', 'dark', 'system'] as const;
const THEME_CHANGE_EVENT = 'themeChange';

/**
 * Custom hook for managing application theme with system preferences and accessibility features
 * @returns Theme management object with state and actions
 */
export function useTheme() {
  const { theme, setTheme } = useThemeStore();

  /**
   * Dispatches a custom event when theme changes for external listeners
   * @param newTheme - The new theme value
   */
  const dispatchThemeChange = useCallback((newTheme: string) => {
    const event = new CustomEvent(THEME_CHANGE_EVENT, {
      detail: {
        theme: newTheme,
        timestamp: new Date().toISOString()
      }
    });
    document.dispatchEvent(event);
  }, []);

  /**
   * Memoized theme toggle callback
   */
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    dispatchThemeChange(newTheme);
  }, [theme, setTheme, dispatchThemeChange]);

  /**
   * Get current system theme preference
   */
  const systemTheme = useCallback(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
  }, []);

  /**
   * Get reduced motion preference
   */
  const prefersReducedMotion = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  }, []);

  useEffect(() => {
    // Initialize system theme preference listener
    const darkModeQuery = window.matchMedia(MEDIA_QUERY);
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute(THEME_ATTRIBUTE, newTheme);
        document.documentElement.style.colorScheme = newTheme;
        dispatchThemeChange(newTheme);
      }
    };

    darkModeQuery.addEventListener('change', handleThemeChange);

    // Initialize reduced motion preference listener
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('motion-reduce', e.matches);
    };

    motionQuery.addEventListener('change', handleMotionChange);

    // Set initial theme
    const currentTheme = theme === 'system' ? systemTheme() : theme;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, currentTheme);
    document.documentElement.style.colorScheme = currentTheme;
    document.documentElement.className = cn(
      currentTheme,
      prefersReducedMotion() && 'motion-reduce'
    );

    // Set ARIA attributes for accessibility
    document.documentElement.setAttribute('aria-theme', currentTheme);
    document.documentElement.setAttribute(
      'aria-reduced-motion',
      prefersReducedMotion().toString()
    );

    // Cleanup listeners
    return () => {
      darkModeQuery.removeEventListener('change', handleThemeChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [theme, systemTheme, prefersReducedMotion, dispatchThemeChange]);

  return {
    theme,
    setTheme,
    toggleTheme,
    systemTheme: systemTheme(),
    prefersReducedMotion: prefersReducedMotion()
  };
}