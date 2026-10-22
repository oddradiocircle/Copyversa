import { beforeEach, describe, expect, it } from 'vitest';
import { copyContent } from '../../src/core/index.js';

const BASE = 'https://example.com/docs/page.html';

function render(html) {
    document.body.innerHTML = html;
    return document.body.firstElementChild;
}

function copy(target, options = {}) {
    const targets = Array.isArray(target) ? target : [target];
    return copyContent(targets, { format: 'markdown', baseURI: BASE, ...options });
}

beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

describe('markdown', () => {
    it('converts headings, emphasis, lists and links', () => {
        const el = render(`
            <article>
                <h2>Artículo 1. Objeto</h2>
                <p>La ley <strong>regula</strong> el <em>procedimiento</em>.</p>
                <ul><li>Uno</li><li>Dos</li></ul>
                <ol start="3"><li>Tres</li><li>Cuatro</li></ol>
                <p><a href="/normas/ley-1564">Ley 1564</a></p>
            </article>`);
        expect(copy(el).text).toBe(
            [
                '## Artículo 1. Objeto',
                'La ley **regula** el *procedimiento*.',
                '- Uno\n- Dos',
                '3. Tres\n4. Cuatro',
                '[Ley 1564](https://example.com/normas/ley-1564)',
            ].join('\n\n'),
        );
    });

    it('keeps code blocks intact, with their language', () => {
        const el = render(
            '<pre class="language-js"><code><span class="k">const</span> a = 1 &lt; 2;<br>call(&amp;x);</code></pre>',
        );
        expect(copy(el).text).toBe('```js\nconst a = 1 < 2;\ncall(&x);\n```');
    });

    it('fences a <pre> without <code>', () => {
        const el = render('<div><pre>line 1\n  line 2</pre></div>');
        expect(copy(el).text).toBe('```\nline 1\n  line 2\n```');
    });

    it('writes strikethrough with tildes', () => {
        const el = render('<p>Texto <del>derogado</del> vigente</p>');
        expect(copy(el).text).toBe('Texto ~~derogado~~ vigente');
    });

    it('keeps letters of lettered lists', () => {
        const el = render('<ol type="a"><li>Primero</li><li>Segundo</li></ol>');
        expect(copy(el).text).toBe('a. Primero\n\nb. Segundo');
    });

    it('removes links but keeps their text when asked', () => {
        const el = render('<p>Ver <a href="/x">el decreto</a> y <img src="/i.png" alt="sello"></p>');
        expect(copy(el, { removeLinks: true }).text).toBe(
            'Ver el decreto y ![sello](https://example.com/i.png)',
        );
    });

    it('drops images when asked', () => {
        const el = render('<p>Firma <img src="/firma.png" alt="firma"></p>');
        expect(copy(el, { includeImages: false }).text).toBe('Firma');
    });

    it('uses the real source of lazy images and drops inline data images', () => {
        const el = render(`<div>
            <img src="data:image/gif;base64,R0lGOD" data-src="/foto.jpg" alt="foto">
            <img src="data:image/png;base64,iVBOR" alt="inline">
        </div>`);
        expect(copy(el).text).toBe('![foto](https://example.com/foto.jpg)');
    });

    it('ignores links that run scripts or point nowhere', () => {
        const el = render('<p><a href="javascript:alert(1)">uno</a> <a href="#">dos</a></p>');
        expect(copy(el).text).toBe('uno dos');
    });
});

