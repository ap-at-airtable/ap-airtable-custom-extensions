// Pure operations over a layout document ({order, elementsById}). Every function
// returns a NEW layout (immutable) so it composes cleanly with React state and
// is trivially testable. No SDK, no React.

import {makeElement, hydrateElement, kindUsesField} from './element_types.mjs';
import {PAGE_GRID_SIZE, snapToGrid} from './page_geometry.mjs';

// Deterministic-enough id generator. Kept short to conserve GlobalConfig space
// (150kB / 1000-key budget). `seq` makes it injectable for tests.
let _counter = 0;
export function generateElementId() {
    _counter += 1;
    const rand = Math.floor(Math.random() * 1e9).toString(36);
    return `e${_counter.toString(36)}${rand}`;
}

export function getOrderedElements(layout) {
    return layout.order.map((id) => layout.elementsById[id]).filter(Boolean);
}

// Read-time normalizer for a persisted layout: validates the shape, hydrates each
// element against current defaults, and drops orphans (order ids with no element,
// elements missing from order) so downstream code can trust {order, elementsById}.
export function hydrateLayout(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.order) || !raw.elementsById) {
        return {order: [], elementsById: {}};
    }
    const elementsById = {};
    const order = [];
    for (const id of raw.order) {
        const el = hydrateElement(raw.elementsById[id]);
        if (el && el.id === id && !elementsById[id]) {
            elementsById[id] = el;
            order.push(id);
        }
    }
    return {order, elementsById};
}

export function addElement(layout, element) {
    return {
        order: [...layout.order, element.id],
        elementsById: {...layout.elementsById, [element.id]: element},
    };
}

export function addNewElement(layout, {kind, x, y, fieldId = null, idFactory = generateElementId}) {
    const element = makeElement({id: idFactory(), kind, x, y, fieldId});
    return {layout: addElement(layout, element), element};
}

export function updateElement(layout, id, patch) {
    const existing = layout.elementsById[id];
    if (!existing) {
        return layout;
    }
    const next = {
        ...existing,
        ...patch,
        style: patch.style ? {...existing.style, ...patch.style} : existing.style,
    };
    return {order: layout.order, elementsById: {...layout.elementsById, [id]: next}};
}

// Apply a {id: patch} map in one pass (multi-select move/align/distribute).
export function updateElements(layout, patchesById) {
    let next = layout;
    for (const [id, patch] of Object.entries(patchesById)) {
        next = updateElement(next, id, patch);
    }
    return next;
}

export function removeElement(layout, id) {
    if (!layout.elementsById[id]) {
        return layout;
    }
    const elementsById = {...layout.elementsById};
    delete elementsById[id];
    return {order: layout.order.filter((eid) => eid !== id), elementsById};
}

export function duplicateElement(layout, id, idFactory = generateElementId) {
    const src = layout.elementsById[id];
    if (!src) {
        return {layout, element: null};
    }
    const clone = {
        ...src,
        id: idFactory(),
        x: src.x + PAGE_GRID_SIZE * 2,
        y: src.y + PAGE_GRID_SIZE * 2,
        style: {...src.style},
    };
    return {layout: addElement(layout, clone), element: clone};
}

// Z-order: order array is back-to-front (last = topmost).
function reorder(layout, id, toIndex) {
    if (!layout.elementsById[id]) {
        return layout;
    }
    const without = layout.order.filter((eid) => eid !== id);
    const clamped = Math.max(0, Math.min(toIndex, without.length));
    without.splice(clamped, 0, id);
    return {order: without, elementsById: layout.elementsById};
}

export function bringToFront(layout, id) {
    return reorder(layout, id, layout.order.length);
}

export function sendToBack(layout, id) {
    return reorder(layout, id, 0);
}

export function bringForward(layout, id) {
    const idx = layout.order.indexOf(id);
    return idx < 0 ? layout : reorder(layout, id, idx + 1);
}

export function sendBackward(layout, id) {
    const idx = layout.order.indexOf(id);
    return idx <= 0 ? layout : reorder(layout, id, idx - 1);
}

