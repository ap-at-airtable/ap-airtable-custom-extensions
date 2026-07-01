// Classifies which field types support inline editing in view mode and how their
// value should be coerced for updateRecordAsync. Pure (string field-type values,
// which match FieldType enum values) so it stays node --test friendly.

const TEXT_TYPES = ['singleLineText', 'email', 'url', 'phoneNumber'];
const NUMBER_TYPES = ['number', 'percent', 'currency'];

// Returns the input control to render for a field type, or null if not editable.
export function editableInputKind(fieldType) {
    if (TEXT_TYPES.includes(fieldType)) return 'text';
    if (fieldType === 'multilineText') return 'textarea';
    if (NUMBER_TYPES.includes(fieldType)) return 'number';
    if (fieldType === 'singleSelect') return 'select';
    if (fieldType === 'checkbox') return 'checkbox';
    return null;
}

export function isEditableFieldType(fieldType) {
    return editableInputKind(fieldType) !== null;
}

// Coerces a raw text/number input string into the cell value updateRecordAsync
// expects. Empty clears the cell (null). Select/checkbox are handled at the call
// site (they carry structured values, not a text string).
export function coerceEditableValue(kind, raw) {
    if (kind === 'text' || kind === 'textarea') {
        return raw === '' ? null : raw;
    }
    if (kind === 'number') {
        if (raw.trim() === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    return raw;
}
