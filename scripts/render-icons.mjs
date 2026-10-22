// Renders assets/icon.svg to the PNG sizes the browser extension needs.
// Run it after changing the icon: node scripts/render-icons.mjs
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile('assets/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: `assets/icons/icon-${size}.png`, omitBackground: true });
}
await browser.close();
