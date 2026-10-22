/* global GM_info, GM_getValue, GM_setValue, GM_setClipboard, GM_registerMenuCommand */
import { createApp } from './app.js';
import { isInnerFrame, pageWindows } from './frames.js';

// In a same-origin frame, the instance of the page around it does the work.
if (!isInnerFrame()) start();

function start() {
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

    // The shortcut must also work while the focus is inside a frame. Frames
    // can load late; moving the focus into one blurs this window.
    const listening = new WeakSet();
    const listenForShortcut = () => {
        for (const win of pageWindows()) {
            if (listening.has(win.document)) continue;
            listening.add(win.document);
            win.addEventListener('keydown', app.handleShortcut, true);
        }
    };
    listenForShortcut();
    window.addEventListener('blur', listenForShortcut);

    if (window.top === window.self) {
        GM_registerMenuCommand(app.t('menuToggle'), app.toggle);
    }
}

function mimeType(html) {
    return html ? 'text/html' : 'text/plain';
}
