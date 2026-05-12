const { test, expect } = require('@playwright/test');

test.describe('Super Admin System Flow', () => {
  const baseUrl = 'http://localhost:5001'; // Assuming local dev server

  test('should login and navigate to campus management', async ({ page }) => {
    // 1. Visit Login
    await page.goto(`${baseUrl}/#/login`);
    
    // 2. Perform Login (using test credentials)
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');

    // 3. Wait for dashboard and navigation
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText('Super Admin Command Center')).toBeVisible();

    // 4. Navigate to Campus Management
    await page.click('text=Campus Management');
    
    // 5. Verify system integration
    await expect(page.getByText('Registered Campuses')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Campus' })).toBeEnabled();
  });

  test('should display system analytics integrated from backend', async ({ page }) => {
    await page.goto(`${baseUrl}/#/login`);
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');

    // Check if the real-time analytics cards are rendered with data from API
    const studentCount = page.locator('.analytics-card:has-text("Total Students")');
    await expect(studentCount).toBeVisible();
    
    // Verify that the data is not just a placeholder
    const countText = await studentCount.innerText();
    expect(countText).not.toContain('--');
  });
});