// Read-time normalizer + v1→v2 migration for the pages array. v2 stores
// `pages: [{backgroundColor, layout}]`; v1 stored a single `layout` + a page-level
// background, which becomes a one-entry array. Always returns at least one page.
export function hydratePages(rawPages, legacyLayout, legacyBackground) {
    const toEntry = (bg, layout) => ({
        backgroundColor: typeof bg === 'string' ? bg : '#ffffff',
        layout: hydrateLayout(layout),
    });
    if (Array.isArray(rawPages) && rawPages.length > 0) {
        const entries = rawPages
            .filter((p) => p && typeof p === 'object')
            .map((p) => toEntry(p.backgroundColor, p.layout));
        return entries.length > 0 ? entries : [toEntry(undefined, null)];
    }
    return [toEntry(legacyBackground, legacyLayout)];
}

// Non-overlapping positions for `count` equal-size boxes: packed top-to-bottom
// from the top-left margin, wrapping into the next column when a column is full.
// Used when adding several elements at once so they never stack on top of each
// other. Pure/testable. If there are more than fit on the page, the overflow
// column is clamped on-page (rare extreme case).
export function arrangeGrid(
    count,
    {pageWidth, pageHeight, itemWidth, itemHeight, gap = PAGE_GRID_SIZE, margin = PAGE_GRID_SIZE * 2, startY = null},
) {
    const positions = [];
    const top = startY == null ? margin : startY;
    const usableBottom = pageHeight - margin;
    const lastColumnX = Math.max(margin, pageWidth - margin - itemWidth);
    let x = margin;
    let y = top;
    for (let i = 0; i < count; i += 1) {
        if (y + itemHeight > usableBottom && y > top) {
            x += itemWidth + gap;
            y = top;
        }
        positions.push({x: Math.min(x, lastColumnX), y});
        y += itemHeight + gap;
    }
    return positions;
}

// Clamps a rigid-group translation (sdx, sdy in page px) so no element in the
// selection leaves the page. `starts` are the pre-move element boxes. If an element
// already overflows the page (e.g. the page was shrunk after placement) the feasible
// range inverts; that axis is frozen (0) so a drag can't push the whole group
// off-page. The stray element is repositioned via single-select or the inspector.
export function clampGroupDelta(sdx, sdy, starts, pageWidth, pageHeight) {
    const minDx = -Math.min(...starts.map((s) => s.x));
    const maxDx = Math.min(...starts.map((s) => pageWidth - s.width - s.x));
    const minDy = -Math.min(...starts.map((s) => s.y));
    const maxDy = Math.min(...starts.map((s) => pageHeight - s.height - s.y));
    return {
        sdx: maxDx >= minDx ? Math.min(maxDx, Math.max(minDx, sdx)) : 0,
        sdy: maxDy >= minDy ? Math.min(maxDy, Math.max(minDy, sdy)) : 0,
    };
}

// Clamps an element's box to stay within the page bounds.
export function clampElementToPage(element, pageWidth, pageHeight) {
    const width = Math.max(PAGE_GRID_SIZE, Math.min(element.width, pageWidth));
    const height = Math.max(PAGE_GRID_SIZE, Math.min(element.height, pageHeight));
    const x = Math.max(0, Math.min(element.x, pageWidth - width));
    const y = Math.max(0, Math.min(element.y, pageHeight - height));
    return {...element, x, y, width, height};
}

export function snapElement(element, grid = PAGE_GRID_SIZE) {
    return {
        ...element,
        x: snapToGrid(element.x, grid),
        y: snapToGrid(element.y, grid),
        width: Math.max(grid, snapToGrid(element.width, grid)),
        height: Math.max(grid, snapToGrid(element.height, grid)),
    };
}

// Drops elements that bind to a field that no longer exists in the table.
// `fieldExists` is a predicate so this stays pure/testable.
export function pruneDeletedFieldElements(layout, fieldExists) {
    let next = layout;
    for (const el of getOrderedElements(layout)) {
        if (kindUsesField(el.kind) && el.fieldId && !fieldExists(el.fieldId)) {
            next = removeElement(next, el.id);
        }
    }
    return next;
}
