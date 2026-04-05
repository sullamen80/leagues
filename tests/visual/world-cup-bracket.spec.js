const { test, expect } = require('@playwright/test');

const waitForHarness = async (page, scenario) => {
  await page.goto(`/__visual-tests/world-cup-bracket/${scenario}`);
  await expect(page.getByRole('heading', { name: 'World Cup Bracket Visual Harness' })).toBeVisible();
  await expect(page.getByTestId('visual-harness')).toBeVisible();
  await expect(page.getByTestId('scenario-frame')).toBeVisible();
};

test.describe('World Cup bracket visual checks', () => {
  test('default desktop layout', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 2200 });
    await waitForHarness(page, 'default');

    const screenshotPath = testInfo.outputPath('world-cup-bracket-default-desktop.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
