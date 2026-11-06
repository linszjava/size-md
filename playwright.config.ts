import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', use: { baseURL: process.env.E2E_URL ?? 'http://127.0.0.1:1420', channel: 'chrome', headless: true, viewport: { width: 1440, height: 960 } }, workers: 1 });
