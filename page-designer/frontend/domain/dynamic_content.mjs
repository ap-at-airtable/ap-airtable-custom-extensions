// Merge-field templating: replace {Field Name} tokens with record values. Pure
// (no SDK/React) so it's unit-testable and shared by the render layer.

// Replace {Field Name} tokens using resolve(name) -> string | null. An unknown
// field returns null and the literal token is kept, so a typo is visible rather
// than silently blank.
// Resolver for {Field name} tokens: the field's display string; the field NAME
// when there's no record (editor preview keeps the layout readable); null for an
// unknown field so renderTemplate keeps the literal token. Shared by the renderer
// and the memo-key computation so the two can never drift.
export function makeFieldTokenResolver(table, record) {
    return (name) => {
        const f = table && table.getFieldByNameIfExists ? table.getFieldByNameIfExists(name) : null;
        if (!f) {
            return null;
        }
        return record ? record.getCellValueAsString(f) : name;
    };
}

export function renderTemplate(text, resolve) {
    if (typeof text !== 'string') {
        return '';
    }
    return text.replace(/\{([^{}]+)\}/g, (match, rawName) => {
        const value = resolve(rawName.trim());
        return value == null ? match : value;
    });
}
