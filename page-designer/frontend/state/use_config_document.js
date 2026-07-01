// Reads/writes the persisted design document via GlobalConfig.
// GlobalConfig writes are optimistic (local update is immediate, re-render via
// useGlobalConfig), so transient drag state is handled locally in the editor and
// only committed here on pointer-up.

import {useCallback, useMemo, useRef, useState} from 'react';
import {useGlobalConfig} from '@airtable/blocks/interface/ui';
import {ConfigKey, defaultPage, SCHEMA_VERSION} from '../domain/config_keys.mjs';
import {hydrateLayout} from '../domain/layout_model.mjs';

// The page + layout share one ~150kB GlobalConfig ceiling, so budget them
// together (with headroom for schemaVersion + any other host keys) rather than
// checking the layout alone.
const MAX_DOC_BYTES = 145000;

// Cap the in-memory undo history so a long session can't grow without bound.
const MAX_HISTORY = 50;

function estimateDocBytes(page, layout) {
    return new TextEncoder().encode(JSON.stringify({page, layout})).length;
}

export function useConfigDocument() {
    const globalConfig = useGlobalConfig();

    const rawPage = globalConfig.get(ConfigKey.PAGE);
    // Memoize so page/layout keep a stable identity while the stored value is
    // unchanged (otherwise the setPage/setLayout callbacks rebuild every render).
    const page = useMemo(() => {
        const baseDefaultPage = defaultPage();
        return {
            ...baseDefaultPage,
            ...(rawPage || {}),
            customSize: {...baseDefaultPage.customSize, ...((rawPage && rawPage.customSize) || {})},
        };
    }, [rawPage]);

    const rawLayout = globalConfig.get(ConfigKey.LAYOUT);
    // Hydrate against current defaults so a document written by an older schema
    // renders without every read site guarding for missing keys. Memoized on the
    // raw value so element identity stays stable across renders (preserves memo).
    const layout = useMemo(() => hydrateLayout(rawLayout), [rawLayout]);

    const isEditable = globalConfig.hasPermissionToSet();

    // In-memory undo/redo of prior {page, layout} snapshots. Ephemeral (cleared on
    // reload) — GlobalConfig keeps no history of its own. `docRef` holds the latest
    // committed doc so the write callbacks can snapshot it without stale-closure deps.
    const past = useRef([]);
    const future = useRef([]);
    const [, bumpHistory] = useState(0);
    const docRef = useRef({page, layout});
    docRef.current = {page, layout};

    // Snapshot the pre-change doc onto the undo stack and drop any redo branch.
    const pushUndo = useCallback(() => {
        past.current.push(docRef.current);
        if (past.current.length > MAX_HISTORY) {
            past.current.shift();
        }
        future.current = [];
        bumpHistory((n) => n + 1);
    }, []);

    const setPage = useCallback(
        (nextPage) => {
            if (estimateDocBytes(nextPage, docRef.current.layout) > MAX_DOC_BYTES) {
                return Promise.reject(new Error('DOC_TOO_LARGE'));
            }
            pushUndo();
            return globalConfig.setPathsAsync([
                {path: [ConfigKey.PAGE], value: nextPage},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
            ]);
        },
        [globalConfig, pushUndo],
    );

    const setLayout = useCallback(
        (nextLayout) => {
            if (estimateDocBytes(docRef.current.page, nextLayout) > MAX_DOC_BYTES) {
                return Promise.reject(new Error('DOC_TOO_LARGE'));
            }
            pushUndo();
            return globalConfig.setPathsAsync([
                {path: [ConfigKey.LAYOUT], value: nextLayout},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
            ]);
        },
        [globalConfig, pushUndo],
    );

    // Undo/redo restore a full {page, layout} snapshot (both keys) so the document
    // stays internally consistent regardless of which key the original change touched.
    const restore = useCallback(
        (snap) =>
            globalConfig.setPathsAsync([
                {path: [ConfigKey.PAGE], value: snap.page},
                {path: [ConfigKey.LAYOUT], value: snap.layout},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
            ]),
        [globalConfig],
    );

    const undo = useCallback(() => {
        if (!past.current.length) {
            return Promise.resolve();
        }
        const prev = past.current.pop();
        future.current.push(docRef.current);
        bumpHistory((n) => n + 1);
        return restore(prev);
    }, [restore]);

    const redo = useCallback(() => {
        if (!future.current.length) {
            return Promise.resolve();
        }
        const next = future.current.pop();
        past.current.push(docRef.current);
        bumpHistory((n) => n + 1);
        return restore(next);
    }, [restore]);

    return {
        page,
        layout,
        isEditable,
        setPage,
        setLayout,
        undo,
        redo,
        canUndo: past.current.length > 0,
        canRedo: future.current.length > 0,
    };
}
