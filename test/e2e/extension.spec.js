import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { PAGE_URL, clearClipboard, readClipboard, serveFixture } from './helpers.js';

// The real extension only touches a tab after a click on its button or its
// shortcut, which Playwright cannot press. The test copy also gets access to
// the test site, so the service worker can inject the script the same way.
let dir;
let context;

test.beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'copyversa-'));
    const extension = join(dir, 'extension');
    await cp('dist/extension', extension, { recursive: true });
    const manifestPath = join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.host_permissions = ['https://copyversa.test/*'];
    await writeFile(manifestPath, JSON.stringify(manifest));

    context = await chromium.launchPersistentContext(join(dir, 'profile'), {
        channel: 'chromium',
        locale: 'es-CO',
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await serveFixture(context);
});

test.afterAll(async () => {
    await context?.close();
    await rm(dir, { recursive: true, force: true });
});

async function clickToolbarButton(worker) {
    await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    });
}

test('copies from a page and keeps settings in extension storage', async () => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(PAGE_URL);
    await page.bringToFront();
    await clearClipboard(page);

    await clickToolbarButton(worker);
    const panel = page.locator('copyversa-ui').locator('section.panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Cámbialo en chrome://extensions/shortcuts');

    await panel.getByRole('radio', { name: 'Texto', exact: true }).check();
    await page.locator('#cierre').click();
    await expect(page.locator('copyversa-ui').locator('.toast')).toHaveText('Copiado como Texto');
    expect(await readClipboard(page)).toBe('Notifíquese y cúmplase.');
    expect(await worker.evaluate(() => chrome.storage.local.get('format'))).toEqual({ format: 'text' });

    await clickToolbarButton(worker);
    await expect(panel).toBeHidden();
});
