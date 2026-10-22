import { capture } from './capture.js';
import { clean } from './clean.js';
import { toHtml, toMarkdown, toRichHtml, toText } from './render.js';

export const FORMATS = ['markdown', 'text', 'rich', 'html'];

/**
 * Converts page elements or selection ranges into clipboard content.
 *
 * @param {Array<Element|Range>} targets
 * @param {object} options
 * @param {'markdown'|'text'|'rich'|'html'} options.format
 * @param {string} options.baseURI Base for relative links and images.
 * @param {boolean} [options.removeLinks]
 * @param {boolean} [options.includeImages]
 * @param {boolean} [options.includeHidden] Also copy closed accordions, tabs and other hidden content.
 * @param {Element[]} [options.ignore] Elements never copied (CopyVersa's own UI).
 * @param {{title: string, url: string, label: string, accessed: string}} [options.source]
 * @returns {{text: string, html?: string}} Empty text when there is nothing to copy.
 */
export function copyContent(targets, options) {
    const containers = targets.map((target) => clean(capture(target, options), options));
    const { format, source } = options;

    if (format === 'rich') {
        const html = joinParts(containers.map(toRichHtml), '\n');
        const text = joinParts(containers.map(toText), '\n\n');
        if (!text && !html) return { text: '' };
        return {
            html: source ? `${html}\n${citationHtml(source)}` : html,
            text: source ? `${text}\n\n${citationText(source)}` : text,
        };
    }

    const render = { markdown: toMarkdown, text: toText, html: toHtml }[format];
    const body = joinParts(containers.map(render), format === 'html' ? '\n' : '\n\n');
    if (!body || !source) return { text: body };
    const citation = {
        markdown: citationMarkdown,
        text: citationText,
        html: citationHtml,
    }[format](source);
    return { text: `${body}${format === 'html' ? '\n' : '\n\n'}${citation}` };
}

function joinParts(parts, separator) {
    return parts.filter(Boolean).join(separator);
}

function citationMarkdown({ title, url, label, accessed }) {
    const name = (title || url).replace(/([[\]\\])/g, '\\$1');
    const target = url.replace(/[()\s]/g, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`);
    return `${label}: [${name}](${target}). ${accessed}.`;
}

function citationText({ title, url, label, accessed }) {
    return title ? `${label}: ${title}. ${url}. ${accessed}.` : `${label}: ${url}. ${accessed}.`;
}

function citationHtml({ title, url, label, accessed }) {
    const doc = document.implementation.createHTMLDocument('');
    const paragraph = doc.createElement('p');
    const link = doc.createElement('a');
    link.href = url;
    link.textContent = title || url;
    paragraph.append(`${label}: `, link, `. ${accessed}.`);
    return paragraph.outerHTML;
}
