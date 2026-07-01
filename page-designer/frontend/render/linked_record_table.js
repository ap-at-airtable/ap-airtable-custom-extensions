// Renders a linked-record field as a table: one row per linked record, columns =
// the linked table's chosen fields. Loads the linked table via useRecords, so it
// is its own component (hooks run unconditionally here; ElementContent decides
// whether to mount it).

import {useBase, useRecords} from '@airtable/blocks/interface/ui';
import {extractLinkedRecords} from '../domain/cell_value_helpers.mjs';
import {columnFractions} from '../domain/layout_model.mjs';
import {textStyle} from './geometry_style.js';

export function LinkedRecordTable({element, field, record, table}) {
    const base = useBase();
    const linkedTableId = field.config && field.config.options ? field.config.options.linkedTableId : null;
    const linkedTable = linkedTableId ? base.getTableByIdIfExists(linkedTableId) : null;
    // Hooks must be unconditional — always pass a valid table (fall back to the
    // primary table; its records are ignored when there's no linked table).
    const linkedRecords = useRecords(linkedTable || table);

    const ts = textStyle(element.style);

    const columnIds =
        element.linkedColumns && element.linkedColumns.length
            ? element.linkedColumns
            : linkedTable
              ? [linkedTable.primaryField.id]
              : [];
    const columns = linkedTable
        ? columnIds.map((id) => linkedTable.getFieldByIdIfExists(id)).filter(Boolean)
        : [];

    // Fallback to comma names if the linked table or columns can't be resolved.
    if (!linkedTable || columns.length === 0) {
        const names = record
            ? extractLinkedRecords(record.getCellValue(field)).map((r) => r.name).join(', ')
            : field.name;
        return <div style={ts}>{names}</div>;
    }

    const recordById = new Map(linkedRecords.map((r) => [r.id, r]));
    const refs = record ? extractLinkedRecords(record.getCellValue(field)) : [];
    // Per-column widths (fractions) drive the <colgroup>; equal by default.
    const fractions = columnFractions(columns.map((c) => c.id), element.linkedColumnWidths);

    const cellStyle = {
        ...ts,
        border: '1px solid rgba(0,0,0,0.15)',
        padding: '2px 5px',
        textAlign: 'left',
        verticalAlign: 'top',
        overflowWrap: 'break-word',
    };
    const headStyle = {...cellStyle, fontWeight: 'bold', backgroundColor: element.style.tableHeaderColor};
    const stripeRows = !!element.style.tableStripeRows;
    const rowStyle = (i) => (stripeRows && i % 2 === 1 ? {backgroundColor: 'rgba(0,0,0,0.04)'} : undefined);

    return (
        // Per-column widths go on the first-row <th>, not a <colgroup>: a <col> width
        // updated after the initial layout isn't honored here, but the first-row cells
        // reliably drive the fixed layout.
        <table style={{...ts, borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed'}}>
            <thead>
                <tr>
                    {columns.map((col, i) => (
                        <th key={col.id} style={{...headStyle, width: `${fractions[i] * 100}%`}}>
                            {col.name}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {record ? (
                    refs.map((ref, rowIndex) => {
                        const linkedRecord = recordById.get(ref.id);
                        return (
                            <tr key={`${ref.id}-${rowIndex}`} style={rowStyle(rowIndex)}>
                                {columns.map((col, colIndex) => (
                                    <td key={col.id} style={cellStyle}>
                                        {linkedRecord
                                            ? linkedRecord.getCellValueAsString(col)
                                            : colIndex === 0
                                              ? ref.name
                                              : ''}
                                    </td>
                                ))}
                            </tr>
                        );
                    })
                ) : (
                    // Editor preview without a record: show one placeholder row.
                    <tr>
                        {columns.map((col) => (
                            <td key={col.id} style={cellStyle}>
                                {col.name}
                            </td>
                        ))}
                    </tr>
                )}
            </tbody>
        </table>
    );
}
