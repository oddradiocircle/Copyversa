import { BLOCK_TAGS, KEPT_TAGS } from './tags.js';

export const FLAGS_ATTR = 'data-copyversa';
export const VALUE_ATTR = 'data-copyversa-value';

const TEXT_INPUTS = new Set([
    'color',
    'date',
    'datetime-local',
    'email',
    'month',
    'number',
    'range',
    'search',
    'tel',
    'text',
    'time',
    'url',
    'week',
]);
const CHECKABLE_INPUTS = new Set(['checkbox', 'radio']);
const BOLD_TAGS = new Set(['b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th']);
const ITALIC_TAGS = new Set(['address', 'cite', 'dfn', 'em', 'i', 'var']);
const UNDERLINED_TAGS = new Set(['a', 'abbr', 'ins', 'u']);
const ALIGNMENTS = new Set(['center', 'right', 'justify']);
const LIST_TYPES = {
    'lower-alpha': 'a',
    'lower-latin': 'a',
    'upper-alpha': 'A',
    'upper-latin': 'A',
    'lower-roman': 'i',
    'upper-roman': 'I',
    none: 'none',
};
const BLOCK_DISPLAY =
    /^(block|flex|grid|flow-root|list-item|table|table-row|table-row-group|table-header-group|table-footer-group|table-caption)$/;
const SPACED_DISPLAY = /^(inline-block|inline-flex|inline-grid|inline-table|table-cell)$/;

