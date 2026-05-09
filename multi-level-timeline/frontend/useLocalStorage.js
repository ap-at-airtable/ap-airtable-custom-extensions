import {useState, useCallback, useRef} from 'react';

const STORAGE_PREFIX = 'gantt_';
const DEBOUNCE_MS = 300;

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch { /* quota exceeded or private mode */ }
}

export function useLocalStorage(key, fallback) {
    const [value, setValue] = useState(() => {
        const resolved = typeof fallback === 'function' ? fallback() : fallback;
        return readStorage(key, resolved);
    });
    const timerRef = useRef(null);

    const set = useCallback((valOrFn) => {
        setValue(prev => {
            const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => writeStorage(key, next), DEBOUNCE_MS);
            return next;
        });
    }, [key]);

    return [value, set];
}

// For Map values (expand state)
export function useLocalStorageMap(key) {
    const [map, setMap] = useState(() => {
        const stored = readStorage(key, null);
        if (stored && typeof stored === 'object') return new Map(Object.entries(stored));
        return new Map();
    });
    const timerRef = useRef(null);

    const set = useCallback((valOrFn) => {
        setMap(prev => {
            const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                writeStorage(key, Object.fromEntries(next));
            }, DEBOUNCE_MS);
            return next;
        });
    }, [key]);

    return [map, set];
}
