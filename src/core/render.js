import TurndownService from 'turndown';

const OPTIONS = {
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
};
const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const PLAIN_INLINE = [
    'a',
    'abbr',
    'b',
    'cite',
    'code',
    'del',
    'dfn',
    'em',
    'i',
    'ins',
    'kbd',
    'mark',
    's',
    'samp',
    'small',
    'strong',
    'sub',
    'sup',
    'time',
    'u',
    'var',
];

let markdownService;
let textService;

export function toMarkdown(container) {
    markdownService ??= createMarkdownService();
    return tidy(markdownService.turndown(container));
}

export function toText(container) {
    textService ??= createTextService();
    return tidy(textService.turndown(container));
}

export function toHtml(container) {
    return container.innerHTML.trim();
}

// Word and Google Docs drop table borders unless the table carries them.
export function toRichHtml(container) {
    const copy = container.cloneNode(true);
    for (const table of copy.querySelectorAll('table')) {
        table.setAttribute('border', '1');
        table.setAttribute('cellpadding', '4');
        table.setAttribute('style', 'border-collapse: collapse');
    }
    return copy.innerHTML.trim();
}

function createMarkdownService() {
    const service = new TurndownService(OPTIONS);
    service.addRule('strikethrough', {
        filter: ['del', 's'],
        replacement: (content) => (content.trim() ? `~~${content}~~` : content),
    });
    service.addRule('listItem', { filter: 'li', replacement: listItem('-', true) });
    service.addRule('table', {
        filter: isDataTable,
        replacement: (content, table) => {
            const cell = (node) =>
                service.turndown(node).trim().replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
            const rows = grid(table, cell);
            // Header cells are bold already; a bold first row keeps no ** marks.
            const [head, ...body] = isHeaderRow(table.rows[0])
                ? [rows[0].map((text) => text.replace(/^\*\*(.*)\*\*$/, '$1')), ...rows.slice(1)]
                : [rows[0].map(() => ''), ...rows];
            const line = (cells) => `| ${cells.join(' | ')} |`;
            const lines = [line(head), line(head.map(() => '---')), ...body.map(line)];
            return block(caption(table, cell) + lines.join('\n'));
        },
    });
    return service;
}

function createTextService() {
    const service = new TurndownService(OPTIONS);
    service.escape = (text) => text;
    service.addRule('inline', { filter: PLAIN_INLINE, replacement: (content) => content });
    service.addRule('block', {
        filter: [...HEADINGS, 'blockquote'],
        replacement: (content) => block(content.trim()),
    });
    service.addRule('image', { filter: 'img', replacement: () => '' });
    service.addRule('rule', { filter: 'hr', replacement: () => '\n\n' });
    service.addRule('lineBreak', { filter: 'br', replacement: () => '\n' });
    service.addRule('pre', {
        filter: 'pre',
        replacement: (content, pre) => block(pre.textContent.replace(/\n$/, '')),
    });
    service.addRule('listItem', { filter: 'li', replacement: listItem('•', false) });
    service.addRule('table', {
        filter: isDataTable,
        replacement: (content, table) => {
            const cell = (node) =>
                service
                    .turndown(node)
                    .trim()
                    .replace(/\s*\n\s*/g, ' ');
            const rows = grid(table, cell).map((cells) => cells.join('\t'));
            return block(caption(table, cell) + rows.join('\n'));
        },
    });
    return service;
}

function listItem(bullet, markdown) {
    return (content, node) => {
        const list = node.parentNode;
        const style = list.getAttribute?.('style') || '';
        const type = list.nodeName === 'OL' ? list.getAttribute('type') || '1' : null;

        if (style.includes('list-style-type: none')) {
            return markdown ? block(content.trim()) : `${content.trim()}\n`;
        }

        let marker = bullet;
        if (type) {
            const index = Array.prototype.indexOf.call(list.children, node);
            const start = Number.parseInt(list.getAttribute('start'), 10) || 1;
            const value = Number.parseInt(node.getAttribute('value'), 10) || start + index;
            marker = `${counter(value, type)}.`;
        }

        // Markdown has no lettered or Roman lists: keep the marker as text, as
        // its own paragraph, so references like "literal b)" stay intact.
        if (markdown && type && type !== '1') {
            return block(`${marker} ${content.trim()}`);
        }

        const prefix = `${marker} `;
        const isParagraph = /\n$/.test(content);
        const body = content.replace(/^\n+/, '').replace(/\n+$/, '') + (isParagraph ? '\n' : '');
        return (
            prefix + body.replace(/\n/g, `\n${' '.repeat(prefix.length)}`) + (node.nextSibling ? '\n' : '')
        );
    };
}

