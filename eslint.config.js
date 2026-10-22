import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['dist/', 'coverage/', 'test-results/', 'playwright-report/'] },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
        },
    },
    {
        files: ['src/extension/**'],
        languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
    },
    {
        files: ['scripts/**', 'test/e2e/**', '*.config.js'],
        languageOptions: { globals: { ...globals.node, ...globals.webextensions } },
    },
];
