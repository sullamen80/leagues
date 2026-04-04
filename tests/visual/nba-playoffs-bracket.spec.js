const { test, expect } = require('@playwright/test');

const waitForHarness = async (page, scenario) => {
  await page.goto(`/__visual-tests/nba-playoffs-bracket/${scenario}`);
  await expect(page.getByRole('heading', { name: 'NBA Playoffs Bracket Visual Harness' })).toBeVisible();
  await expect(page.getByTestId('visual-harness')).toBeVisible();
  await expect(page.getByTestId('scenario-frame')).toBeVisible();
};

test.describe('NBA playoffs bracket visual checks', () => {
  test('default desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1700 });
    await waitForHarness(page, 'default');

    await expect(page.getByTestId('scenario-frame')).toHaveScreenshot(
      'nba-playoffs-bracket-default-desktop.png'
    );
  });

  test('default mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1400 });
    await waitForHarness(page, 'default');

    await expect(page).toHaveScreenshot('nba-playoffs-bracket-default-mobile.png', {
      fullPage: true
    });
  });

  test('locked scoring state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1700 });
    await waitForHarness(page, 'locked');

    await expect(page.getByTestId('scenario-frame')).toHaveScreenshot(
      'nba-playoffs-bracket-locked-desktop.png'
    );
  });

  test('long team names stress case', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1700 });
    await waitForHarness(page, 'long-names');

    await expect(page.getByTestId('scenario-frame')).toHaveScreenshot(
      'nba-playoffs-bracket-long-names-desktop.png'
    );
  });
});
