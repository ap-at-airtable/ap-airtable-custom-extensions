// Print-on-demand. The multi-record print layer renders one full page per record,
// so mounting it always is O(records) DOM even on screen. Instead mount it only
// while the browser is actually printing: `beforeprint` fires for both the OS
// print shortcut and window.print(), and flushSync makes the mount land in the
// DOM synchronously before the print snapshot is taken. Also owns the injected
// @page <style> lifecycle so it can't leak or go stale.

import {useCallback, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {updatePrintPageStyle, acquirePrintPageStyle, releasePrintPageStyle} from './print.js';

export function usePrintMode(page) {
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        acquirePrintPageStyle();
        return () => releasePrintPageStyle();
    }, []);

    useEffect(() => {
        updatePrintPageStyle(page);
    }, [page]);

    // beforeprint covers the browser's own Cmd/Ctrl+P; afterprint unmounts.
    useEffect(() => {
        const before = () => flushSync(() => setPrinting(true));
        const after = () => setPrinting(false);
        window.addEventListener('beforeprint', before);
        window.addEventListener('afterprint', after);
        return () => {
            window.removeEventListener('beforeprint', before);
            window.removeEventListener('afterprint', after);
        };
    }, []);

    // The in-app Print button mounts the layer synchronously, then prints. On every
    // modern browser `afterprint` (wired above) is what unmounts it; the 1s timer is
    // only a fallback for old Safari, which may not fire afterprint. We must NOT
    // unmount synchronously after window.print() — where print() is async (Safari)
    // that races the print snapshot and yields blank pages.
    const printNow = useCallback(() => {
        flushSync(() => setPrinting(true));
        window.print();
        window.setTimeout(() => setPrinting(false), 1000);
    }, []);

    return {printing, printNow};
}
