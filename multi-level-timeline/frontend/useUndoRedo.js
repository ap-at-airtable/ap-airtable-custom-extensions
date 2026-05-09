import {useRef, useCallback} from 'react';

// Simple undo stack for Airtable record mutations.
// Each entry stores the table, recordId, and the old field values to restore.
export function useUndoRedo() {
    const undoStack = useRef([]);
    const redoStack = useRef([]);

    const pushUndo = useCallback((entry) => {
        // entry: { table, recordId, fields: { [fieldId]: oldValue } }
        undoStack.current.push(entry);
        redoStack.current = [];
    }, []);

    const undo = useCallback(async () => {
        const entry = undoStack.current.pop();
        if (!entry) return;
        try {
            // We need current values for redo — but we stored them at push time as "new" values
            // Since we can't easily read current values without a query, we swap:
            // The entry.fields contains the OLD values we want to restore.
            // We'll push an entry with the CURRENT values (which were the "new" values).
            // For simplicity, just apply the old values; redo won't have perfect fidelity
            // if external changes happened, but it's good enough for immediate undo.
            if (entry.redoFields) {
                redoStack.current.push({...entry, fields: entry.redoFields, redoFields: entry.fields});
            }
            await entry.table.updateRecordAsync(entry.recordId, entry.fields);
        } catch { /* silently fail */ }
    }, []);

    const redo = useCallback(async () => {
        const entry = redoStack.current.pop();
        if (!entry) return;
        try {
            if (entry.redoFields) {
                undoStack.current.push({...entry, fields: entry.redoFields, redoFields: entry.fields});
            }
            await entry.table.updateRecordAsync(entry.recordId, entry.fields);
        } catch { /* silently fail */ }
    }, []);

    return {pushUndo, undo, redo};
}
