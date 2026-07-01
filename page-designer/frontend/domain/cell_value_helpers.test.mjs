import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    extractAttachments,
    isImageAttachment,
    extractBarcodeText,
    extractSelectChoices,
    extractLinkedRecords,
    truncate,
} from './cell_value_helpers.mjs';

test('extractAttachments filters valid entries', () => {
    const out = extractAttachments([{url: 'a', filename: 'a.png'}, null, {filename: 'no-url'}]);
    assert.equal(out.length, 1);
    assert.equal(out[0].filename, 'a.png');
});

test('extractAttachments handles non-array', () => {
    assert.deepEqual(extractAttachments(null), []);
    assert.deepEqual(extractAttachments('x'), []);
});

test('isImageAttachment by mime and by extension', () => {
    assert.equal(isImageAttachment({type: 'image/png', filename: 'x'}), true);
    assert.equal(isImageAttachment({filename: 'photo.JPG'}), true);
    assert.equal(isImageAttachment({filename: 'doc.pdf'}), false);
    assert.equal(isImageAttachment(null), false);
});

test('extractBarcodeText from string and object', () => {
    assert.equal(extractBarcodeText('123'), '123');
    assert.equal(extractBarcodeText({text: '456', type: 'code128'}), '456');
    assert.equal(extractBarcodeText(null), '');
    assert.equal(extractBarcodeText({}), '');
});

test('extractSelectChoices for single and multi', () => {
    assert.deepEqual(extractSelectChoices({name: 'A', color: 'red'}), [{name: 'A', color: 'red'}]);
    assert.equal(extractSelectChoices([{name: 'A'}, {name: 'B'}]).length, 2);
    assert.deepEqual(extractSelectChoices(null), []);
});

test('extractLinkedRecords keeps every link, name optional', () => {
    assert.deepEqual(extractLinkedRecords([{id: 'r1', name: 'A'}, {id: 'r2', name: 'B'}]), [
        {id: 'r1', name: 'A'},
        {id: 'r2', name: 'B'},
    ]);
    assert.deepEqual(extractLinkedRecords(null), []);
    // A link whose primary value is empty has no name but must NOT be dropped.
    assert.deepEqual(extractLinkedRecords([{id: 'r1'}]), [{id: 'r1', name: ''}]);
});

test('truncate adds ellipsis past max', () => {
    assert.equal(truncate('hello', 10), 'hello');
    assert.equal(truncate('hello world', 5), 'hell…');
    assert.equal(truncate(null, 5), '');
});
