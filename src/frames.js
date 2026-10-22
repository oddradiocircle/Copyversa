/**
 * The page's window and every same-origin frame inside it, nested ones
 * included. Many government portals show the whole document inside a frame.
 */
export function pageWindows(win = window) {
    const found = [win];
    for (const frame of win.document.querySelectorAll('iframe, frame')) {
        try {
            // Reading the document of a cross-origin frame throws.
            if (frame.contentWindow?.document) found.push(...pageWindows(frame.contentWindow));
        } catch {
            // Out of reach: the browser keeps other sites' frames isolated.
        }
    }
    return found;
}

/** Distance from the top window's viewport to the viewport of the node's frame. */
export function frameOffset(node) {
    let x = 0;
    let y = 0;
    for (let frame = node.ownerDocument.defaultView?.frameElement; frame;) {
        const rect = frame.getBoundingClientRect();
        x += rect.left + frame.clientLeft;
        y += rect.top + frame.clientTop;
        frame = frame.ownerDocument.defaultView?.frameElement;
    }
    return [x, y];
}

/** Whether a same-origin parent page, which reaches into this frame, runs CopyVersa instead. */
export function isInnerFrame() {
    try {
        return window.parent !== window && Boolean(window.parent.document);
    } catch {
        return false;
    }
}
