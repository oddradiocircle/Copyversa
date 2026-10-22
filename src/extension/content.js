import { createApp } from '../app.js';

// The script is injected again on every click; the app is created once per page.
globalThis.copyversa ??= createApp({
    storage: {
        get: async (key, fallback) => (await chrome.storage.local.get({ [key]: fallback }))[key],
        set: (key, value) => chrome.storage.local.set({ [key]: value }),
    },
    editableShortcut: false,
});

globalThis.copyversa.toggle();
