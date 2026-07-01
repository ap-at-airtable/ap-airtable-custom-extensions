import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ElementKind} from './element_types.mjs';
import {
    addNewElement,
    updateElement,
    removeElement,
    duplicateElement,
    getOrderedElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    clampElementToPage,
    clampGroupDelta,
    snapElement,
    pruneDeletedFieldElements,
    hydrateLayout,
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
    assert.equal(layout.elementsById.a.rules, null); // field added later
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
