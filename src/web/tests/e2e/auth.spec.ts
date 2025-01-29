import { test, expect } from '@playwright/test'; // ^1.x
import { AuthCredentials, AuthTokens } from '../../src/types/auth.types';

// Test constants
const TEST_CREDENTIALS: AuthCredentials = {
  email: 'test@example.com',
  password: 'Test123!@#',
  mfaCode: '123456'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-XSS-Protection': '1; mode=block'
};

const API_ENDPOINTS = {
  login: '/api/auth/login',
  mfa: '/api/auth/mfa/verify',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh'
};

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ context, page }) => {
    // Setup security and storage state
    await context.clearCookies();
    await page.route('**/*', async (route) => {
      const headers = route.request().headers();
      // Validate security headers
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[key.toLowerCase()]).toBe(value);
      }
      await route.continue();
    });

    // Navigate to login page
    await page.goto('/login');
  });

  test.afterEach(async ({ context }) => {
    // Cleanup
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill login form
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.password);
    await page.click('[data-testid="login-button"]');

    // Verify MFA prompt
    await expect(page.locator('[data-testid="mfa-prompt"]')).toBeVisible();
    await page.fill('[data-testid="mfa-input"]', TEST_CREDENTIALS.mfaCode);
    await page.click('[data-testid="mfa-submit"]');

    // Verify successful login
    await expect(page).toHaveURL('/dashboard');
    
    // Verify authentication tokens
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeTruthy();
    expect(authCookie.secure).toBe(true);
    expect(authCookie.httpOnly).toBe(true);
    expect(authCookie.sameSite).toBe('Lax');
  });

  test('should handle invalid login attempts securely', async ({ page }) => {
    const invalidAttempts = 5;
    
    for (let i = 0; i < invalidAttempts; i++) {
      await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.email);
      await page.fill('[data-testid="password-input"]', 'wrong_password');
      await page.click('[data-testid="login-button"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    }

    // Verify rate limiting after multiple failed attempts
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.password);
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible();
  });

  test('should maintain session security', async ({ page, context }) => {
    // Login successfully first
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.password);
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="mfa-input"]', TEST_CREDENTIALS.mfaCode);
    await page.click('[data-testid="mfa-submit"]');

    // Verify CSRF token presence
    const csrfToken = await page.evaluate(() => {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    });
    expect(csrfToken).toBeTruthy();

    // Test session persistence
    await page.reload();
    await expect(page).toHaveURL('/dashboard');

    // Test session timeout
    await page.waitForTimeout(3600000); // 1 hour
    await page.reload();
    await expect(page).toHaveURL('/login');
  });

  test('should handle logout securely', async ({ page, context }) => {
    // Login first
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.password);
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="mfa-input"]', TEST_CREDENTIALS.mfaCode);
    await page.click('[data-testid="mfa-submit"]');

    // Perform logout
    await page.click('[data-testid="logout-button"]');

    // Verify redirect to login
    await expect(page).toHaveURL('/login');

    // Verify cookie cleanup
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'auth_token')).toBeFalsy();

    // Verify session termination
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should prevent XSS attacks', async ({ page }) => {
    const xssPayload = '<script>alert(1)</script>';
    
    await page.fill('[data-testid="email-input"]', xssPayload);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.password);
    await page.click('[data-testid="login-button"]');

    // Verify XSS payload is escaped
    const emailInput = await page.inputValue('[data-testid="email-input"]');
    expect(emailInput).not.toContain('<script>');
  });

  test('should enforce password requirements', async ({ page }) => {
    const weakPasswords = ['123456', 'password', 'qwerty'];

    for (const password of weakPasswords) {
      await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.email);
      await page.fill('[data-testid="password-input"]', password);
      await page.click('[data-testid="login-button"]');

      // Verify password strength error
      await expect(page.locator('[data-testid="password-strength-error"]')).toBeVisible();
    }
  });
});