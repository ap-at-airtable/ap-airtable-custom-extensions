import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editableInputKind, isEditableFieldType, coerceEditableValue} from './editable_fields.mjs';

test('editableInputKind maps supported field types', () => {
    assert.equal(editableInputKind('singleLineText'), 'text');
    assert.equal(editableInputKind('email'), 'text');
    assert.equal(editableInputKind('multilineText'), 'textarea');
    assert.equal(editableInputKind('number'), 'number');
    assert.equal(editableInputKind('currency'), 'number');
    assert.equal(editableInputKind('singleSelect'), 'select');
    assert.equal(editableInputKind('checkbox'), 'checkbox');
});

test('editableInputKind returns null for unsupported types', () => {
    assert.equal(editableInputKind('multipleRecordLinks'), null);
    assert.equal(editableInputKind('multipleAttachments'), null);
    assert.equal(editableInputKind('formula'), null);
    assert.equal(isEditableFieldType('date'), false);
    assert.equal(isEditableFieldType('singleLineText'), true);
});

test('coerceEditableValue clears on empty and parses numbers', () => {
    assert.equal(coerceEditableValue('text', ''), null);
    assert.equal(coerceEditableValue('text', 'hi'), 'hi');
    assert.equal(coerceEditableValue('number', ''), null);
    assert.equal(coerceEditableValue('number', '  '), null);
    assert.equal(coerceEditableValue('number', '12.5'), 12.5);
    assert.equal(coerceEditableValue('number', 'abc'), null);
});
