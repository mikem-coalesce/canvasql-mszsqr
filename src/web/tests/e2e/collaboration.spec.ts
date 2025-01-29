import { test, expect, Page, BrowserContext } from '@playwright/test';
import { describe, beforeEach, afterEach } from '@playwright/test';

// Test constants
const TEST_USERS = [
  { email: 'user1@test.com', password: 'testpass1' },
  { email: 'user2@test.com', password: 'testpass2' }
];

const SYNC_TIMEOUT = 100; // Max sync latency in ms
const PRESENCE_CHECK_INTERVAL = 30000; // 30s for presence updates
const TEST_WORKSPACE_ID = 'workspace-1';
const TEST_PROJECT_ID = 'project-1';

/**
 * Sets up test environment with multiple browser contexts for collaboration testing
 */
async function setupCollaborationTest(contexts: BrowserContext[]): Promise<void> {
  // Create browser contexts for each test user
  for (let i = 0; i < TEST_USERS.length; i++) {
    // Navigate to login page
    const page = await contexts[i].newPage();
    await page.goto('/login');

    // Login user
    await page.fill('[data-testid="email-input"]', TEST_USERS[i].email);
    await page.fill('[data-testid="password-input"]', TEST_USERS[i].password);
    await page.click('[data-testid="login-button"]');

    // Navigate to test workspace
    await page.goto(`/workspace/${TEST_WORKSPACE_ID}/project/${TEST_PROJECT_ID}`);
    
    // Wait for WebSocket connection
    await page.waitForSelector('[data-testid="connection-status-connected"]');
  }
}

describe('Collaboration Features', () => {
  let contexts: BrowserContext[] = [];

  beforeEach(async ({ browser }) => {
    // Create isolated browser contexts for each user
    contexts = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ]);

    await setupCollaborationTest(contexts);
  });

  afterEach(async () => {
    // Clean up browser contexts
    await Promise.all(contexts.map(context => context.close()));
  });

  test('should sync cursor positions between users', async () => {
    const [page1, page2] = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Move cursor on first user's page
    const startTime = Date.now();
    await page1.mouse.move(100, 100);

    // Wait for cursor update on second user's page
    await page2.waitForSelector('[data-testid="remote-cursor-user1"]');
    const syncLatency = Date.now() - startTime;

    // Verify cursor position and sync latency
    const cursor = await page2.locator('[data-testid="remote-cursor-user1"]');
    const position = await cursor.boundingBox();
    expect(position?.x).toBeCloseTo(100, 1);
    expect(position?.y).toBeCloseTo(100, 1);
    expect(syncLatency).toBeLessThan(SYNC_TIMEOUT);

    // Verify cursor label shows correct user
    const label = await cursor.getAttribute('data-user');
    expect(label).toBe(TEST_USERS[0].email);

    // Test cursor removal on disconnect
    await page1.close();
    await expect(page2.locator('[data-testid="remote-cursor-user1"]')).toBeHidden();
  });

  test('should update user presence indicators', async () => {
    const [page1, page2] = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Verify both users appear in presence list
    const presenceList = page1.locator('[data-testid="presence-list"]');
    await expect(presenceList).toContainText(TEST_USERS[0].email);
    await expect(presenceList).toContainText(TEST_USERS[1].email);

    // Verify online status indicators
    await expect(page1.locator(`[data-testid="user-status-${TEST_USERS[1].email}"]`))
      .toHaveAttribute('data-status', 'online');

    // Test idle status after inactivity
    await page1.waitForTimeout(PRESENCE_CHECK_INTERVAL);
    await expect(page2.locator(`[data-testid="user-status-${TEST_USERS[0].email}"]`))
      .toHaveAttribute('data-status', 'idle');

    // Test offline status on disconnect
    await page1.close();
    await expect(page2.locator(`[data-testid="user-status-${TEST_USERS[0].email}"]`))
      .toHaveAttribute('data-status', 'offline');
  });

  test('should enable real-time chat between users', async () => {
    const [page1, page2] = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Open chat panel for both users
    await page1.click('[data-testid="chat-panel-toggle"]');
    await page2.click('[data-testid="chat-panel-toggle"]');

    // Send test message
    const testMessage = 'Hello from user 1!';
    await page1.fill('[data-testid="chat-input"]', testMessage);
    await page1.click('[data-testid="chat-send-button"]');

    // Verify message delivery
    const chatMessage = page2.locator('[data-testid="chat-message"]').first();
    await expect(chatMessage).toContainText(testMessage);
    await expect(chatMessage).toContainText(TEST_USERS[0].email);

    // Verify message timestamp
    const timestamp = await chatMessage.getAttribute('data-timestamp');
    expect(Date.now() - new Date(timestamp!).getTime()).toBeLessThan(5000);

    // Test unread message indicator
    await page2.click('[data-testid="chat-panel-toggle"]'); // Close chat
    await page1.fill('[data-testid="chat-input"]', 'New message');
    await page1.click('[data-testid="chat-send-button"]');
    
    await expect(page2.locator('[data-testid="unread-messages-badge"]'))
      .toHaveText('1');
  });

  test('should handle concurrent diagram edits', async () => {
    const [page1, page2] = await Promise.all(
      contexts.map(context => context.newPage())
    );

    // Add table on first user's page
    await page1.click('[data-testid="add-table-button"]');
    await page1.fill('[data-testid="table-name-input"]', 'Users');
    await page1.click('[data-testid="save-table-button"]');

    // Verify table appears on second user's page
    await expect(page2.locator('[data-testid="table-node-Users"]'))
      .toBeVisible();

    // Add column on second user's page
    await page2.click('[data-testid="table-node-Users"]');
    await page2.click('[data-testid="add-column-button"]');
    await page2.fill('[data-testid="column-name-input"]', 'id');
    await page2.click('[data-testid="save-column-button"]');

    // Verify column appears on first user's page
    await expect(page1.locator('[data-testid="column-id"]'))
      .toBeVisible();

    // Verify no conflicts in concurrent edits
    const table1 = await page1.locator('[data-testid="table-node-Users"]').innerHTML();
    const table2 = await page2.locator('[data-testid="table-node-Users"]').innerHTML();
    expect(table1).toBe(table2);
  });
});