import { FLAGS_ATTR, VALUE_ATTR } from './capture.js';
import { BLOCK_TAGS, KEPT_TAGS, REMOVED_TAGS, RENAMED_TAGS } from './tags.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const LAZY_SOURCES = ['data-src', 'data-lazy-src', 'data-original'];
const SAFE_LINK = /^(https?|mailto|tel|ftp):/i;
const LANGUAGE = /\b(?:language|lang)-([\w#+-]+)/;
const REMOVED_WHEN_EMPTY = new Set([
    'a',
    'abbr',
    'address',
    'article',
    'aside',
    'b',
    'blockquote',
    'caption',
    'cite',
    'code',
    'del',
    'details',
    'dfn',
    'div',
    'em',
    'figcaption',
    'figure',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'i',
    'ins',
    'kbd',
    'main',
    'mark',
    'nav',
    'ol',
    'p',
    'q',
    's',
    'samp',
    'section',
    'small',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'time',
    'u',
    'ul',
    'var',
]);

/**
 * Turns a captured clone into minimal semantic HTML: no scripts, styles,
 * classes or hidden content, with absolute URLs and visible formatting
 * expressed as markup.
 */
export function clean(container, { baseURI, removeLinks = false, includeImages = true } = {}) {
    cleanChildren(container, { baseURI, removeLinks, includeImages }, false);
    return container;
}

function cleanChildren(parent, options, inPre) {
    for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === ELEMENT_NODE) cleanElement(node, options, inPre);
        else if (node.nodeType !== TEXT_NODE) node.remove();
        else if (!inPre) node.data = node.data.replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ');
    }
}

function cleanElement(el, options, inPre) {
    const flags = new Set((el.getAttribute(FLAGS_ATTR) || '').split(' '));
    const tag = el.localName;

    if (flags.has('hidden')) return el.remove();
    if (el.hasAttribute(VALUE_ATTR)) return replaceWithText(el, el.getAttribute(VALUE_ATTR));
    if (REMOVED_TAGS.has(tag)) return el.remove();
    if (tag === 'img') return cleanImage(el, options);

    const language = tag === 'pre' || tag === 'code' ? languageOf(el) : null;
    const href = tag === 'a' ? linkOf(el, options) : null;

    cleanChildren(el, options, inPre || tag === 'pre' || RENAMED_TAGS.get(tag) === 'pre');

    if (flags.has('underline')) wrapChildren(el, 'u');
    if (flags.has('italic')) wrapChildren(el, 'em');
    if (flags.has('bold')) wrapChildren(el, 'strong');

    let name = RENAMED_TAGS.get(tag) ?? tag;
    if (!KEPT_TAGS.has(name) && flags.has('block')) name = 'div';
    if (!KEPT_TAGS.has(name) || (tag === 'a' && !href)) {
        return unwrap(el, flags.has('spaced'));
    }

    const result = name === tag ? el : rename(el, name);
    const allowed = KEPT_TAGS.get(name);
    for (const attr of Array.from(result.attributes)) {
        if (!allowed.includes(attr.name)) result.removeAttribute(attr.name);
    }

    if (href) result.setAttribute('href', href);
    if (name === 'code' && language) result.setAttribute('class', `language-${language}`);
    if (name === 'pre') normalizePre(result, language);

    const align = [...flags].find((flag) => flag.startsWith('align-'));
    if (align && BLOCK_TAGS.has(name)) result.setAttribute('style', `text-align: ${align.slice(6)}`);
    const list = [...flags].find((flag) => flag.startsWith('list-'));
    if (list === 'list-none') result.setAttribute('style', 'list-style-type: none');
    else if (list && name === 'ol') result.setAttribute('type', list.slice(5));

    if (REMOVED_WHEN_EMPTY.has(name) && isEmpty(result)) result.remove();
}

function cleanImage(el, { baseURI, includeImages }) {
    if (!includeImages) return el.remove();
    let src = el.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) {
        src = LAZY_SOURCES.map((name) => el.getAttribute(name)).find(Boolean) || src;
    }
    const url = resolve(src, baseURI);
    if (!/^https?:/i.test(url)) return el.remove();

    for (const attr of Array.from(el.attributes)) {
        if (!KEPT_TAGS.get('img').includes(attr.name)) el.removeAttribute(attr.name);
    }
    el.setAttribute('src', url);
}

function linkOf(el, { baseURI, removeLinks }) {
    const raw = (el.getAttribute('href') || '').trim();
    if (removeLinks || !raw || raw === '#') return null;
    const url = resolve(raw, baseURI);
    return SAFE_LINK.test(url) ? url : null;
}

function languageOf(el) {
    const match = (el.getAttribute('class') || '').match(LANGUAGE);
    return match ? match[1] : null;
}

// Turndown only fences <pre><code>, and reads it as plain text, so line
// breaks drawn with <br> or one block per line must become real newlines.
function normalizePre(pre, language) {
    for (const br of Array.from(pre.querySelectorAll('br'))) br.replaceWith('\n');
    for (const line of Array.from(pre.querySelectorAll('div, p'))) {
        if (!line.textContent.endsWith('\n')) line.append('\n');
    }
    let code = pre.children.length === 1 ? pre.firstElementChild : null;
    const padding = Array.from(pre.childNodes).filter((node) => node !== code);
    if (code?.localName === 'code' && padding.every((node) => !node.textContent.trim())) {
        for (const node of padding) node.remove();
    } else {
        code = pre.ownerDocument.createElement('code');
        code.append(...pre.childNodes);
        pre.append(code);
    }
    if (language && !code.hasAttribute('class')) code.setAttribute('class', `language-${language}`);
}

function replaceWithText(el, value) {
    if (!value.trim()) return el.remove();
    const nodes = [];
    value.split(/\r?\n/).forEach((line, index) => {
        if (index) nodes.push(el.ownerDocument.createElement('br'));
        nodes.push(line);
    });
    el.replaceWith(...nodes);
}

function wrapChildren(el, tag) {
    if (!el.textContent.trim()) return;
    const wrapper = el.ownerDocument.createElement(tag);
    wrapper.append(...el.childNodes);
    el.append(wrapper);
}

function rename(el, tag) {
    const next = el.ownerDocument.createElement(tag);
    for (const attr of Array.from(el.attributes)) next.setAttribute(attr.name, attr.value);
    next.append(...el.childNodes);
    el.replaceWith(next);
    return next;
}

function unwrap(el, spaced) {
    const children = Array.from(el.childNodes);
    el.replaceWith(...(spaced ? [' ', ...children, ' '] : children));
}

function isEmpty(el) {
    return !el.textContent.trim() && !el.querySelector('img, hr, table');
}

function resolve(value, baseURI) {
    if (!value) return '';
    try {
        return new URL(value.trim(), baseURI).href;
    } catch {
        return '';
    }
}
