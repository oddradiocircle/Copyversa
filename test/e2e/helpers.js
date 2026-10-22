import { readFile } from 'node:fs/promises';

export const ORIGIN = 'https://copyversa.test';
export const PAGE_URL = `${ORIGIN}/procesos/expediente.html`;

const fixture = new URL('./fixtures/expediente.html', import.meta.url);

/** Serves the fixture page at a secure origin, optionally with extra headers. */
export async function serveFixture(context, headers = {}) {
    const body = await readFile(fixture, 'utf8');
    await context.route(`${ORIGIN}/**`, (route) =>
        route.fulfill({ body, contentType: 'text/html; charset=utf-8', headers }),
    );
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
}

export async function readClipboard(page, type = 'text/plain') {
    return page.evaluate(async (mime) => {
        const [item] = await navigator.clipboard.read();
        return item.types.includes(mime) ? (await item.getType(mime)).text() : null;
    }, type);
}

export async function clearClipboard(page) {
    await page.evaluate(() => navigator.clipboard.writeText(''));
}
