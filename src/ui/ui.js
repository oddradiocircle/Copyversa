import css from './styles.css';
import { FORMATS } from '../core/index.js';
import { formatShortcut } from '../settings.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OPTIONS = ['removeLinks', 'includeImages', 'includeHidden', 'includeSource', 'exitAfterCopy'];

/**
 * Builds CopyVersa's interface inside a shadow root, so page styles cannot
 * change it and it cannot change the page. Everything is created with DOM
 * methods, which keeps it working on pages that enforce Trusted Types.
 *
 * @param {object} params
 * @param {Function} params.t Translations.
 * @param {object} params.settings Current settings (read on every update).
 * @param {() => object} params.getState Current picker state.
 * @param {boolean} params.editableShortcut Whether the shortcut is set here or by the browser.
 * @param {object} params.handlers Callbacks for the panel controls.
 */
export function createUi({ t, settings, getState, editableShortcut, handlers }) {
    const host = document.createElement('copyversa-ui');
    for (const [name, value] of Object.entries({
        all: 'initial',
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
        'z-index': '2147483647',
    })) {
        host.style.setProperty(name, value, 'important');
    }
    const root = host.attachShadow({ mode: 'open' });
    adoptStyles(root, css);

    const label = h('span', { className: 'label' });
    const highlightBox = h('div', { className: 'highlight', hidden: true }, label);
    const marks = h('div');
    const toastBox = h('div', { className: 'toast', role: 'status', 'aria-live': 'polite' });
    const panel = buildPanel();
    root.append(highlightBox, marks, panel.element, toastBox);

    let highlighted = null;
    let marked = [];
    let toastTimer = 0;
    let frame = 0;

    function mount() {
        if (!host.isConnected) document.documentElement.append(host);
    }

    function show() {
        mount();
        panel.element.hidden = false;
        update();
    }

    function hide() {
        panel.element.hidden = true;
        highlight(null);
        setMarks([]);
    }

    function highlight(el) {
        highlighted = el;
        highlightBox.hidden = !el;
        if (el) {
            label.textContent = t.tag(el.localName);
            place(highlightBox, el);
        }
    }

    function setMarks(elements) {
        marked = elements;
        marks.replaceChildren(
            ...elements.map((el, index) =>
                h('div', { className: 'mark' }, h('span', { className: 'badge' }, String(index + 1))),
            ),
        );
        reposition();
    }

    function reposition() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            if (highlighted) place(highlightBox, highlighted);
            marked.forEach((el, index) => place(marks.children[index], el));
        });
    }

    function place(box, el) {
        const rect = el.getBoundingClientRect();
        box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.classList.toggle('inside', rect.top < 24);
    }

    function toast(message) {
        mount();
        toastBox.textContent = message;
        toastBox.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastBox.classList.remove('visible'), 2600);
    }

    function update() {
        const state = getState();
        panel.update(state);
    }

    function buildPanel() {
        const formatInputs = FORMATS.map((format) =>
            h('input', {
                type: 'radio',
                name: 'format',
                value: format,
                onchange: () => handlers.onOption('format', format),
            }),
        );
        const help = h('p', { className: 'help', id: 'format-help' });
        const multi = h('input', {
            type: 'checkbox',
            onchange: (event) => handlers.onMultiSelect(event.target.checked),
        });
        const copyButton = h('button', {
            type: 'button',
            className: 'primary',
            onclick: () => handlers.onCopySelected(),
        });
        const hint = h('p', { className: 'hint' });
        const optionsToggle = iconButton(t('options'), ICONS.options, () => {
            options.hidden = !options.hidden;
            optionsToggle.setAttribute('aria-expanded', String(!options.hidden));
        });
        optionsToggle.setAttribute('aria-expanded', 'false');
        optionsToggle.setAttribute('aria-controls', 'options');

        const optionInputs = Object.fromEntries(
            OPTIONS.map((key) => [
                key,
                h('input', {
                    type: 'checkbox',
                    onchange: (event) => handlers.onOption(key, event.target.checked),
                }),
            ]),
        );
        const shortcutKeys = h('kbd');
        const shortcutButton = editableShortcut
            ? h(
                  'button',
                  {
                      type: 'button',
                      className: 'secondary',
                      onclick: () => handlers.onRecordShortcut(),
                  },
                  t('changeShortcut'),
              )
            : null;
        const shortcutNote = h('small', {}, editableShortcut ? '' : t('browserShortcut'));

        const options = h(
            'div',
            { className: 'options', id: 'options', hidden: true },
            ...OPTIONS.map((key) => h('label', { className: 'check' }, optionInputs[key], t(key))),
            h(
                'div',
                { className: 'shortcut' },
                `${t('shortcut')}:`,
                shortcutKeys,
                shortcutButton,
                shortcutNote,
            ),
        );

        const bar = h(
            'div',
            { className: 'bar' },
            h('strong', {}, t('panel')),
            optionsToggle,
            iconButton(t('close'), ICONS.close, () => handlers.onClose()),
        );
        makeDraggable(bar);

        const element = h(
            'section',
            { className: 'panel', hidden: true, 'aria-label': t('panel') },
            bar,
            h(
                'fieldset',
                { className: 'formats', 'aria-describedby': 'format-help' },
                h('legend', {}, t('format')),
                ...formatInputs.map((input) =>
                    h('label', { className: 'format' }, input, h('span', {}, t(`format.${input.value}`))),
                ),
            ),
            help,
            h(
                'div',
                { className: 'row' },
                h('label', { className: 'check' }, multi, t('multiSelect')),
                copyButton,
            ),
            hint,
            options,
        );

        function makeDraggable(handle) {
            handle.addEventListener('pointerdown', (event) => {
                if (event.button !== 0 || event.target.closest('button')) return;
                const rect = element.getBoundingClientRect();
                const dx = event.clientX - rect.left;
                const dy = event.clientY - rect.top;
                handle.setPointerCapture(event.pointerId);
                const move = (moveEvent) => {
                    const left = Math.min(Math.max(moveEvent.clientX - dx, 0), innerWidth - rect.width);
                    const top = Math.min(Math.max(moveEvent.clientY - dy, 0), innerHeight - 40);
                    element.style.left = `${left}px`;
                    element.style.top = `${top}px`;
                    element.style.right = 'auto';
                };
                const end = () => {
                    handle.removeEventListener('pointermove', move);
                    handle.removeEventListener('pointerup', end);
                    handle.removeEventListener('pointercancel', end);
                };
                handle.addEventListener('pointermove', move);
                handle.addEventListener('pointerup', end);
                handle.addEventListener('pointercancel', end);
            });
        }

        return {
            element,
            update(state) {
                for (const input of formatInputs) input.checked = input.value === settings.format;
                help.textContent = t(`help.${settings.format}`);
                multi.checked = state.multiSelect;
                const count = state.selected.length;
                copyButton.textContent = t('copySelected', { count });
                copyButton.disabled = count === 0;
                copyButton.hidden = !state.multiSelect && count === 0;
                hint.textContent = state.multiSelect ? t('hintMulti') : t('hint');
                for (const key of OPTIONS) optionInputs[key].checked = settings[key];
                shortcutKeys.textContent = editableShortcut
                    ? formatShortcut(settings.shortcut)
                    : 'Ctrl+Shift+X';
                if (editableShortcut) shortcutNote.textContent = state.recording ? t('recordShortcut') : '';
            },
        };
    }

    return {
        host,
        mount,
        show,
        hide,
        highlight,
        setMarks,
        reposition,
        toast,
        update,
        // Back on the page, Enter and the arrows belong to the picker again.
        releaseFocus: () => root.activeElement?.blur(),
        owns: (event) => event.composedPath().includes(host),
        contains: (node) => host.contains(node) || node?.getRootNode?.() === root,
    };
}

