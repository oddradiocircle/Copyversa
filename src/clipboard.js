/**
 * Writes plain text, and optionally HTML, to the clipboard.
 *
 * The copy event runs synchronously inside the user's click or key press and
 * can carry both formats at once, so it goes first. The async Clipboard API
 * and the platform's own clipboard (userscript managers) are fallbacks.
 *
 * @param {{text: string, html?: string}} content
 * @param {(text: string, html?: string) => unknown} [fallback]
 */
export async function writeClipboard({ text, html }, fallback) {
    if (copyWithEvent(text, html)) return;
    try {
        if (html && typeof ClipboardItem === 'function') {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                    'text/html': new Blob([html], { type: 'text/html' }),
                }),
            ]);
        } else {
            await navigator.clipboard.writeText(text);
        }
        return;
    } catch (error) {
        if (!fallback) throw error;
    }
    await fallback(text, html);
}

function copyWithEvent(text, html) {
    let written = false;
    const onCopy = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.clipboardData.setData('text/plain', text);
        if (html) event.clipboardData.setData('text/html', html);
        written = true;
    };
    window.addEventListener('copy', onCopy, true);
    try {
        document.execCommand('copy');
    } catch {
        // Not allowed here: the next method takes over.
    } finally {
        window.removeEventListener('copy', onCopy, true);
    }
    return written;
}