describe('cleaning', () => {
    it('removes scripts, styles, buttons, hidden and screen-reader-only content', () => {
        const el = render(`
            <div>
                <style>.x { color: red }</style>
                <script>alert(1)</script>
                <p>Visible</p>
                <p style="display: none">Oculto</p>
                <p hidden>Oculto</p>
                <span style="position: absolute; width: 1px; height: 1px; overflow: hidden">lector</span>
                <button>Imprimir</button>
                <svg><text>icono</text></svg>
            </div>`);
        expect(copy(el).text).toBe('Visible');
    });

    it('removes content hidden by a stylesheet', () => {
        document.head.innerHTML = '<style>.menu { display: none }</style>';
        const el = render('<div><nav class="menu">Menú</nav><p>Texto</p></div>');
        expect(copy(el).text).toBe('Texto');
    });

    it('never ignores the content of ignored elements', () => {
        const el = render('<div><p>Texto</p><aside id="ui">Panel</aside></div>');
        const ignore = [document.getElementById('ui')];
        expect(copy(el, { ignore }).text).toBe('Texto');
    });

    it('leaves the page untouched', () => {
        const el = render('<div class="a"><b style="font-weight: 400">x</b><input value="1"></div>');
        const before = document.body.innerHTML;
        copy(el);
        expect(document.body.innerHTML).toBe(before);
    });

    it('turns CSS bold, italic and underline into markup', () => {
        const el = render(`<p>
            <span style="font-weight: 700">negrita</span>
            <span style="font-style: italic">cursiva</span>
            <span style="text-decoration: underline">subrayado</span>
        </p>`);
        expect(copy(el).text).toBe('**negrita** *cursiva* subrayado');
        expect(copy(el, { format: 'html' }).text).toBe(
            '<p> <strong>negrita</strong> <em>cursiva</em> <u>subrayado</u> </p>',
        );
    });

    it('does not repeat bold inside headings or bold parents', () => {
        const el = render(
            '<div style="font-weight: bold"><p>Uno <span style="font-weight: bold">dos</span></p></div>',
        );
        expect(copy(el).text).toBe('**Uno dos**');
    });

    it('keeps block elements apart even when their tags are unknown', () => {
        const el = render(`<div>
            <app-field style="display: block">Radicado</app-field>
            <app-field style="display: block">2026-00123</app-field>
            <span style="display: inline-block">Juzgado</span><span style="display: inline-block">Civil</span>
        </div>`);
        expect(copy(el).text).toBe('Radicado\n\n2026-00123\n\nJuzgado Civil');
    });

    it('copies what form fields show', () => {
        const el = render(`<form>
            <label>Nombre <input name="n"></label>
            <textarea>Línea 1\nLínea 2</textarea>
            <select><option>Bogotá</option><option selected>Medellín</option></select>
            <label><input type="checkbox" checked> Acepto</label>
            <input type="password" value="secreto">
            <input type="hidden" value="token">
        </form>`);
        el.querySelector('input[name=n]').value = 'Ana Pérez';
        expect(copy(el, { format: 'text' }).text).toBe('Nombre Ana Pérez Línea 1\nLínea 2 Medellín ☑ Acepto');
    });

    it('keeps only meaningful attributes in HTML', () => {
        const el = render(`<div class="wrap" id="main" onclick="x()" data-id="7">
            <p style="color: red; text-align: justify" class="MsoNormal">Texto <a href="/a" target="_blank" class="btn">enlace</a></p>
            <td>no</td>
        </div>`);
        expect(copy(el, { format: 'html' }).text).toBe(
            '<div> <p style="text-align: justify">Texto <a href="https://example.com/a">enlace</a></p> no </div>',
        );
    });

    it('escapes text that looks like markup', () => {
        const el = render('<p>a &lt;script&gt; b</p>');
        expect(copy(el, { format: 'html' }).text).toBe('<p>a &lt;script&gt; b</p>');
    });
});

describe('tables', () => {
    it('converts a table with headers', () => {
        const el = render(`<table>
            <thead><tr><th>Radicado</th><th>Despacho</th></tr></thead>
            <tbody><tr><td>2026-001</td><td>Juzgado 1 | Civil</td></tr></tbody>
        </table>`);
        expect(copy(el).text).toBe(
            '| Radicado | Despacho |\n| --- | --- |\n| 2026-001 | Juzgado 1 \\| Civil |',
        );
    });

    it('uses the first row as header when there is none', () => {
        const el = render('<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>');
        expect(copy(el).text).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
    });

    it('expands colspan and rowspan', () => {
        const el = render(`<table>
            <tr><th colspan="2">Partes</th><th>Fecha</th></tr>
            <tr><td rowspan="2">Demandante</td><td>Ana</td><td>2026-01-02</td></tr>
            <tr><td>Luis</td><td>2026-01-03</td></tr>
        </table>`);
        expect(copy(el).text).toBe(
            [
                '| Partes |  | Fecha |',
                '| --- | --- | --- |',
                '| Demandante | Ana | 2026-01-02 |',
                '|  | Luis | 2026-01-03 |',
            ].join('\n'),
        );
    });

    it('joins paragraphs inside a cell with <br>', () => {
        const el = render('<table><tr><td>A</td><td><p>Uno</p><p>Dos</p></td></tr></table>');
        expect(copy(el).text).toBe('| A | Uno<br>Dos |\n| --- | --- |');
    });

    it('reads layout tables as blocks', () => {
        const el = render('<table><tr><td><p>Uno</p></td></tr><tr><td><p>Dos</p></td></tr></table>');
        expect(copy(el).text).toBe('Uno\n\nDos');
    });

    it('copies a single row as a table', () => {
        render('<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>');
        const row = document.querySelectorAll('tr')[1];
        expect(copy(row).text).toBe('| 1 | 2 |\n| --- | --- |');
    });

    it('separates cells with tabs in plain text', () => {
        const el = render(
            '<table><caption>Partes</caption><tr><th>A</th><th>B</th></tr><tr><td>1</td><td><b>2</b></td></tr></table>',
        );
        expect(copy(el, { format: 'text' }).text).toBe('Partes\n\nA\tB\n1\t2');
    });
});

