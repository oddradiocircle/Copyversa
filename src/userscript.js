/* global GM_info, GM_getValue, GM_setValue, GM_setClipboard, GM_registerMenuCommand */
import { createApp } from './app.js';

const app = createApp({
    storage: {
        get: async (key, fallback) => GM_getValue(key, fallback),
        set: async (key, value) => GM_setValue(key, value),
    },
    // Tampermonkey takes a short type, Violentmonkey a MIME type.
    setClipboard: (text, html) =>
        GM_setClipboard(
            html ?? text,
            GM_info.scriptHandler === 'Violentmonkey' ? mimeType(html) : html ? 'html' : 'text',
        ),
    editableShortcut: true,
});

window.addEventListener('keydown', app.handleShortcut, true);

if (window.top === window.self) {
    GM_registerMenuCommand(app.t('menuToggle'), app.toggle);
}

function mimeType(html) {
    return html ? 'text/html' : 'text/plain';
}
