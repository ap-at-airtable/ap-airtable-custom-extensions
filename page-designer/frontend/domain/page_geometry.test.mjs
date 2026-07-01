import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    PageType,
    PageOrientation,
    DPI,
    convertLengthFromInchesToPx,
    getStandardPageSizePx,
    resolvePageSizePx,
    snapToGrid,
} from './page_geometry.mjs';

test('inch to px uses DPI', () => {
    assert.equal(convertLengthFromInchesToPx(1), DPI);
    assert.equal(convertLengthFromInchesToPx(2), DPI * 2);
});

test('letter portrait size, height floored', () => {
    const {width, height} = getStandardPageSizePx(PageType.LETTER, PageOrientation.PORTRAIT);
    assert.equal(width, 8.5 * DPI);
    assert.equal(height, Math.floor(11 * DPI));
});

test('landscape flips dimensions', () => {
    const portrait = getStandardPageSizePx(PageType.LETTER, PageOrientation.PORTRAIT);
    const landscape = getStandardPageSizePx(PageType.LETTER, PageOrientation.LANDSCAPE);
    assert.equal(landscape.width, portrait.height + (11 * DPI - Math.floor(11 * DPI)));
    // width(landscape) derives from the unfloored height; height(landscape) floors the width.
    assert.equal(landscape.height, Math.floor(8.5 * DPI));
});

test('resolvePageSizePx honors custom size', () => {
    const size = resolvePageSizePx({type: PageType.CUSTOM, customSize: {width: 300, height: 400}});
    assert.deepEqual(size, {width: 300, height: 400});
});

test('resolvePageSizePx falls back to standard', () => {
    const size = resolvePageSizePx({type: PageType.A4, orientation: PageOrientation.PORTRAIT});
    assert.ok(size.width > 0 && size.height > 0);
});

test('snapToGrid rounds to nearest grid', () => {
    assert.equal(snapToGrid(13, 10), 10);
    assert.equal(snapToGrid(16, 10), 20);
    assert.equal(snapToGrid(25, 10), 30);
});
