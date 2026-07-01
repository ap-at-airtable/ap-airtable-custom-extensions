// Custom properties surfaced in the Interface Designer properties panel.
// Defined at module scope for a stable identity (required by useCustomProperties).
//
// The records to render come from the host query container via useRecords(table).
// We still expose a `table` custom property so the builder can confirm/override
// which table the design binds to (and so the extension works outside a strict
// single-table container).

export function getCustomProperties(base) {
    return [
        {
            key: 'title',
            label: 'Title (optional)',
            type: 'string',
            defaultValue: '',
        },
        {
            key: 'table',
            label: 'Table',
            type: 'table',
            defaultValue: base.tables[0],
        },
    ];
}

export const CustomPropertyKey = {
    TITLE: 'title',
    TABLE: 'table',
};
