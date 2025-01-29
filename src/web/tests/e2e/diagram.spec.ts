import { test, expect } from '@playwright/test';

// Test configuration constants
const TEST_CONFIG = {
  timeouts: {
    defaultNavigationTimeout: 30000,
    defaultActionTimeout: 15000,
    canvasLoad: 5000,
    sqlImport: 10000,
    stateSync: 2000
  },
  retries: 2,
  viewport: { width: 1280, height: 720 }
};

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  importTime: 3000,   // Maximum time for SQL import
  syncLatency: 100,   // Maximum sync delay between clients
  renderTime: 1000    // Maximum time for diagram render
};

// Test SQL samples
const TEST_SQL_SAMPLES = {
  valid: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      total DECIMAL(10,2) NOT NULL
    );
  `,
  invalid: 'CREATE TABLE invalid syntax)',
  large: Array(50).fill(TEST_SQL_SAMPLES.valid).join('\n') // Large schema simulation
};

test.describe('ERD Diagram E2E Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Configure timeouts and retry settings
    test.setTimeout(TEST_CONFIG.timeouts.defaultNavigationTimeout);
    context.setDefaultTimeout(TEST_CONFIG.timeouts.defaultActionTimeout);

    // Setup performance monitoring
    context.on('page', async (page) => {
      await page.route('**/*', route => {
        const startTime = Date.now();
        route.continue().then(() => {
          const duration = Date.now() - startTime;
          console.log(`Request to ${route.request().url()} took ${duration}ms`);
        });
      });
    });
  });

  test.describe('SQL Import', () => {
    test('should successfully import valid SQL DDL', async ({ page }) => {
      await page.goto('/diagram');
      await page.waitForSelector('[data-testid="diagram-canvas"]');

      // Open SQL import modal
      await page.click('[data-testid="import-sql-button"]');
      
      // Input SQL and trigger import
      await page.fill('[data-testid="sql-input"]', TEST_SQL_SAMPLES.valid);
      const importStartTime = Date.now();
      await page.click('[data-testid="import-confirm-button"]');

      // Verify import performance
      const importDuration = Date.now() - importStartTime;
      expect(importDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.importTime);

      // Verify diagram elements
      await expect(page.locator('[data-testid="entity-node-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="entity-node-orders"]')).toBeVisible();
      await expect(page.locator('[data-testid="relationship-edge"]')).toBeVisible();
    });

    test('should handle invalid SQL with appropriate error message', async ({ page }) => {
      await page.goto('/diagram');
      
      // Attempt to import invalid SQL
      await page.click('[data-testid="import-sql-button"]');
      await page.fill('[data-testid="sql-input"]', TEST_SQL_SAMPLES.invalid);
      await page.click('[data-testid="import-confirm-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('SQL syntax error');
    });

    test('should handle large schema imports', async ({ page }) => {
      await page.goto('/diagram');
      
      // Import large schema
      await page.click('[data-testid="import-sql-button"]');
      await page.fill('[data-testid="sql-input"]', TEST_SQL_SAMPLES.large);
      
      const importStartTime = Date.now();
      await page.click('[data-testid="import-confirm-button"]');

      // Verify performance with large schema
      const importDuration = Date.now() - importStartTime;
      expect(importDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.importTime * 2);

      // Verify diagram rendering
      const entityNodes = await page.locator('[data-testid^="entity-node-"]').count();
      expect(entityNodes).toBeGreaterThan(50);
    });
  });

  test.describe.parallel('Collaboration', () => {
    test('should sync changes between multiple users', async ({ browser }) => {
      // Create two browser contexts for different users
      const contextA = await browser.newContext();
      const contextB = await browser.newContext();
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      // Setup both users in the same diagram
      await pageA.goto('/diagram/test-collaboration');
      await pageB.goto('/diagram/test-collaboration');

      // User A makes changes
      await pageA.click('[data-testid="add-entity-button"]');
      await pageA.fill('[data-testid="entity-name-input"]', 'TestEntity');
      await pageA.click('[data-testid="confirm-entity-button"]');

      // Verify sync to User B
      const syncStartTime = Date.now();
      await expect(pageB.locator('[data-testid="entity-node-TestEntity"]')).toBeVisible();
      const syncDuration = Date.now() - syncStartTime;
      expect(syncDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.syncLatency);

      // Cleanup
      await contextA.close();
      await contextB.close();
    });

    test('should handle network disconnections gracefully', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('/diagram');

      // Simulate offline state
      await context.setOffline(true);
      
      // Attempt modifications while offline
      await page.click('[data-testid="add-entity-button"]');
      await page.fill('[data-testid="entity-name-input"]', 'OfflineEntity');
      await page.click('[data-testid="confirm-entity-button"]');

      // Verify offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

      // Restore connection and verify sync
      await context.setOffline(false);
      await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="entity-node-OfflineEntity"]')).toBeVisible();

      await context.close();
    });
  });

  test.describe('Visualization', () => {
    test('should maintain layout consistency', async ({ page }) => {
      await page.goto('/diagram');

      // Import test schema
      await page.click('[data-testid="import-sql-button"]');
      await page.fill('[data-testid="sql-input"]', TEST_SQL_SAMPLES.valid);
      await page.click('[data-testid="import-confirm-button"]');

      // Take screenshot for visual comparison
      await expect(page.locator('[data-testid="diagram-canvas"]')).toHaveScreenshot('diagram-layout.png');
    });

    test('should handle canvas interactions correctly', async ({ page }) => {
      await page.goto('/diagram');

      // Test zoom functionality
      await page.click('[data-testid="zoom-in-button"]');
      const zoomLevel = await page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="diagram-canvas"]');
        return canvas.style.transform;
      });
      expect(zoomLevel).toContain('scale');

      // Test pan functionality
      const canvasElement = await page.locator('[data-testid="diagram-canvas"]');
      await canvasElement.dragTo(canvasElement, {
        sourcePosition: { x: 100, y: 100 },
        targetPosition: { x: 200, y: 200 }
      });

      // Verify canvas position changed
      const canvasPosition = await page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="diagram-canvas"]');
        return canvas.style.transform;
      });
      expect(canvasPosition).toContain('translate');
    });
  });
});