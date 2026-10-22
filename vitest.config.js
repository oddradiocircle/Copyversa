import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/unit/**/*.test.js'],
        environment: 'jsdom',
        environmentOptions: {
            jsdom: { url: 'https://example.com/docs/page.html' },
        },
    },
});