// Ancestors cloned around a partial selection so that rows keep their
// table and list items keep their list.
const WRAPPER_TAGS = new Set(['code', 'dl', 'ol', 'pre', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul']);
const OUTERMOST_WRAPPERS = new Set(['dl', 'ol', 'pre', 'table', 'ul']);
const NEEDS_PARENT = new Set(['caption', 'dd', 'dt', 'li', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr']);

/**
 * Clones an element or a selection range into an inert document.
 *
 * A detached clone has no computed styles, no visibility and no live form
 * values, so they are recorded on the page first as temporary attributes
 * that travel with the clone, and removed again right after cloning.
 */
export function capture(target, { ignore = [], includeHidden = false } = {}) {
    const isRange = typeof target.cloneContents === 'function';
    const root = isRange ? toElement(target.commonAncestorContainer) : target;
    const marks = [];
    inspect(
        root,
        { bold: false, italic: false, align: null },
        { ignore: new Set(ignore), includeHidden },
        marks,
    );

    for (const { el, flags, value } of marks) {
        el.setAttribute(FLAGS_ATTR, flags.join(' '));
        if (value !== null) el.setAttribute(VALUE_ATTR, value);
    }
    try {
        const doc = document.implementation.createHTMLDocument('');
        let content = doc.importNode(isRange ? target.cloneContents() : target, true);
        const outer = isRange ? root : needsParent(root) ? root.parentElement : null;
        for (const el of wrappers(outer)) {
            const shell = doc.importNode(el, false);
            shell.append(content);
            content = shell;
        }
        const container = doc.createElement('div');
        container.append(content);
        return container;
    } finally {
        for (const { el } of marks) {
            el.removeAttribute(FLAGS_ATTR);
            el.removeAttribute(VALUE_ATTR);
        }
    }
}

function inspect(el, inherited, context, marks) {
    const tag = el.localName;
    const style = getComputedStyle(el);
    const flags = [];
    let value = null;

    if (context.ignore.has(el) || isHidden(el, style, context.includeHidden)) {
        flags.push('hidden');
    } else if (tag === 'input') {
        if (CHECKABLE_INPUTS.has(el.type)) value = el.checked ? '☑' : '☐';
        else if (TEXT_INPUTS.has(el.type)) value = el.value;
        else flags.push('hidden');
    } else if (tag === 'textarea') {
        value = el.value;
    } else if (tag === 'select') {
        value = Array.from(el.selectedOptions, (option) => option.text.trim()).join(', ');
    }

    if (flags.length || value !== null) {
        marks.push({ el, flags, value });
        return;
    }

    const own = { ...inherited };
    const leaf = !Array.from(el.children).some((child) => BLOCK_TAGS.has(child.localName));
    const block = BLOCK_TAGS.has(tag) || BLOCK_DISPLAY.test(style.display);

    // Formatting applied through CSS classes becomes real markup, so that it
    // survives in Markdown and in documents.
    const bold = fontWeight(style) >= 600;
    if (BOLD_TAGS.has(tag)) own.bold = true;
    else if (!bold) own.bold = false;
    else if (!own.bold && leaf) {
        flags.push('bold');
        own.bold = true;
    }

    const italic = /italic|oblique/.test(style.fontStyle);
    if (ITALIC_TAGS.has(tag)) own.italic = true;
    else if (!italic) own.italic = false;
    else if (!own.italic && leaf) {
        flags.push('italic');
        own.italic = true;
    }

    const decoration = `${style.textDecorationLine} ${style.textDecoration}`;
    if (leaf && !UNDERLINED_TAGS.has(tag) && decoration.includes('underline')) {
        flags.push('underline');
    }

    if (block) {
        const align = style.textAlign === '-webkit-center' ? 'center' : style.textAlign;
        const meaningful = ALIGNMENTS.has(align) ? align : null;
        if (meaningful && meaningful !== inherited.align) flags.push(`align-${meaningful}`);
        own.align = meaningful;
    }

    if (tag === 'ol' || tag === 'ul') {
        const type = LIST_TYPES[style.listStyleType];
        if (type && (tag === 'ol' || type === 'none')) flags.push(`list-${type}`);
    }

    if (!KEPT_TAGS.has(tag)) {
        if (BLOCK_DISPLAY.test(style.display)) flags.push('block');
        else if (SPACED_DISPLAY.test(style.display)) flags.push('spaced');
    }

    if (flags.length) marks.push({ el, flags, value });
    for (const child of el.children) inspect(child, own, context, marks);
}

// Closed accordions and inactive tabs are copied only when the user asks for
// them, and only when the page marks them as collapsible. Other hidden
// content (menus, duplicates, stale notices) and screen-reader text never is.
function isHidden(el, style, includeHidden) {
    const collapsed =
        el.hidden ||
        style.display === 'none' ||
        style.contentVisibility === 'hidden' ||
        isInClosedDetails(el) ||
        // Visibility is inherited: only the element that sets it decides.
        (/^(hidden|collapse)$/.test(style.visibility) &&
            (!el.parentElement || getComputedStyle(el.parentElement).visibility === 'visible'));
    if (collapsed && !(includeHidden && isCollapsible(el))) return true;
    // Text meant only for screen readers: absolutely positioned and clipped.
    return (
        style.position === 'absolute' &&
        style.overflow === 'hidden' &&
        (Number.parseFloat(style.width) <= 1 || Number.parseFloat(style.height) <= 1)
    );
}

function isInClosedDetails(el) {
    const parent = el.parentElement;
    if (parent?.localName !== 'details' || parent.open) return false;
    return el !== parent.querySelector(':scope > summary');
}

// An accordion panel, a tab panel, or a section a button expands.
function isCollapsible(el) {
    if (isInClosedDetails(el) || el.getAttribute('hidden') === 'until-found') return true;
    if (el.getAttribute('role') === 'tabpanel') return true;
    if (!el.id) return false;
    return Array.from(el.getRootNode().querySelectorAll('[aria-controls]')).some((control) =>
        control.getAttribute('aria-controls').split(/\s+/).includes(el.id),
    );
}

function fontWeight(style) {
    const weight = style.fontWeight;
    if (weight === 'bold' || weight === 'bolder') return 700;
    return Number.parseInt(weight, 10) || 400;
}

function needsParent(el) {
    if (NEEDS_PARENT.has(el.localName)) return true;
    return el.localName === 'code' && el.parentElement?.localName === 'pre';
}

function wrappers(el) {
    const chain = [];
    for (let node = el; node && WRAPPER_TAGS.has(node.localName); node = node.parentElement) {
        chain.push(node);
        if (OUTERMOST_WRAPPERS.has(node.localName)) break;
    }
    return chain;
}

function toElement(node) {
    return node.nodeType === 1 ? node : node.parentElement;
}
