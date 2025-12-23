import { test, expect } from "@playwright/test";

test.describe("Anonymous Email Generation", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state for anonymous testing
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem('nullsto_email_tokens');
      localStorage.removeItem('nullsto_current_email_id');
      localStorage.removeItem('nullsto_device_id');
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("should display email generator on homepage", async ({ page }) => {
    // Wait for the email address to be generated and displayed
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Verify an email address is shown (contains @ symbol)
    const emailText = await emailDisplay.textContent();
    expect(emailText).toContain('@');
  });

  test("should generate new email on button click", async ({ page }) => {
    // Wait for initial email to load
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Get the initial email address
    const initialEmail = await emailDisplay.textContent();
    expect(initialEmail).toContain('@');
    
    // Click the "New Email" button
    const newEmailButton = page.getByRole('button', { name: /new email/i });
    await expect(newEmailButton).toBeVisible({ timeout: 5000 });
    await newEmailButton.click();
    
    // Wait for the generation to complete (button should not be spinning forever)
    await page.waitForTimeout(2000);
    
    // Verify a new email was generated (may or may not be different)
    const newEmail = await emailDisplay.textContent();
    expect(newEmail).toContain('@');
    
    // Check for success toast
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /created|generated/i });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test("should create custom email address", async ({ page }) => {
    // Wait for initial load
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Click the "Custom" button
    const customButton = page.getByRole('button', { name: /custom/i });
    await expect(customButton).toBeVisible({ timeout: 5000 });
    await customButton.click();
    
    // Wait for the dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Enter a custom username
    const usernameInput = dialog.getByPlaceholder(/enter username/i).or(dialog.locator('input[type="text"]').first());
    await expect(usernameInput).toBeVisible({ timeout: 5000 });
    
    const customUsername = `testuser${Date.now()}`;
    await usernameInput.fill(customUsername);
    
    // Click create button in dialog
    const createButton = dialog.getByRole('button', { name: /create/i });
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();
    
    // Wait for dialog to close and verify custom email was created
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    
    // The email display should now contain the custom username
    await page.waitForTimeout(1000);
    const newEmail = await emailDisplay.textContent();
    expect(newEmail?.toLowerCase()).toContain(customUsername.toLowerCase());
  });

  test("should copy email to clipboard", async ({ page }) => {
    // Grant clipboard permission
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    
    // Wait for email to load
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Click copy button
    const copyButton = page.getByRole('button', { name: /copy/i });
    await expect(copyButton).toBeVisible({ timeout: 5000 });
    await copyButton.click();
    
    // Should show success toast
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /copied/i });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test("should display expiry timer for anonymous users", async ({ page }) => {
    // Wait for email to load
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Check for expiry timer (should show ~2 hours for anonymous)
    const timer = page.locator('text=/\\d{2}:\\d{2}:\\d{2}/').first();
    await expect(timer).toBeVisible({ timeout: 5000 });
    
    // Should show "sign in to extend" message for anonymous users
    const extendMessage = page.getByText(/sign in/i).filter({ hasText: /extend/i });
    await expect(extendMessage).toBeVisible({ timeout: 5000 });
  });

  test("should display inbox section", async ({ page }) => {
    // Check for inbox/messages section
    const inbox = page.getByText(/your messages/i).or(page.locator('[data-testid="inbox"]'));
    await expect(inbox).toBeVisible({ timeout: 15000 });
  });

  test("should have refresh button for inbox", async ({ page }) => {
    // Wait for page load
    await page.waitForLoadState("networkidle");
    
    // Look for refresh button in inbox area
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await expect(refreshButton).toBeVisible({ timeout: 10000 });
  });

  test("should not show permission denied error on email generation", async ({ page }) => {
    // Wait for initial email
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Generate multiple emails rapidly to test rate limiting doesn't cause permission errors
    const newEmailButton = page.getByRole('button', { name: /new email/i });
    
    for (let i = 0; i < 3; i++) {
      await newEmailButton.click();
      await page.waitForTimeout(1500);
      
      // Verify no permission denied toast
      const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: /permission denied/i });
      await expect(errorToast).not.toBeVisible({ timeout: 1000 }).catch(() => {
        // If visible, fail the test
        throw new Error('Permission denied error appeared - RLS/GRANT issue detected');
      });
    }
  });
});

test.describe("Inbox Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should show empty state when no emails", async ({ page }) => {
    // Wait for inbox to load
    const inbox = page.getByText(/your messages/i).or(page.locator('[data-testid="inbox"]'));
    await expect(inbox).toBeVisible({ timeout: 15000 });
    
    // Check for empty state message or waiting indicator
    const emptyState = page.getByText(/waiting for emails/i)
      .or(page.getByText(/no messages/i))
      .or(page.getByText(/inbox is empty/i));
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Email History (Auth Required)", () => {
  test("should redirect to auth if not logged in", async ({ page }) => {
    await page.goto("/history");
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
  });
});

test.describe("Domain Selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should display domain selector", async ({ page }) => {
    // Wait for email to load
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Look for domain selector dropdown
    const domainSelector = page.getByRole('combobox').first()
      .or(page.locator('[role="combobox"]').first());
    await expect(domainSelector).toBeVisible({ timeout: 5000 });
  });

  test("should be able to change domain", async ({ page }) => {
    // Wait for email to load
    const emailDisplay = page.locator('.font-mono').first();
    await expect(emailDisplay).toBeVisible({ timeout: 15000 });
    
    // Get initial email
    const initialEmail = await emailDisplay.textContent();
    
    // Open domain selector
    const domainSelector = page.getByRole('combobox').first();
    await expect(domainSelector).toBeVisible({ timeout: 5000 });
    await domainSelector.click();
    
    // Wait for dropdown options
    await page.waitForTimeout(500);
    
    // Check that options are visible (if there are multiple domains)
    const options = page.getByRole('option');
    const optionCount = await options.count();
    
    if (optionCount > 1) {
      // Select a different domain
      await options.nth(1).click();
      
      // Verify email domain changed
      await page.waitForTimeout(1000);
      const newEmail = await emailDisplay.textContent();
      // Domain portion should be different
      expect(newEmail).not.toBe(initialEmail);
    }
  });
});
