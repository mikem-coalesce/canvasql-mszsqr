import { create } from 'zustand'; // v4.4.0
import { persist } from 'zustand/middleware'; // v4.4.0
import { cn } from '../lib/utils';

// Constants for theme management
const STORAGE_KEY = 'erd-theme';
const THEME_ATTRIBUTE = 'data-theme';
const SYSTEM_DARK_MEDIA = '(prefers-color-scheme: dark)';
const MOTION_PREFERENCE_QUERY = '(prefers-reduced-motion: reduce)';
const STORE_VERSION = 1;

// Available themes
const THEMES = ['light', 'dark', 'system'] as const;
const DEFAULT_THEME = 'system';

// Theme state interface
interface ThemeState {
  theme: string;
  systemPreference: boolean;
  reducedMotion: boolean;
}

// Theme actions interface
interface ThemeActions {
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
  setSystemPreference: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
}

/**
 * Updates theme attributes and CSS variables in DOM with performance optimization
 * @param theme - Current theme value
 * @param reducedMotion - Reduced motion preference
 */
const updateThemeAttribute = (theme: string, reducedMotion: boolean): void => {
  const root = document.documentElement;
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia(SYSTEM_DARK_MEDIA).matches);

  // Update theme attributes
  root.setAttribute(THEME_ATTRIBUTE, isDark ? 'dark' : 'light');
  root.style.colorScheme = isDark ? 'dark' : 'light';

  // Update motion preference
  root.setAttribute('data-reduced-motion', reducedMotion.toString());

  // Update Tailwind classes
  root.className = cn(
    isDark ? 'dark' : 'light',
    reducedMotion && 'motion-reduce'
  );

  // Dispatch theme change event for components
  window.dispatchEvent(new CustomEvent('theme-change', { 
    detail: { theme: isDark ? 'dark' : 'light', reducedMotion } 
  }));
};

/**
 * Creates and configures the theme Zustand store with persistence and system preference detection
 */
const createThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: DEFAULT_THEME,
      systemPreference: true,
      reducedMotion: false,

      // Theme actions
      setTheme: (theme: string) => {
        if (!THEMES.includes(theme as any)) return;
        set({ theme });
        updateThemeAttribute(theme, get().reducedMotion);
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme, systemPreference: false });
        updateThemeAttribute(newTheme, get().reducedMotion);
      },

      setSystemPreference: (enabled: boolean) => {
        set({ systemPreference: enabled, theme: enabled ? 'system' : get().theme });
        updateThemeAttribute(enabled ? 'system' : get().theme, get().reducedMotion);
      },

      setReducedMotion: (enabled: boolean) => {
        set({ reducedMotion: enabled });
        updateThemeAttribute(get().theme, enabled);
      }
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      onRehydrateStorage: () => {
        // Set up system theme preference listener
        const darkModeQuery = window.matchMedia(SYSTEM_DARK_MEDIA);
        darkModeQuery.addEventListener('change', () => {
          const state = useThemeStore.getState();
          if (state.systemPreference) {
            updateThemeAttribute('system', state.reducedMotion);
          }
        });

        // Set up reduced motion preference listener
        const motionQuery = window.matchMedia(MOTION_PREFERENCE_QUERY);
        motionQuery.addEventListener('change', (e) => {
          useThemeStore.setState({ reducedMotion: e.matches });
        });

        // Initialize theme on load
        return (state) => {
          if (state) {
            updateThemeAttribute(state.theme, state.reducedMotion);
          }
        };
      }
    }
  )
);

// Export the theme store hook
export const useThemeStore = createThemeStore;