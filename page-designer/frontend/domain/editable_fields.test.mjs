import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    editableInputKind,
    isEditableFieldType,
    coerceEditableValue,
    isoToInputValue,
    inputValueToIso,
} from './editable_fields.mjs';

test('editableInputKind maps supported field types', () => {
    assert.equal(editableInputKind('singleLineText'), 'text');
    assert.equal(editableInputKind('email'), 'text');
    assert.equal(editableInputKind('multilineText'), 'textarea');
    assert.equal(editableInputKind('number'), 'number');
    assert.equal(editableInputKind('currency'), 'number');
    assert.equal(editableInputKind('singleSelect'), 'select');
    assert.equal(editableInputKind('checkbox'), 'checkbox');
    assert.equal(editableInputKind('date'), 'date');
    assert.equal(editableInputKind('dateTime'), 'datetime');
    assert.equal(editableInputKind('rating'), 'rating');
    assert.equal(editableInputKind('multipleSelects'), 'multiselect');
    assert.equal(editableInputKind('singleCollaborator'), 'collaborator');
    assert.equal(editableInputKind('multipleCollaborators'), 'multicollaborator');
});

test('editableInputKind returns null for unsupported types', () => {
    assert.equal(editableInputKind('multipleRecordLinks'), null);
    assert.equal(editableInputKind('multipleAttachments'), null);
    assert.equal(editableInputKind('formula'), null);
    assert.equal(isEditableFieldType('duration'), false);
    assert.equal(isEditableFieldType('singleLineText'), true);
    assert.equal(isEditableFieldType('rating'), true);
});

test('date <-> input value round-trips', () => {
    assert.equal(isoToInputValue('date', '2026-06-30'), '2026-06-30');
    assert.equal(isoToInputValue('date', '2026-06-30T12:00:00.000Z'), '2026-06-30');
    assert.equal(isoToInputValue('date', null), '');
    assert.equal(inputValueToIso('date', '2026-06-30'), '2026-06-30');
    assert.equal(inputValueToIso('date', ''), null);
    // datetime: parsing a local input value yields a valid ISO instant.
    const iso = inputValueToIso('datetime', '2026-06-30T09:30');
    assert.match(iso, /^2026-06-30T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(inputValueToIso('datetime', ''), null);
});

test('coerceEditableValue clears on empty and parses numbers', () => {
    assert.equal(coerceEditableValue('text', ''), null);
    assert.equal(coerceEditableValue('text', 'hi'), 'hi');
    assert.equal(coerceEditableValue('number', ''), null);
    assert.equal(coerceEditableValue('number', '  '), null);
    assert.equal(coerceEditableValue('number', '12.5'), 12.5);
    assert.equal(coerceEditableValue('number', 'abc'), null);
});
