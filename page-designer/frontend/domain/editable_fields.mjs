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
    if (fieldType === 'date') return 'date';
    if (fieldType === 'dateTime') return 'datetime';
    if (fieldType === 'rating') return 'rating';
    if (fieldType === 'multipleSelects') return 'multiselect';
    if (fieldType === 'singleCollaborator') return 'collaborator';
    if (fieldType === 'multipleCollaborators') return 'multicollaborator';
    return null;
}

export function isEditableFieldType(fieldType) {
    return editableInputKind(fieldType) !== null;
}

// Coerces a raw text/number input string into the cell value updateRecordAsync
// expects. Empty clears the cell (null). Other kinds carry structured values and
// are handled at the call site.
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

// Airtable date cell values are ISO strings. Convert to/from the value an
// <input type="date"|"datetime-local"> expects (local wall-clock for datetime).
// Limitation: datetime edits use the viewer's browser zone; a dateTime field with
// a fixed configured timeZone will show/save shifted wall-clock (the instant is
// still correct). Fine for client-zoned fields (the common case).
export function isoToInputValue(kind, iso) {
    if (!iso) return '';
    if (kind === 'date') return String(iso).slice(0, 10);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function inputValueToIso(kind, value) {
    if (!value) return null;
    if (kind === 'date') return value; // 'YYYY-MM-DD' is already a valid date cell value
    const d = new Date(value); // datetime-local parses as local time
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
