import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ElementKind} from './element_types.mjs';
import {
    addNewElement,
    updateElement,
    removeElement,
    duplicateElement,
    cloneLayoutWithNewIds,
    getOrderedElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    clampElementToPage,
    clampGroupDelta,
    columnFractions,
    arrangeGrid,
    snapElement,
    pruneDeletedFieldElements,
    hydrateLayout,
    hydratePages,
} from './layout_model.mjs';
import {defaultLayout} from './config_keys.mjs';

let _seq = 0;
const idFactory = () => `id${++_seq}`;

function seededLayout() {
    _seq = 0;
    let layout = defaultLayout();
    ({layout} = addNewElement(layout, {kind: ElementKind.TEXT, x: 0, y: 0, idFactory}));
    ({layout} = addNewElement(layout, {kind: ElementKind.FIELD, x: 10, y: 10, fieldId: 'fld1', idFactory}));
    ({layout} = addNewElement(layout, {kind: ElementKind.IMAGE, x: 20, y: 20, fieldId: 'fld2', idFactory}));
    return layout;
}

test('addNewElement appends in order', () => {
    const layout = seededLayout();
    assert.deepEqual(layout.order, ['id1', 'id2', 'id3']);
    assert.equal(getOrderedElements(layout).length, 3);
    assert.equal(layout.elementsById.id2.fieldId, 'fld1');
});

test('hydrateLayout backfills missing style keys and defaults', () => {
    // A document written before newer style keys existed.
    const raw = {
        order: ['a'],
        elementsById: {a: {id: 'a', kind: ElementKind.FIELD, x: 5, y: 6, style: {fontSize: 40}}},
    };
    const layout = hydrateLayout(raw);
    assert.equal(layout.elementsById.a.style.fontSize, 40); // preserved
    assert.equal(layout.elementsById.a.style.color, '#1d1f25'); // backfilled default
    assert.equal(layout.elementsById.a.x, 5);
});

test('hydrateLayout drops orphans and corrupt entries', () => {
    const raw = {
        order: ['a', 'ghost', 'bad'],
        elementsById: {
            a: {id: 'a', kind: ElementKind.TEXT, x: 0, y: 0},
            bad: null,
        },
    };
    const layout = hydrateLayout(raw);
    assert.deepEqual(layout.order, ['a']);
    assert.equal(Object.keys(layout.elementsById).length, 1);
});

test('hydrateLayout returns an empty layout for a malformed document', () => {
    assert.deepEqual(hydrateLayout(null), {order: [], elementsById: {}});
    assert.deepEqual(hydrateLayout({order: 'nope'}), {order: [], elementsById: {}});
});

test('hydrateLayout preserves data from a newer schema (forward-compat)', () => {
    // A document written by a future version: unknown kind + unknown top-level and
    // style keys must survive so a round-trip through an older client is lossless.
    const raw = {
        order: ['a'],
        elementsById: {
            a: {
                id: 'a',
                kind: 'future_kind_v2',
                x: 1,
                y: 2,
                futureProp: 'keep me',
                style: {futureStyleKey: 'keep me too'},
            },
        },
    };
    const el = hydrateLayout(raw).elementsById.a;
    assert.equal(el.kind, 'future_kind_v2');
    assert.equal(el.futureProp, 'keep me');
    assert.equal(el.style.futureStyleKey, 'keep me too');
    assert.equal(el.style.color, '#1d1f25'); // still backfills current defaults
});

test('hydrateLayout sanitizes non-numeric geometry to 0', () => {
    const raw = {
        order: ['a'],
        elementsById: {a: {id: 'a', kind: ElementKind.TEXT, x: '50', y: undefined}},
    };
    const el = hydrateLayout(raw).elementsById.a;
    assert.equal(el.x, 0);
    assert.equal(el.y, 0);
});

test('clampGroupDelta keeps an in-bounds selection on the page', () => {
    const starts = [
        {id: 'a', x: 10, y: 10, width: 20, height: 20},
        {id: 'b', x: 40, y: 40, width: 20, height: 20},
    ];
    // Page 100x100: dragging right by 200 is capped so b's right edge stays <= 100.
    assert.deepEqual(clampGroupDelta(200, 0, starts, 100, 100), {sdx: 40, sdy: 0});
    // Dragging left past the left edge is capped so a's x stays >= 0.
    assert.deepEqual(clampGroupDelta(-200, 0, starts, 100, 100), {sdx: -10, sdy: 0});
    // A modest in-range move passes through untouched.
    assert.deepEqual(clampGroupDelta(5, 5, starts, 100, 100), {sdx: 5, sdy: 5});
});

