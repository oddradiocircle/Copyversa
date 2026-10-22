import { describe, expect, it } from 'vitest';
import {
    DEFAULTS,
    formatShortcut,
    loadSettings,
    matchesShortcut,
    shortcutFromEvent,
} from '../../src/settings.js';

const key = (init) => new KeyboardEvent('keydown', init);

describe('settings', () => {
    it('ignores saved values with the wrong shape', async () => {
        const saved = { format: 'pdf', removeLinks: 'yes', includeSource: true, shortcut: { key: '' } };
        const storage = { get: async (name, fallback) => saved[name] ?? fallback };
        expect(await loadSettings(storage)).toEqual({ ...DEFAULTS, includeSource: true });
    });
});

describe('shortcuts', () => {
    it('matches the physical key, whatever the layout types', () => {
        const event = key({ key: 'χ', code: 'KeyX', ctrlKey: true, shiftKey: true });
        expect(matchesShortcut(event, DEFAULTS.shortcut)).toBe(true);
        expect(matchesShortcut(key({ key: 'X', code: 'KeyX', ctrlKey: true }), DEFAULTS.shortcut)).toBe(
            false,
        );
    });

    it('records only combinations that cannot be typed by accident', () => {
        expect(shortcutFromEvent(key({ key: 'Control', ctrlKey: true }))).toBeNull();
        expect(shortcutFromEvent(key({ key: 'c', code: 'KeyC' }))).toBeNull();
        const shortcut = shortcutFromEvent(key({ key: 'c', code: 'KeyC', altKey: true, shiftKey: true }));
        expect(formatShortcut(shortcut)).toBe('Alt+Shift+C');
        expect(formatShortcut(shortcutFromEvent(key({ key: 'F2', code: 'F2' })))).toBe('F2');
    });
});
