// Tracks an element's content-box width via ResizeObserver. Returns [ref, width].

import {useCallback, useEffect, useRef, useState} from 'react';

export function useContainerWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) {
            return undefined;
        }
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setWidth(entry.contentRect.width);
            }
        });
        observer.observe(node);
        setWidth(node.clientWidth);
        return () => observer.disconnect();
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
