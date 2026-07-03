// Tracks an element's content-box width via ResizeObserver. Returns [ref, width].

import {useCallback, useRef, useState} from 'react';

export function useContainerWidth() {
    const [width, setWidth] = useState(0);
    const observerRef = useRef(null);

    // Callback ref (not a mount-only effect) so the observer re-attaches when the
    // node appears later - e.g. after an empty state swaps to the real container -
    // otherwise fit-to-width is stuck at the fallback for the whole session. Also
    // carries .current for imperative consumers (the pinch-zoom handlers).
    const ref = useCallback((node) => {
        ref.current = node;
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
        if (node) {
            const observer = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry) {
                    setWidth(entry.contentRect.width);
                }
            });
            observer.observe(node);
            setWidth(node.clientWidth);
            observerRef.current = observer;
        }
    }, []);

    return [ref, width];
}

// Like useContainerWidth but tracks width AND height, via a callback ref so it
// re-attaches when the observed node mounts/unmounts (e.g. an overlay that only
// exists while presenting). Returns [callbackRef, {width, height}].
export function useContainerSize() {
    const [size, setSize] = useState({width: 0, height: 0});
    const observerRef = useRef(null);

    const ref = useCallback((node) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
        if (node) {
            const observer = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry) {
                    setSize({width: entry.contentRect.width, height: entry.contentRect.height});
                }
            });
            observer.observe(node);
            setSize({width: node.clientWidth, height: node.clientHeight});
            observerRef.current = observer;
        }
    }, []);

    return [ref, size];
}