function counter(value, type) {
    if (type === 'a' || type === 'A') {
        let letters = '';
        for (let n = value; n > 0; n = Math.floor((n - 1) / 26)) {
            letters = String.fromCharCode(97 + ((n - 1) % 26)) + letters;
        }
        return type === 'A' ? letters.toUpperCase() : letters;
    }
    if (type === 'i' || type === 'I') {
        const numerals = [
            [1000, 'm'],
            [900, 'cm'],
            [500, 'd'],
            [400, 'cd'],
            [100, 'c'],
            [90, 'xc'],
            [50, 'l'],
            [40, 'xl'],
            [10, 'x'],
            [9, 'ix'],
            [5, 'v'],
            [4, 'iv'],
            [1, 'i'],
        ];
        let roman = '';
        let rest = value;
        for (const [amount, numeral] of numerals) {
            for (; rest >= amount; rest -= amount) roman += numeral;
        }
        return type === 'I' ? roman.toUpperCase() : roman;
    }
    return String(value);
}

// Layout tables (nested tables or a single column) are read as plain blocks.
function isDataTable(node) {
    if (node.nodeName !== 'TABLE' || node.querySelector('table')) return false;
    const rows = Array.from(node.rows);
    return rows.length > 0 && rows.some((row) => width(row) >= 2);
}

function width(row) {
    return Array.from(row.cells).reduce((sum, cell) => sum + span(cell, 'colspan'), 0);
}

// Expands colspan and rowspan so every row has the same number of cells.
function grid(table, convert) {
    const carried = [];
    const rows = Array.from(table.rows, (row) => {
        const cells = [];
        const fill = () => {
            while (carried[cells.length] > 0) {
                carried[cells.length] -= 1;
                cells.push('');
            }
        };
        for (const cell of row.cells) {
            fill();
            const text = convert(cell);
            const rows = span(cell, 'rowspan');
            for (let i = 0; i < span(cell, 'colspan'); i++) {
                if (rows > 1) carried[cells.length] = rows - 1;
                cells.push(i === 0 ? text : '');
            }
        }
        while (cells.length < carried.length) {
            if (carried[cells.length] > 0) carried[cells.length] -= 1;
            cells.push('');
        }
        return cells;
    });
    const columns = Math.max(...rows.map((cells) => cells.length));
    return rows.map((cells) => [...cells, ...Array(columns - cells.length).fill('')]);
}

// Markdown tables need a header row. A first row is one only when the page
// says so; otherwise, as in key-value tables, the header stays empty.
function isHeaderRow(row) {
    if (!row) return false;
    if (row.parentElement?.localName === 'thead') return true;
    const cells = Array.from(row.cells).filter((cell) => cell.textContent.trim());
    return cells.length > 0 && cells.every((cell) => cell.localName === 'th' || isBold(cell));
}

function isBold(cell) {
    const strong = cell.querySelector('strong, b');
    return strong?.textContent.trim() === cell.textContent.trim();
}

function span(cell, name) {
    const value = Number.parseInt(cell.getAttribute(name), 10);
    return Math.min(Math.max(value || 1, 1), 50);
}

function caption(table, convert) {
    const node = table.querySelector('caption');
    const text = node ? convert(node) : '';
    return text ? `${text}\n\n` : '';
}

function block(text) {
    return `\n\n${text}\n\n`;
}

function tidy(text) {
    return text.replace(/\n{3,}/g, '\n\n').trim();
}
