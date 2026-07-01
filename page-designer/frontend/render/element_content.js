// Dispatches an element to its content renderer. Pure presentation: takes an
// element plus the (optional) record + table and renders the inner content only.
// Positioning/rotation is applied by PageCanvas via elementBoxStyle. Dynamic
// content (merge tokens, value formatting, conditional color) resolves here.

import {memo} from 'react';
import {FieldType} from '@airtable/blocks/interface/models';
import {ElementKind, LinkedRecordDisplay} from '../domain/element_types.mjs';
import {extractLinkedRecords} from '../domain/cell_value_helpers.mjs';
import {renderTemplate, formatValue, evaluateCondition, effectiveNumberFormat} from '../domain/dynamic_content.mjs';
import {textStyle} from './geometry_style.js';
import {ImageElement} from './image_element.js';
import {BarcodeElement} from './barcode_element.js';
import {LinkedRecordTable} from './linked_record_table.js';

// Evaluates an element's conditional rules against the current record. Returns
// whether it should show and an optional text-color override. No rules / no
// record (editor preview) = always visible, base color.
export function resolveElementRules(element, record, table) {
    const rules = element.rules;
    if (!rules || !record) {
        return {visible: true, colorOverride: null};
    }
    const valueOf = (cond) => {
        const f = cond && cond.fieldId ? table.getFieldByIdIfExists(cond.fieldId) : null;
        return f ? record.getCellValueAsString(f) : '';
    };
    const visible = rules.visibility ? evaluateCondition(rules.visibility, valueOf(rules.visibility)) : true;
    const colorOverride =
        rules.color && evaluateCondition(rules.color, valueOf(rules.color)) ? rules.color.color : null;
    return {visible, colorOverride};
}

function DeletedField() {
    return (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-red-red bg-red-redLight2 text-[11px] text-red-redDark1">
            Deleted field
        </div>
    );
}

// Linked records as a bulleted list (one record per line).
function LinkedRecordList({css, field, record}) {
    const names = record
        ? extractLinkedRecords(record.getCellValue(field)).map((r) => r.name)
        : [field.name]; // editor preview with no record
    return (
        <ul style={{...css, margin: 0, paddingLeft: '1.1em', listStyle: 'disc'}}>
            {names.map((name, i) => (
                <li key={i}>{name}</li>
            ))}
        </ul>
    );
}

function FieldText({element, css, record, table}) {
    const field = element.fieldId ? table.getFieldByIdIfExists(element.fieldId) : null;
    if (element.fieldId && !field) {
        return <DeletedField />;
    }
    const label = element.style.showFieldLabel && field ? field.name : null;
    const isLinked = field && field.type === FieldType.MULTIPLE_RECORD_LINKS;
    const linkedMode = element.style.linkedRecordDisplay || LinkedRecordDisplay.COMMA;

    let body;
    if (isLinked && linkedMode === LinkedRecordDisplay.TABLE) {
        body = <LinkedRecordTable element={element} field={field} record={record} table={table} />;
    } else if (isLinked && linkedMode === LinkedRecordDisplay.LIST) {
        body = <LinkedRecordList css={css} field={field} record={record} />;
    } else {
        let value = '';
        if (record && field) {
            const numberFormat = effectiveNumberFormat(
                element.style.numberFormat,
                field.type === FieldType.PERCENT,
            );
            value = formatValue(
                record.getCellValue(field),
                {...element.style, numberFormat},
                record.getCellValueAsString(field),
            );
        } else if (field) {
            // Editor preview with no record: show the field name so the layout reads.
            value = field.name;
        }
        body = <div style={css}>{value}</div>;
    }

    return (
        <div style={{width: '100%'}}>
            {label ? (
                <div
                    style={{
                        ...css,
                        fontSize: `${Math.max(9, element.style.fontSize * 0.7)}px`,
                        fontWeight: 'bold',
                        opacity: 0.6,
                        marginBottom: '2px',
                    }}
                >
                    {label}
                </div>
            ) : null}
            {body}
        </div>
    );
}

function StaticText({element, css, record, table}) {
    // Merge {Field Name} tokens. Preview (no record) shows the field name so the
    // layout still reads; an unknown field keeps its literal {token}.
    const resolve = (name) => {
        const f = table && table.getFieldByNameIfExists ? table.getFieldByNameIfExists(name) : null;
        if (!f) {
            return null;
        }
        return record ? record.getCellValueAsString(f) : name;
    };
    return <div style={css}>{renderTemplate(element.text || '', resolve)}</div>;
}

function Line({element}) {
    const thickness = Math.max(1, element.style.lineThickness || 1);
    const vertical = element.height > element.width;
    return (
        <div
            style={{
                width: vertical ? `${thickness}px` : '100%',
                height: vertical ? '100%' : `${thickness}px`,
                margin: 'auto',
                backgroundColor: element.style.lineColor || '#1d1f25',
            }}
        />
    );
}

// Memoized: layout ops preserve element identity for untouched elements, so a
// drag/edit only re-renders the element that actually changed (not all of them).
export const ElementContent = memo(function ElementContent({element, record, table, colorOverride}) {
    const css = textStyle(colorOverride ? {...element.style, color: colorOverride} : element.style);
    switch (element.kind) {
        case ElementKind.FIELD:
            return <FieldText element={element} css={css} record={record} table={table} />;
        case ElementKind.TEXT:
            return <StaticText element={element} css={css} record={record} table={table} />;
        case ElementKind.IMAGE:
            return <ImageElement element={element} record={record} table={table} />;
        case ElementKind.BARCODE:
        case ElementKind.QR_CODE:
            return <BarcodeElement element={element} record={record} table={table} />;
        case ElementKind.LINE:
            return <Line element={element} />;
        default:
            return null;
    }
});