test('hydratePages normalizes a v2 pages array', () => {
    const raw = [
        {backgroundColor: '#eee', layout: {order: ['a'], elementsById: {a: {id: 'a', kind: ElementKind.TEXT, x: 0, y: 0}}}},
        {layout: {order: [], elementsById: {}}},
    ];
    const pages = hydratePages(raw, null, null);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].backgroundColor, '#eee');
    assert.equal(pages[0].layout.elementsById.a.style.color, '#1d1f25'); // hydrated
    assert.equal(pages[1].backgroundColor, '#ffffff'); // defaulted
});

test('hydratePages migrates a v1 doc (single layout + page background)', () => {
    const legacyLayout = {order: ['a'], elementsById: {a: {id: 'a', kind: ElementKind.FIELD, x: 5, y: 6}}};
    const pages = hydratePages(undefined, legacyLayout, '#abcdef');
    assert.equal(pages.length, 1);
    assert.equal(pages[0].backgroundColor, '#abcdef');
    assert.equal(pages[0].layout.order[0], 'a');
    assert.equal(pages[0].layout.elementsById.a.x, 5);
});

test('hydratePages always returns at least one page', () => {
    const pages = hydratePages(undefined, null, undefined);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].layout, {order: [], elementsById: {}});
    assert.equal(pages[0].backgroundColor, '#ffffff');
});

test('columnFractions: equal by default, normalized, missing cols share equally', () => {
    assert.deepEqual(columnFractions([], {}), []);
    assert.deepEqual(columnFractions(['a', 'b'], {}), [0.5, 0.5]);
    assert.deepEqual(columnFractions(['a', 'b', 'c'], {a: 0.5, b: 0.25, c: 0.25}), [0.5, 0.25, 0.25]);
    // A missing column defaults to an equal share, then the whole set renormalizes.
    const r = columnFractions(['a', 'b'], {a: 0.6}); // b -> 0.5; sum 1.1
    assert.ok(Math.abs(r[0] - 0.6 / 1.1) < 1e-9 && Math.abs(r[1] - 0.5 / 1.1) < 1e-9);
});

test('arrangeGrid packs boxes top-to-bottom then wraps columns, no overlap', () => {
    const opts = {pageWidth: 200, pageHeight: 200, itemWidth: 60, itemHeight: 40, gap: 10, margin: 20};
    // Three fit in one column (y = 20, 70, 120; step 50 > height 40).
    assert.deepEqual(arrangeGrid(3, opts), [
        {x: 20, y: 20},
        {x: 20, y: 70},
        {x: 20, y: 120},
    ]);
    // A fourth wraps to the next column (x = 20 + 60 + 10 = 90).
    assert.deepEqual(arrangeGrid(5, opts), [
        {x: 20, y: 20},
        {x: 20, y: 70},
        {x: 20, y: 120},
        {x: 90, y: 20},
        {x: 90, y: 70},
    ]);
});

test('clampGroupDelta freezes an axis when an element already overflows', () => {
    // a overflows the right edge (90 + 40 = 130 > 100); b is in-bounds.
    const starts = [
        {id: 'a', x: 90, y: 5, width: 40, height: 10},
        {id: 'b', x: 10, y: 5, width: 20, height: 10},
    ];
    // Horizontal range inverts -> frozen (0) so the group can't be dragged off-page;
    // vertical is fine and still clamps normally.
    assert.deepEqual(clampGroupDelta(300, 3, starts, 100, 100), {sdx: 0, sdy: 3});
    assert.deepEqual(clampGroupDelta(-300, 0, starts, 100, 100), {sdx: 0, sdy: 0});
});

test('updateElement merges style without clobbering', () => {
    let layout = seededLayout();
    layout = updateElement(layout, 'id1', {x: 50, style: {fontSize: 24}});
    assert.equal(layout.elementsById.id1.x, 50);
    assert.equal(layout.elementsById.id1.style.fontSize, 24);
    assert.equal(layout.elementsById.id1.style.color, '#1d1f25'); // untouched
});

