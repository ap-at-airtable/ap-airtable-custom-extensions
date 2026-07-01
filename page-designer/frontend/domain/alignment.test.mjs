import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alignElements, distributeElements, AlignMode, DistributeAxis} from './alignment.mjs';

const els = [
    {id: 'a', x: 0, y: 0, width: 100, height: 20},
    {id: 'b', x: 50, y: 40, width: 60, height: 40},
    {id: 'c', x: 200, y: 100, width: 80, height: 10},
];

test('alignElements left/right/centerH', () => {
    assert.deepEqual(alignElements(els, AlignMode.LEFT), {a: {x: 0}, b: {x: 0}, c: {x: 0}});
    // bbox right = max(0+100, 50+60, 200+80) = 280
    assert.deepEqual(alignElements(els, AlignMode.RIGHT), {a: {x: 180}, b: {x: 220}, c: {x: 200}});
    // bbox center x = (0 + 280)/2 = 140
    assert.deepEqual(alignElements(els, AlignMode.CENTER_H), {a: {x: 90}, b: {x: 110}, c: {x: 100}});
});

test('alignElements top', () => {
    assert.deepEqual(alignElements(els, AlignMode.TOP), {a: {y: 0}, b: {y: 0}, c: {y: 0}});
});

test('alignElements needs >= 2', () => {
    assert.deepEqual(alignElements([els[0]], AlignMode.LEFT), {});
});

test('distributeElements horizontal spaces evenly and anchors ends', () => {
    const out = distributeElements(els, DistributeAxis.HORIZONTAL);
    // span 0..280, total widths 240, gap = (280-240)/2 = 20
    assert.deepEqual(out, {a: {x: 0}, b: {x: 120}, c: {x: 200}});
    // a right edge 100, +gap 20 => b at 120; b right 180, +20 => c at 200 (== last)
});

test('distributeElements needs >= 3', () => {
    assert.deepEqual(distributeElements([els[0], els[1]], DistributeAxis.HORIZONTAL), {});
});
