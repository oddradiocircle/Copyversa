import { FORMATS } from './core/index.js';

export const DEFAULTS = {
    format: 'markdown',
    removeLinks: false,
    includeImages: true,
    includeHidden: false,
    includeSource: false,
    exitAfterCopy: false,
    shortcut: { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key: 'X' },
};

const MODIFIER_KEYS = new Set(['Alt', 'AltGraph', 'Control', 'Meta', 'OS', 'Shift']);

/**
 * Reads saved settings, ignoring values with the wrong shape.
 *
 * @param {{get(key: string, fallback: unknown): Promise<unknown>}} storage
 */
export async function loadSettings(storage) {
    const entries = await Promise.all(
        Object.entries(DEFAULTS).map(async ([key, fallback]) => [key, await storage.get(key, fallback)]),
    );
    return { ...DEFAULTS, ...Object.fromEntries(entries.filter(([key, value]) => isValid(key, value))) };
}

function isValid(key, value) {
    if (key === 'format') return FORMATS.includes(value);
    if (key === 'shortcut') return typeof value?.key === 'string' && value.key !== '';
    return typeof value === typeof DEFAULTS[key];
}

// Letters and digits come from the physical key, so the shortcut works the
// same with any keyboard layout and when Alt changes the typed character.
function keyName(event) {
    if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
    if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
    return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

export function matchesShortcut(event, shortcut) {
    return (
        event.ctrlKey === Boolean(shortcut.ctrlKey) &&
        event.shiftKey === Boolean(shortcut.shiftKey) &&
        event.altKey === Boolean(shortcut.altKey) &&
        event.metaKey === Boolean(shortcut.metaKey) &&
        keyName(event).toUpperCase() === shortcut.key.toUpperCase()
    );
}

/** Returns a shortcut for the pressed keys, or null if they cannot be one. */
export function shortcutFromEvent(event) {
    if (MODIFIER_KEYS.has(event.key)) return null;
    const key = keyName(event);
    if (!event.ctrlKey && !event.altKey && !event.metaKey && !/^F\d{1,2}$/.test(key)) return null;
    const { ctrlKey, shiftKey, altKey, metaKey } = event;
    return { ctrlKey, shiftKey, altKey, metaKey, key };
}

export function formatShortcut(shortcut) {
    return [
        shortcut.ctrlKey && 'Ctrl',
        shortcut.altKey && 'Alt',
        shortcut.shiftKey && 'Shift',
        shortcut.metaKey && 'Meta',
        shortcut.key,
    ]
        .filter(Boolean)
        .join('+');
}
