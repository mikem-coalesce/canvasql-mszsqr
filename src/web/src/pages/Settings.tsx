import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';

// Constants for settings management
const THEMES = ['light', 'dark', 'system'] as const;
const NOTIFICATION_TYPES = {
  PROJECT_UPDATES: 'project_updates',
  COLLABORATION: 'collaboration',
  SECURITY: 'security',
  SYSTEM: 'system'
} as const;

/**
 * Settings page component with comprehensive user preference management
 */
const Settings: React.FC = () => {
  // Theme management
  const { theme, setTheme, systemTheme } = useTheme();
  
  // Authentication and user state
  const { user, updatePreferences, logout } = useAuth();
  
  // Local state for notification preferences
  const [notifications, setNotifications] = useState({
    [NOTIFICATION_TYPES.PROJECT_UPDATES]: true,
    [NOTIFICATION_TYPES.COLLABORATION]: true,
    [NOTIFICATION_TYPES.SECURITY]: true,
    [NOTIFICATION_TYPES.SYSTEM]: true
  });

  // Local state for form handling
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles theme selection changes with system preference support
   */
  const handleThemeChange = useCallback(async (selectedTheme: typeof THEMES[number]) => {
    try {
      setTheme(selectedTheme);
      if (user) {
        await updatePreferences({ theme: selectedTheme });
      }
    } catch (err) {
      setError('Failed to update theme preference');
      console.error('Theme update error:', err);
    }
  }, [setTheme, user, updatePreferences]);

  /**
   * Handles notification preference updates
   */
  const handleNotificationChange = useCallback(async (type: keyof typeof NOTIFICATION_TYPES, enabled: boolean) => {
    try {
      setNotifications(prev => ({
        ...prev,
        [type]: enabled
      }));

      if (user) {
        await updatePreferences({
          notifications: {
            ...notifications,
            [type]: enabled
          }
        });
      }
    } catch (err) {
      setError('Failed to update notification preferences');
      console.error('Notification update error:', err);
    }
  }, [notifications, user, updatePreferences]);

  /**
   * Handles secure logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      setError('Logout failed. Please try again.');
      console.error('Logout error:', err);
    }
  }, [logout]);

  // Initialize user preferences
  useEffect(() => {
    if (user?.preferences) {
      setNotifications(user.preferences.notifications || notifications);
    }
  }, [user]);

  return (
    <div 
      className="container mx-auto px-4 py-8 max-w-4xl"
      role="main"
      aria-label="Settings page"
    >
      {/* Theme Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Theme Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {THEMES.map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => handleThemeChange(themeOption)}
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  theme === themeOption ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'
                )}
                aria-pressed={theme === themeOption}
                aria-label={`Select ${themeOption} theme`}
              >
                <span className="capitalize">{themeOption}</span>
                {themeOption === 'system' && (
                  <span className="text-sm text-muted-foreground block">
                    {`Currently ${systemTheme}`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(NOTIFICATION_TYPES).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center justify-between p-4 rounded-lg border hover:border-primary cursor-pointer"
              >
                <span className="flex flex-col">
                  <span className="font-medium">
                    {key.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ')}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Receive notifications about {value.replace('_', ' ')}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={notifications[value]}
                  onChange={(e) => handleNotificationChange(value, e.target.checked)}
                  className="h-6 w-6 rounded border-gray-300"
                  aria-label={`Toggle ${value} notifications`}
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{user?.email}</p>
                <p className="text-sm text-muted-foreground">
                  Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                aria-label="Logout from account"
              >
                Logout
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          className="mt-4 p-4 rounded-lg bg-destructive/10 text-destructive"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default Settings;