test('updateElement on missing id is a no-op', () => {
    const layout = seededLayout();
    assert.equal(updateElement(layout, 'nope', {x: 1}), layout);
});

test('removeElement drops from order and map', () => {
    let layout = seededLayout();
    layout = removeElement(layout, 'id2');
    assert.deepEqual(layout.order, ['id1', 'id3']);
    assert.equal(layout.elementsById.id2, undefined);
});

test('duplicateElement offsets and adds new id', () => {
    let layout = seededLayout();
    const {layout: next, element} = duplicateElement(layout, 'id1', idFactory);
    assert.equal(next.order.length, 4);
    assert.equal(element.x, layout.elementsById.id1.x + 20);
    assert.notEqual(element.id, 'id1');
});

test('hydrateLayout migrates legacy uniform padding to per-side keys', () => {
    const layout = hydrateLayout({
        order: ['a', 'b'],
        elementsById: {
            a: {id: 'a', kind: ElementKind.TEXT, style: {padding: 12}},
            // An explicit per-side value wins over the legacy uniform one.
            b: {id: 'b', kind: ElementKind.TEXT, style: {padding: 12, paddingTop: 3}},
        },
    });
    const a = layout.elementsById.a.style;
    assert.deepEqual(
        [a.paddingTop, a.paddingRight, a.paddingBottom, a.paddingLeft],
        [12, 12, 12, 12],
    );
    const b = layout.elementsById.b.style;
    assert.deepEqual([b.paddingTop, b.paddingRight], [3, 12]);
});

test('cloneLayoutWithNewIds copies order and elements with fresh ids', () => {
    const layout = seededLayout();
    _seq = 100;
    const clone = cloneLayoutWithNewIds(layout, idFactory);
    assert.equal(clone.order.length, layout.order.length);
    for (let i = 0; i < clone.order.length; i += 1) {
        const src = layout.elementsById[layout.order[i]];
        const copy = clone.elementsById[clone.order[i]];
        assert.notEqual(copy.id, src.id);
        assert.equal(copy.kind, src.kind);
        assert.equal(copy.x, src.x);
        assert.equal(copy.fieldId, src.fieldId);
        // Mutable containers must not be shared with the source element.
        assert.notEqual(copy.style, src.style);
        assert.notEqual(copy.linkedColumns, src.linkedColumns);
        assert.notEqual(copy.linkedColumnWidths, src.linkedColumnWidths);
    }
    assert.deepEqual(layout.order, ['id1', 'id2', 'id3'], 'source layout untouched');
});

test('z-order operations', () => {
    let layout = seededLayout();
    layout = bringToFront(layout, 'id1');
    assert.deepEqual(layout.order, ['id2', 'id3', 'id1']);
    layout = sendToBack(layout, 'id1');
    assert.deepEqual(layout.order, ['id1', 'id2', 'id3']);
    layout = bringForward(layout, 'id1');
    assert.deepEqual(layout.order, ['id2', 'id1', 'id3']);
    layout = sendBackward(layout, 'id1');
    assert.deepEqual(layout.order, ['id1', 'id2', 'id3']);
});

test('clampElementToPage keeps box in bounds', () => {
    const clamped = clampElementToPage({x: -10, y: 500, width: 1000, height: 50}, 600, 400);
    assert.equal(clamped.x, 0);
    assert.equal(clamped.width, 600);
    assert.equal(clamped.y, 350);
});

test('snapElement snaps geometry', () => {
    const snapped = snapElement({x: 13, y: 16, width: 23, height: 7}, 10);
    assert.deepEqual(
        {x: snapped.x, y: snapped.y, width: snapped.width, height: snapped.height},
        {x: 10, y: 20, width: 20, height: 10},
    );
});

test('pruneDeletedFieldElements removes bindings to missing fields', () => {
    const layout = seededLayout();
    const pruned = pruneDeletedFieldElements(layout, (fid) => fid === 'fld1');
    // id2 binds fld1 (kept), id3 binds fld2 (removed), id1 is static text (kept).
    assert.deepEqual(pruned.order, ['id1', 'id2']);
});