function adoptStyles(root, text) {
    try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text);
        root.adoptedStyleSheets = [sheet];
    } catch {
        // Some userscript sandboxes cannot share constructed sheets.
        root.append(h('style', { textContent: text }));
    }
}

function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
        else if (key.includes('-')) el.setAttribute(key, value);
        else el[key] = value;
    }
    el.append(...children.filter((child) => child !== null && child !== undefined));
    return el;
}

const ICONS = {
    options: ['M3 5h10', 'M3 11h10', 'M10 3v4', 'M6 9v4'],
    close: ['M4 4l8 8', 'M12 4l-8 8'],
};

function iconButton(text, paths, onClick) {
    const button = h('button', {
        type: 'button',
        className: 'icon-button',
        title: text,
        'aria-label': text,
        onclick: onClick,
    });
    button.append(
        svg(
            '0 0 16 16',
            paths.map((d) => ['path', { d }]),
        ),
    );
    return button;
}

function svg(viewBox, shapes, className) {
    const el = document.createElementNS(SVG_NS, 'svg');
    el.setAttribute('viewBox', viewBox);
    el.setAttribute('aria-hidden', 'true');
    if (className) {
        el.setAttribute('class', className);
    } else {
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', 'currentColor');
        el.setAttribute('stroke-width', '1.75');
        el.setAttribute('stroke-linecap', 'round');
    }
    for (const [tag, attrs] of shapes) {
        const shape = document.createElementNS(SVG_NS, tag);
        for (const [name, value] of Object.entries(attrs)) shape.setAttribute(name, String(value));
        el.append(shape);
    }
    return el;
}
