const { test, expect } = require('@playwright/test');

test('export-safe desktop bracket mode renders cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1700 });
  await page.goto('/__visual-tests/nba-playoffs-bracket/default?mode=export');
  await expect(page.getByTestId('visual-harness')).toBeVisible();
  await expect(page.getByTestId('scenario-frame')).toHaveScreenshot(
    'nba-playoffs-bracket-export-mode-desktop.png'
  );
});
