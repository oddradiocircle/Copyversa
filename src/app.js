import { writeClipboard } from './clipboard.js';
import { copyContent } from './core/index.js';
import { pageWindows } from './frames.js';
import { createI18n } from './i18n.js';
import { DEFAULTS, formatShortcut, loadSettings, matchesShortcut, shortcutFromEvent } from './settings.js';
import { createUi } from './ui/ui.js';

const PICKER_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'auxclick'];

/**
 * CopyVersa's behavior, independent of how it is installed.
 *
 * @param {object} platform
 * @param {{get(key: string, fallback: unknown): Promise<unknown>, set(key: string, value: unknown): unknown}} platform.storage
 * @param {(text: string, html?: string) => unknown} [platform.setClipboard] Last-resort clipboard writer.
 * @param {boolean} platform.editableShortcut Whether CopyVersa listens for its own shortcut.
 */
export function createApp(platform) {
    const t = createI18n(navigator.language);
    const settings = { ...DEFAULTS };
    const ready = loadSettings(platform.storage).then((saved) => Object.assign(settings, saved));
    const state = {
        active: false,
        multiSelect: false,
        recording: false,
        pointerTarget: null,
        hovered: null,
        // Siblings picked with Shift + arrows, copied as one continuous range.
        run: null,
        trail: [],
        selected: [],
    };
    let ui = null;
    let windows = [];

    function getUi() {
        ui ??= createUi({
            t,
            settings,
            getState: () => state,
            editableShortcut: platform.editableShortcut,
            handlers: {
                onOption: setOption,
                onMultiSelect: (value) => {
                    state.multiSelect = value;
                    if (!value) setSelected([]);
                    ui.update();
                },
                onCopySelected: () => copy(state.selected),
                onClose: deactivate,
                onRecordShortcut: () => {
                    state.recording = true;
                    ui.update();
                },
            },
        });
        return ui;
    }

    async function toggle() {
        await ready;
        if (state.active) deactivate();
        else activate();
    }

    function activate() {
        const ranges = selectedRanges();
        if (ranges.length) {
            copy(ranges, 'copiedSelection');
            // Otherwise the next press would copy it again instead of opening the picker.
            for (const range of ranges) documentOf(range).getSelection().removeAllRanges();
            return;
        }
        state.active = true;
        getUi().show();
        listen(true);
    }

    function deactivate() {
        listen(false);
        Object.assign(state, {
            active: false,
            multiSelect: false,
            recording: false,
            pointerTarget: null,
            hovered: null,
            run: null,
            trail: [],
            selected: [],
        });
        ui?.hide();
    }

    function listen(on) {
        if (on) windows = pageWindows();
        for (const win of windows) {
            const method = (...args) =>
                on ? win.addEventListener(...args) : win.removeEventListener(...args);
            const options = { capture: true };
            method('pointermove', onPointerMove, options);
            method('click', onClick, options);
            method('keydown', onKeyDown, options);
            method('scroll', onViewportChange, { capture: true, passive: true });
            method('resize', onViewportChange, options);
            for (const type of PICKER_EVENTS) method(type, block, options);
        }
        if (!on) windows = [];
    }

    function onPointerMove(event) {
        if (ui.owns(event)) {
            state.pointerTarget = null;
            ui.highlight(null);
            return;
        }
        const target = deepTarget(event);
        if (!target || target === state.pointerTarget) return;
        state.pointerTarget = target;
        state.trail = [];
        ui.releaseFocus();
        hover(target);
    }

    function hover(el) {
        state.hovered = el;
        state.run = null;
        ui.highlight(el);
    }

    function extend(direction) {
        const run = state.run ?? { anchor: state.hovered, focus: state.hovered };
        const next = sibling(run.focus, direction);
        if (!next) return;
        run.focus = next;
        state.run = run.anchor === run.focus ? null : run;
        ui.highlight(state.run ? runElements(state.run) : state.hovered);
        next.scrollIntoView({ block: 'nearest' });
    }

    function sibling(el, direction) {
        const step = direction > 0 ? 'nextElementSibling' : 'previousElementSibling';
        for (let next = el[step]; next; next = next[step]) {
            if (isContent(next)) return next;
        }
        return null;
    }

    function firstChild(el) {
        return Array.from(el.children).find(isContent) ?? null;
    }

    // Skips empty anchors, hidden elements and CopyVersa itself.
    function isContent(el) {
        if (ui.contains(el)) return false;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        return Boolean(el.textContent.trim() || el.querySelector('img, table, input, select, textarea'));
    }

    function runElements({ anchor, focus }) {
        const forward = anchor.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING;
        const [first, last] = forward ? [anchor, focus] : [focus, anchor];
        const elements = [first];
        for (let el = first; el !== last;) {
            el = sibling(el, 1);
            elements.push(el);
        }
        return elements;
    }

    // From the start of the first sibling to the end of the last one, so
    // that nothing between them is lost.
    function runRange(run) {
        const elements = runElements(run);
        const range = elements[0].ownerDocument.createRange();
        range.setStartBefore(elements[0]);
        range.setEndAfter(elements.at(-1));
        return range;
    }

    function current() {
        if (state.selected.length) return state.selected;
        if (state.run) return [runRange(state.run)];
        return state.hovered ? [state.hovered] : [];
    }

    // While picking, the page must not react to clicks: no links, no menus.
    function block(event) {
        if (ui.owns(event)) return;
        if (state.recording && event.type !== 'keydown') {
            state.recording = false;
            ui.update();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function onClick(event) {
        if (ui.owns(event)) return;
        block(event);
        const target = state.hovered ?? deepTarget(event);
        if (!target) return;
        if (event.shiftKey || state.multiSelect) toggleSelected(target);
        else if (state.run) copy([runRange(state.run)]);
        else copy([target]);
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            block(event);
            deactivate();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        // Arrows move between formats and Enter presses buttons when they
        // have focus; otherwise the keys still drive the picker.
        const focused = event.composedPath()[0];
        if (
            ui.owns(event) &&
            (focused.type === 'radio' || (event.key === 'Enter' && focused.localName === 'button'))
        ) {
            return;
        }

        const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        if (horizontal && state.hovered && event.shiftKey) {
            extend(direction);
        } else if (horizontal && state.hovered) {
            const next = sibling(state.run?.focus ?? state.hovered, direction);
            if (next) {
                state.trail = [];
                hover(next);
                next.scrollIntoView({ block: 'nearest' });
            }
        } else if (event.key === 'ArrowUp' && state.hovered) {
            const parent = state.hovered.parentElement ?? state.hovered.getRootNode().host;
            if (!parent || state.hovered === state.hovered.ownerDocument.body) return;
            state.trail.push(state.hovered);
            hover(parent);
        } else if (event.key === 'ArrowDown' && state.hovered) {
            const child = state.trail.pop() ?? firstChild(state.hovered);
            if (child) hover(child);
        } else if (event.key === 'Enter' && current().length) {
            copy(current());
        } else {
            return;
        }
        block(event);
    }

    function onViewportChange() {
        ui.reposition();
    }

    function toggleSelected(el) {
        const selected = state.selected.includes(el)
            ? state.selected.filter((item) => item !== el)
            : [...state.selected, el];
        setSelected(selected);
    }

    function setSelected(selected) {
        state.selected = selected;
        ui.setMarks(selected);
        ui.update();
    }

    function copy(targets, message) {
        // An element inside another selected element would be copied twice.
        const unique = targets.filter(
            (target) => !targets.some((other) => other !== target && other.contains?.(target)),
        );
        const format = t(`format.${settings.format}`);
        const notify = (text) => getUi().toast(text);

        let content;
        try {
            content = copyContent(unique, {
                ...settings,
                baseURI: documentOf(unique[0]).baseURI,
                ignore: ui ? [ui.host] : [],
                source: settings.includeSource ? source() : null,
            });
        } catch (error) {
            console.error('[CopyVersa]', error);
            notify(t('copyError'));
            return;
        }
        if (!content.text) {
            notify(t('empty'));
            return;
        }

        writeClipboard(content, platform.setClipboard).then(
            () => {
                const count = unique.length;
                const key = message ?? (count > 1 ? 'copiedMany' : 'copied');
                notify(t(key, { count, format }));
                if (!state.active) return;
                if (settings.exitAfterCopy) deactivate();
                else if (state.selected.length) setSelected([]);
            },
            (error) => {
                console.error('[CopyVersa]', error);
                notify(t('copyError'));
            },
        );
    }

    function source() {
        return {
            title: document.title.trim(),
            url: location.href,
            label: t('sourceLabel'),
            accessed: t('accessed', { date: t.date(new Date()) }),
        };
    }

    function setOption(key, value) {
        settings[key] = value;
        platform.storage.set(key, value);
        ui?.update();
    }

    function selectedRanges() {
        return pageWindows()
            .map((win) => win.getSelection())
            .filter((selection) => selection && !selection.isCollapsed && selection.toString().trim())
            .flatMap((selection) =>
                Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)),
            )
            .filter((range) => !ui?.contains(range.commonAncestorContainer));
    }

    /** Keyboard handler for platforms where CopyVersa owns its shortcut. */
    function handleShortcut(event) {
        if (state.recording) {
            recordShortcut(event);
            return;
        }
        if (!event.repeat && matchesShortcut(event, settings.shortcut)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            toggle();
        }
    }

    function recordShortcut(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Escape') {
            state.recording = false;
            ui.update();
            return;
        }
        const shortcut = shortcutFromEvent(event);
        if (!shortcut) return;
        state.recording = false;
        setOption('shortcut', shortcut);
        ui.toast(t('shortcutSaved', { shortcut: formatShortcut(shortcut) }));
    }

    return { t, toggle, handleShortcut };
}

// The innermost element under the pointer, even inside open shadow roots.
function deepTarget(event) {
    const [first] = event.composedPath();
    return first?.nodeType === 1 ? first : event.target;
}

function documentOf(target) {
    return target.ownerDocument ?? target.startContainer.ownerDocument;
}
