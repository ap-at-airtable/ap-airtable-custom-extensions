// Reads/writes the persisted design document via GlobalConfig.
// The document is a shared page geometry (`page`) plus a `pages` array, one entry
// per page of the document ({backgroundColor, layout}). Writes are optimistic;
// transient drag state lives in the editor and commits here on pointer-up.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useGlobalConfig} from '@airtable/blocks/interface/ui';
import {ConfigKey, defaultPage, defaultPageEntry, SCHEMA_VERSION} from '../domain/config_keys.mjs';
import {cloneLayoutWithNewIds, hydratePages} from '../domain/layout_model.mjs';

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

    // Multiplayer guard: undo snapshots are only valid against our own writes.
    // Writers bump writeSeq; an echo of our own write reaches this effect with the
    // sequence advanced. A doc change with NO local write since the last look means
    // another builder (or tab) edited it - restoring a snapshot would silently
    // revert their work, so drop the history instead.
    const writeSeq = useRef(0);
    const seenSeq = useRef(0);
    useEffect(() => {
        if (writeSeq.current !== seenSeq.current) {
            seenSeq.current = writeSeq.current;
            return;
        }
        if (past.current.length || future.current.length) {
            past.current = [];
            future.current = [];
            bumpHistory((n) => n + 1);
        }
    }, [page, pages]);

    // One undo step per user action. A coalesceKey marks writes that stream from a
    // single continuous input (per-keystroke inspector edits): rapid same-key writes
    // share the first snapshot. Keyless writes (drags, adds, page ops) always get
    // their own step. New edits invalidate redo either way.
    const lastPushAt = useRef(0);
    const lastPushKey = useRef(null);
    const pushUndo = useCallback((coalesceKey) => {
        const now = Date.now();
        future.current = [];
        if (
            coalesceKey != null &&
            coalesceKey === lastPushKey.current &&
            now - lastPushAt.current < 1200 &&
            past.current.length > 0
        ) {
            bumpHistory((n) => n + 1);
            return;
        }
        lastPushAt.current = now;
        lastPushKey.current = coalesceKey ?? null;
        past.current.push(docRef.current);
        if (past.current.length > MAX_HISTORY) {
            past.current.shift();
        }
        bumpHistory((n) => n + 1);
    }, []);

    // Writes the pages array (and clears the legacy v1 layout key on first migration).
    // Owns the undo snapshot so it can never be pushed for a write the size guard
    // rejects (a polluted stack would light up Undo for a change that never saved).
    const writePages = useCallback(
        (nextPages, coalesceKey) => {
            if (estimateDocBytes(docRef.current.page, nextPages) > MAX_DOC_BYTES) {
                return Promise.reject(new Error('DOC_TOO_LARGE'));
            }
            pushUndo(coalesceKey);
            writeSeq.current += 1;
            return globalConfig.setPathsAsync([
                {path: [ConfigKey.PAGES], value: nextPages},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
                {path: [ConfigKey.LAYOUT], value: undefined},
            ]);
        },
        [globalConfig, pushUndo],
    );

    const setLayout = useCallback(
        (index, nextLayout, coalesceKey) => {
            const next = docRef.current.pages.map((p, i) => (i === index ? {...p, layout: nextLayout} : p));
            return writePages(next, coalesceKey);
        },
        [writePages],
    );

    const setBackground = useCallback(
        (index, backgroundColor) => {
            const next = docRef.current.pages.map((p, i) => (i === index ? {...p, backgroundColor} : p));
            return writePages(next, `bg:${index}`);
        },
        [writePages],
    );

    const setPageGeometry = useCallback(
        (nextPage) => {
            if (estimateDocBytes(nextPage, docRef.current.pages) > MAX_DOC_BYTES) {
                return Promise.reject(new Error('DOC_TOO_LARGE'));
            }
            pushUndo('geometry');
            writeSeq.current += 1;
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
        return writePages([...docRef.current.pages, defaultPageEntry()]);
    }, [writePages]);

    // Inserts a copy of pages[index] right after it. Elements get fresh ids so the
    // copy doesn't share undo-coalescing keys or selection with the source page.
    const duplicatePage = useCallback(
        (index) => {
            const pages = docRef.current.pages;
            const src = pages[index];
            if (!src || pages.length >= MAX_PAGES) {
                return Promise.resolve();
            }
            const copy = {...src, layout: cloneLayoutWithNewIds(src.layout)};
            const next = [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)];
            return writePages(next);
        },
        [writePages],
    );

    const removePage = useCallback(
        (index) => {
            if (docRef.current.pages.length <= 1) {
                return Promise.resolve();
            }
            return writePages(docRef.current.pages.filter((_, i) => i !== index));
        },
        [writePages],
    );

    const movePage = useCallback(
        (from, to) => {
            const pages = docRef.current.pages;
            if (to < 0 || to >= pages.length || from === to) {
                return Promise.resolve();
            }
            const next = pages.slice();
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return writePages(next);
        },
        [writePages],
    );

    const restore = useCallback(
        (snap) => {
            writeSeq.current += 1;
            return globalConfig.setPathsAsync([
                {path: [ConfigKey.PAGE], value: snap.page},
                {path: [ConfigKey.PAGES], value: snap.pages},
                {path: [ConfigKey.SCHEMA_VERSION], value: SCHEMA_VERSION},
                {path: [ConfigKey.LAYOUT], value: undefined},
            ]);
        },
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
        duplicatePage,
        removePage,
        movePage,
        undo,
        redo,
        canUndo: past.current.length > 0,
        canRedo: future.current.length > 0,
    };
}
