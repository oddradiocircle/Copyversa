import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PAGE_URL, clearClipboard, readClipboard, serveFixture } from './helpers.js';

// Minimal stand-ins for the userscript manager API.
const GM_SHIM = `
    const store = new Map();
    window.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
    window.GM_setValue = (key, value) => store.set(key, value);
    window.GM_info = { scriptHandler: 'Tampermonkey' };
    window.GM_registerMenuCommand = () => {};
    window.GM_setClipboard = (data) => navigator.clipboard.writeText(data);
`;

async function open(page, context, headers) {
    await serveFixture(context, headers);
    await page.addInitScript(GM_SHIM);
    await page.addInitScript({ content: await readFile('dist/copyversa.user.js', 'utf8') });
    await page.goto(PAGE_URL);
    await clearClipboard(page);
}

const panel = (page) => page.locator('copyversa-ui').locator('section.panel');
const toast = (page) => page.locator('copyversa-ui').locator('.toast');

async function activate(page) {
    await page.keyboard.press('Control+Shift+X');
    await expect(panel(page)).toBeVisible();
}

test('copies the clicked element as Markdown and leaves the page alone', async ({ page, context }) => {
    await open(page, context);
    await activate(page);

    await page.locator('#intro').click({ position: { x: 5, y: 10 } });
    await expect(toast(page)).toHaveText('Copiado como Markdown');
    expect(await readClipboard(page)).toBe(
        'El despacho **resuelve** la demanda presentada el 3 de febrero de 2026. Ver [Código General del Proceso](https://copyversa.test/normas/ley-1564-2012).',
    );
    expect(await page.evaluate(() => window.pageClicks)).toBeUndefined();
    expect(await page.evaluate(() => document.querySelector('[data-copyversa]'))).toBeNull();
});

test('copies form values, tables and lettered lists', async ({ page, context }) => {
    await open(page, context);
    await activate(page);

    await page.locator('#datos span').first().hover();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(toast(page)).toBeVisible();
    expect(await readClipboard(page)).toBe(
        '**Radicado** 11001-31-03-001-2026-00123-00\n\n**Despacho** Juzgado Primero Civil del Circuito',
    );

    await page.locator('#actuaciones td').first().hover();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect
        .poll(() => readClipboard(page))
        .toBe(
            'Actuaciones\n\n| Fecha | Actuación |\n| --- | --- |\n| 2026-02-03 | Radicación de la demanda |\n| 2026-02-10 | Auto admisorio |',
        );

    await page.locator('#literales li').first().hover();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect
        .poll(() => readClipboard(page))
        .toBe('a. Admitir la demanda.\n\nb. Notificar a la parte demandada.');
});

test('copies several elements in order', async ({ page, context }) => {
    await open(page, context);
    await activate(page);

    await page.locator('#cierre').click({ modifiers: ['Shift'] });
    await page.locator('#titulo').click({ modifiers: ['Shift'] });
    const copyButton = panel(page).getByRole('button', { name: 'Copiar 2' });
    await copyButton.click();
    await expect(toast(page)).toHaveText('2 elementos copiados como Markdown');
    expect(await readClipboard(page)).toBe('Notifíquese y cúmplase.\n\n# Sentencia de primera instancia');
});

test('copies rich text with an HTML version for documents', async ({ page, context }) => {
    await open(page, context);
    await activate(page);

    await panel(page).getByRole('radio', { name: 'Enriquecido' }).check();
    await page.locator('#intro').click({ position: { x: 5, y: 10 } });
    await expect(toast(page)).toHaveText('Copiado como Enriquecido');
    expect(await readClipboard(page, 'text/html')).toContain('<strong>resuelve</strong>');
    expect(await readClipboard(page)).toContain('El despacho resuelve la demanda');
});

test('adds the source and remembers options', async ({ page, context }) => {
    await open(page, context);
    await activate(page);

    await panel(page).getByRole('button', { name: 'Opciones' }).click();
    await panel(page).getByRole('checkbox', { name: 'Añadir fuente y fecha de consulta' }).check();
    await panel(page).getByRole('radio', { name: 'Texto', exact: true }).check();
    await page.locator('#cierre').click();
    await expect(toast(page)).toBeVisible();
    expect(await readClipboard(page)).toMatch(
        /^Notifíquese y cúmplase\.\n\nFuente: Expediente 11001-31-03-001-2026-00123-00\. https:\/\/copyversa\.test\/procesos\/expediente\.html\. Consultado el \d{1,2} de \w+ de \d{4}\.$/,
    );
});

test('copies the current text selection directly', async ({ page, context }) => {
    await open(page, context);
    await page.evaluate(() => {
        const text = document.querySelector('#cierre').firstChild;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 11);
        getSelection().addRange(range);
    });
    await page.keyboard.press('Control+Shift+X');
    await expect(toast(page)).toHaveText('Selección copiada como Markdown');
    expect(await readClipboard(page)).toBe('Notifíquese');
    await expect(panel(page)).toBeHidden();
    // The selection is used once; the next press opens the picker.
    await page.keyboard.press('Control+Shift+X');
    await expect(panel(page)).toBeVisible();
});

test('keeps the arrow keys working after using the panel', async ({ page, context }) => {
    await open(page, context);
    await activate(page);
    await panel(page).getByRole('button', { name: 'Opciones' }).click();
    await page.locator('#literales li').first().hover();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect
        .poll(() => readClipboard(page))
        .toBe('a. Admitir la demanda.\n\nb. Notificar a la parte demandada.');
});

test('never copies its own interface', async ({ page, context }) => {
    await open(page, context);
    await activate(page);
    await panel(page).getByRole('button', { name: 'Opciones' }).click();
    await page.locator('#cierre').click();
    await expect(toast(page)).toBeVisible();

    await page.locator('#titulo').hover();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(() => readClipboard(page)).toContain('Notifíquese y cúmplase.');
    const wholePage = await readClipboard(page);
    expect(wholePage).toContain('# Sentencia de primera instancia');
    for (const text of ['CopyVersa', 'Selección múltiple', 'Copiado como', 'Atajo']) {
        expect(wholePage).not.toContain(text);
    }

    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+Shift+X');
    await expect(toast(page)).toHaveText('Selección copiada como Markdown');
    const selection = await readClipboard(page);
    expect(selection).toContain('Sentencia de primera instancia');
    for (const text of ['CopyVersa', 'Selección múltiple', 'Copiado como', 'Atajo']) {
        expect(selection).not.toContain(text);
    }
});

test('exits with Escape and lets the page work again', async ({ page, context }) => {
    await open(page, context);
    await activate(page);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await page.locator('#cierre').click();
    expect(await page.evaluate(() => window.pageClicks)).toBe(1);
});

test('works on pages with a strict Content Security Policy', async ({ page, context }) => {
    const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await open(page, context, {
        'Content-Security-Policy': "require-trusted-types-for 'script'; style-src 'none'",
    });
    await activate(page);
    await expect(panel(page)).toHaveCSS('border-radius', '12px');

    await page.locator('#cierre').click();
    await expect(toast(page)).toHaveText('Copiado como Markdown');
    expect(await readClipboard(page)).toBe('Notifíquese y cúmplase.');
    expect(errors.filter((text) => /trusted|CopyVersa/i.test(text))).toEqual([]);
});
