// Reads/writes the persisted design document via GlobalConfig.
// The document is a shared page geometry (`page`) plus a `pages` array, one entry
// per page of the document ({backgroundColor, layout}). Writes are optimistic;
// transient drag state lives in the editor and commits here on pointer-up.

import {useCallback, useMemo, useRef, useState} from 'react';
import {useGlobalConfig} from '@airtable/blocks/interface/ui';
import {ConfigKey, defaultPage, defaultPageEntry, SCHEMA_VERSION} from '../domain/config_keys.mjs';
import {hydratePages} from '../domain/layout_model.mjs';

// The whole document shares one ~150kB GlobalConfig ceiling.
const MAX_DOC_BYTES = 145000;
const MAX_HISTORY = 50;
const MAX_PAGES = 10;

function estimateDocBytes(page, pages) {
    return new TextEncoder().encode(JSON.stringify({page, pages})).length;
}

export function useConfigDocument() {
    const globalConfig = useGlobalConfig();

    const rawPage = globalConfig.get(ConfigKey.PAGE);
    // Shared page geometry, merged over defaults for stable identity.
    const page = useMemo(() => {
        const base = defaultPage();
        return {
            ...base,
            ...(rawPage || {}),
            customSize: {...base.customSize, ...((rawPage && rawPage.customSize) || {})},
        };
    }, [rawPage]);

    const rawPages = globalConfig.get(ConfigKey.PAGES);
    const rawLayout = globalConfig.get(ConfigKey.LAYOUT); // legacy v1
    // Hydrate + migrate v1 (single layout + page background) to the pages array.
    const pages = useMemo(
        () => hydratePages(rawPages, rawLayout, rawPage && rawPage.backgroundColor),
        [rawPages, rawLayout, rawPage],
    );

    const isEditable = globalConfig.hasPermissionToSet();

    // In-memory undo/redo over the whole {page, pages} document. `docRef` holds the
    // latest committed doc so callbacks snapshot it without stale-closure deps.
    const past = useRef([]);
    const future = useRef([]);
    const [, bumpHistory] = useState(0);
    const docRef = useRef({page, pages});
    docRef.current = {page, pages};

    const pushUndo = useCallback(() => {
        past.current.push(docRef.current);
        if (past.current.length > MAX_HISTORY) {
            past.current.shift();
        }
        future.current = [];
        bumpHistory((n) => n + 1);
    }, []);

    // Writes the pages array (and clears the legacy v1 layout key on first migration).
    const writePages = useCallback(
        (nextPages) => {
            if (estimateDocBytes(docRef.current.page, nextPages) > MAX_DOC_BYTES) {
                return Promise.reject(new Error('DOC_TOO_LARGE'));
            }
            return globalConfig.setPathsAsync([
                {path: [ConfigKey.PAGES], value: nextPages},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
                {path: [ConfigKey.LAYOUT], value: undefined},
            ]);
        },
        [globalConfig],
    );

    const setLayout = useCallback(
        (index, nextLayout) => {
            const next = docRef.current.pages.map((p, i) => (i === index ? {...p, layout: nextLayout} : p));
            pushUndo();
            return writePages(next);
        },
        [pushUndo, writePages],
    );

    const setBackground = useCallback(
        (index, backgroundColor) => {
            const next = docRef.current.pages.map((p, i) => (i === index ? {...p, backgroundColor} : p));
            pushUndo();
            return writePages(next);
        },
        [pushUndo, writePages],
    );

    const setPageGeometry = useCallback(
        (nextPage) => {
            if (estimateDocBytes(nextPage, docRef.current.pages) > MAX_DOC_BYTES) {
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

    const addPage = useCallback(() => {
        if (docRef.current.pages.length >= MAX_PAGES) {
            return Promise.resolve();
        }
        pushUndo();
        return writePages([...docRef.current.pages, defaultPageEntry()]);
    }, [pushUndo, writePages]);

    const removePage = useCallback(
        (index) => {
            if (docRef.current.pages.length <= 1) {
                return Promise.resolve();
            }
            pushUndo();
            return writePages(docRef.current.pages.filter((_, i) => i !== index));
        },
        [pushUndo, writePages],
    );

    const restore = useCallback(
        (snap) =>
            globalConfig.setPathsAsync([
                {path: [ConfigKey.PAGE], value: snap.page},
                {path: [ConfigKey.PAGES], value: snap.pages},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
                {path: [ConfigKey.LAYOUT], value: undefined},
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
        pages,
        maxPages: MAX_PAGES,
        isEditable,
        setLayout,
        setBackground,
        setPageGeometry,
        addPage,
        removePage,
        undo,
        redo,
        canUndo: past.current.length > 0,
        canRedo: future.current.length > 0,
    };
}