describe('plain text', () => {
    it('drops all markup', () => {
        const el = render(`<div>
            <h1>Sentencia T-123</h1>
            <p>El <strong>juez</strong> decide: <a href="/x">ver</a> <code>art. 1*</code>.</p>
            <ul><li>Primero</li><li>Segundo<ul><li>Interno</li></ul></li></ul>
            <ol type="i"><li>Uno</li><li>Dos</li></ol>
            <blockquote><p>Cita</p></blockquote>
            <p>Línea<br>siguiente</p>
        </div>`);
        expect(copy(el, { format: 'text' }).text).toBe(
            [
                'Sentencia T-123',
                'El juez decide: ver art. 1*.',
                '• Primero\n• Segundo\n  • Interno',
                'i. Uno\nii. Dos',
                'Cita',
                'Línea\nsiguiente',
            ].join('\n\n'),
        );
    });

    it('turns non-breaking spaces into normal spaces', () => {
        const el = render('<p>Art.&nbsp;1&nbsp;&nbsp;Objeto</p>');
        expect(copy(el, { format: 'text' }).text).toBe('Art. 1 Objeto');
    });
});

describe('rich text', () => {
    it('returns HTML for documents and plain text as fallback', () => {
        const el = render('<div><p><b>Hola</b></p><table><tr><td>A</td><td>B</td></tr></table></div>');
        const result = copy(el, { format: 'rich' });
        expect(result.html).toBe(
            '<div><p><b>Hola</b></p><table border="1" cellpadding="4" style="border-collapse: collapse"><tbody><tr><td>A</td><td>B</td></tr></tbody></table></div>',
        );
        expect(result.text).toBe('Hola\n\nA\tB');
    });
});

describe('several targets', () => {
    it('joins the content of each target', () => {
        render('<div><p id="a">Uno</p><p id="b">Dos</p></div>');
        const targets = ['a', 'b'].map((id) => document.getElementById(id));
        expect(copy(targets).text).toBe('Uno\n\nDos');
    });

    it('returns empty text when nothing is visible', () => {
        const el = render('<div><p style="display: none">x</p></div>');
        expect(copy(el).text).toBe('');
    });
});

describe('selections', () => {
    it('copies a partial selection', () => {
        const el = render('<p>Uno <strong>dos tres</strong> cuatro</p>');
        const range = document.createRange();
        range.setStart(el.firstChild, 2);
        range.setEnd(el.querySelector('strong').firstChild, 3);
        expect(copy(range).text).toBe('o **dos**');
    });

    it('keeps the table around selected rows', () => {
        render('<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></tbody></table>');
        const rows = document.querySelectorAll('tr');
        const range = document.createRange();
        range.setStartBefore(rows[0]);
        range.setEndAfter(rows[1]);
        expect(copy(range).text).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
    });
});

describe('source citation', () => {
    const source = {
        title: 'Ley 1564 [2012]',
        url: 'https://example.com/ley (1).html',
        label: 'Fuente',
        accessed: 'Consultado el 21 de octubre de 2026',
    };

    it('adds the source in each format', () => {
        const el = render('<p>Texto</p>');
        expect(copy(el, { source }).text).toBe(
            'Texto\n\nFuente: [Ley 1564 \\[2012\\]](https://example.com/ley%20%281%29.html). Consultado el 21 de octubre de 2026.',
        );
        expect(copy(el, { source, format: 'text' }).text).toBe(
            'Texto\n\nFuente: Ley 1564 [2012]. https://example.com/ley (1).html. Consultado el 21 de octubre de 2026.',
        );
        expect(copy(el, { source, format: 'html' }).text).toBe(
            '<p>Texto</p>\n<p>Fuente: <a href="https://example.com/ley (1).html">Ley 1564 [2012]</a>. Consultado el 21 de octubre de 2026.</p>',
        );
    });

    it('adds no source when there is nothing to copy', () => {
        const el = render('<p hidden>Texto</p>');
        expect(copy(el, { source }).text).toBe('');
    });
});
