// Print plumbing. Elements are authored in a 109-DPI coordinate space, but the
// browser prints CSS px at 96 DPI, so printed pages render at scale 96/DPI inside
// an inch-sized @page. The @page size is derived from the SAME resolvePageSizePx
// used to render, so the printed box and the content can't drift apart.

import {resolvePageSizePx, DPI} from '../domain/page_geometry.mjs';

export const PRINT_SCALE = 96 / DPI;

let _styleEl = null;
let _refCount = 0;

function pageSizeInches(page) {
    const {width, height} = resolvePageSizePx(page);
    return {w: width / DPI, h: height / DPI};
}

// Refcounted lifecycle so the injected <style> is removed once the last print
// consumer unmounts (it used to be a leaked singleton that also went stale).
export function acquirePrintPageStyle() {
    _refCount += 1;
}

export function releasePrintPageStyle() {
    _refCount = Math.max(0, _refCount - 1);
    if (_refCount === 0 && _styleEl) {
        _styleEl.remove();
        _styleEl = null;
    }
}

export function updatePrintPageStyle(page) {
    if (!_styleEl) {
        _styleEl = document.createElement('style');
        _styleEl.id = 'pd-print-style';
        document.head.appendChild(_styleEl);
    }
    const {w, h} = pageSizeInches(page);
    _styleEl.textContent = `
        @page { size: ${w}in ${h}in; margin: 0; }
        @media screen { .pd-print-only { display: none; } }
        @media print {
            /* Collapse any full-height app shell so it adds no blank page. */
            html, body { height: auto !important; min-height: 0 !important; background: #ffffff !important; }
            .dark { background: #ffffff !important; }
            .pd-print-only { display: block !important; background: #ffffff !important; }
            .pd-screen-only { display: none !important; }
            /* Print element backgrounds/borders by default instead of requiring the
               user to enable the browser's "Background graphics" option. */
            .pd-print-page, .pd-print-page * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            /* One sheet per record: break BEFORE each page after the first (avoids the
               trailing blank that break-after produces with exactly-full-height pages). */
            .pd-print-page { break-inside: avoid; }
            .pd-print-page + .pd-print-page { break-before: page; }
            /* The on-screen page float must not print as a gray halo. */
            .pd-print-page, .pd-print-page * { box-shadow: none !important; }
        }
    `;
}
