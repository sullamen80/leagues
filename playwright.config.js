const { defineConfig } = require('@playwright/test');

const port = 3100;
const baseURL = `http://localhost:${port}`;

module.exports = defineConfig({
  testDir: './tests/visual',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled'
    }
  },
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `BROWSER=none PORT=${port} CI=true npm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
