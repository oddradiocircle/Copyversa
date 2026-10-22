import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: 'test/e2e',
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : 'list',
    use: {
        ...devices['Desktop Chrome'],
        locale: 'es-CO',
    },
});
