// Remembers the last viewed position (record + designed page) per table, so
// flipping between edit, preview, and published lands where the user left off.
// Each flip remounts the mode component, so React state can't carry this;
// localStorage also survives the full iframe remount when the interface goes
// builder <-> published. Per-user UI state, so deliberately NOT in GlobalConfig
// (that would sync one viewer's position to everyone).

// Sandboxed iframes can deny localStorage entirely; this keeps same-session
// flips working when they do.
const memoryFallback = new Map();

const storageKey = (tableId) => `pageDesigner:lastPosition:${tableId}`;

const normalize = (raw) => ({
    recordIndex: raw && typeof raw.recordIndex === 'number' ? Math.max(0, raw.recordIndex) : 0,
    pageIndex: raw && typeof raw.pageIndex === 'number' ? Math.max(0, raw.pageIndex) : 0,
});

export function loadLastPosition(tableId) {
    if (memoryFallback.has(tableId)) {
        return memoryFallback.get(tableId);
    }
    let raw = null;
    try {
        raw = JSON.parse(localStorage.getItem(storageKey(tableId)));
    } catch {
        // Storage denied or corrupt JSON; treat as unset.
    }
    return normalize(raw);
}

export function saveLastPosition(tableId, partial) {
    const next = normalize({...loadLastPosition(tableId), ...partial});
    memoryFallback.set(tableId, next);
    try {
        localStorage.setItem(storageKey(tableId), JSON.stringify(next));
    } catch {
        // Storage denied; the memory fallback still covers this session.
    }
}
