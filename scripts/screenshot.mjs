// Takes the README screenshot from the e2e fixture page.
// Run after `npm run build`: node scripts/screenshot.mjs
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { PAGE_URL, serveFixture } from '../test/e2e/helpers.js';

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1200, height: 720 },
    deviceScaleFactor: 2,
    locale: 'es-CO',
});
await serveFixture(context);
const page = await context.newPage();
await page.addInitScript(`
    window.GM_getValue = (key, fallback) => fallback;
    window.GM_setValue = () => {};
    window.GM_registerMenuCommand = () => {};
`);
await page.addInitScript({ content: await readFile('dist/copyversa.user.js', 'utf8') });
await page.goto(PAGE_URL);
await page.keyboard.press('Control+Shift+X');
await page.locator('copyversa-ui').getByRole('button', { name: 'Opciones' }).click();
await page.locator('#actuaciones td').first().hover();
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
await page.waitForTimeout(100);
await page.screenshot({ path: 'docs/images/panel.png' });
await browser.close();
