// Dispatches an element to its content renderer. Pure presentation: takes an
// element plus the (optional) record + table and renders the inner content only.
// Positioning/rotation is applied by PageCanvas via elementBoxStyle. Dynamic
// content (merge tokens, value formatting, conditional color) resolves here.

import {memo} from 'react';
import {FieldType} from '@airtable/blocks/interface/models';
import {colorUtils} from '@airtable/blocks/interface/ui';
import {ElementKind, LinkedRecordDisplay} from '../domain/element_types.mjs';
import {extractLinkedRecords, extractSelectChoices} from '../domain/cell_value_helpers.mjs';
import {renderTemplate, formatValue, evaluateCondition, effectiveNumberFormat} from '../domain/dynamic_content.mjs';
import {textStyle} from './geometry_style.js';
import {ImageElement} from './image_element.js';
import {BarcodeElement} from './barcode_element.js';
import {LinkedRecordTable} from './linked_record_table.js';
import {EditableField} from './editable_field.js';
import {editableInputKind} from '../domain/editable_fields.mjs';

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

// Black or white text depending on how light the pill background is.
function readableTextColor(hex) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
    if (!m) {
        return '#1d1f25';
    }
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1d1f25' : '#ffffff';
}

// Resolve a choice's hex: prefer the color on the cell value, else look it up in
// the field's choice config. Returns null if the choice has no color.
function choiceHex(field, choice) {
    let color = choice.color;
    if (!color) {
        const choices = (field.config && field.config.options && field.config.options.choices) || [];
        const match = choices.find((c) => c.id === choice.id) || choices.find((c) => c.name === choice.name);
        color = match && match.color;
    }
    return color ? colorUtils.getHexForColor(color) : null;
}

const TEXT_ALIGN_TO_JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};

// Renders single/multi-select choices as colored pills (chips) respecting each
// choice's color. Editor preview (no record) shows the field name as a neutral pill.
function SelectPills({field, record, css}) {
    const choices = record ? extractSelectChoices(record.getCellValue(field)) : [{name: field.name}];
    return (
        <div
            style={{
                ...css,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                justifyContent: TEXT_ALIGN_TO_JUSTIFY[css.textAlign] || 'flex-start',
            }}
        >
            {choices.map((c, i) => {
                const hex = choiceHex(field, c) || '#e5e7eb';
                return (
                    <span
                        key={i}
                        style={{
                            backgroundColor: hex,
                            color: readableTextColor(hex),
                            borderRadius: '999px',
                            // em-based so the breathing room scales with the font; the
                            // rounded ends need extra horizontal room so text isn't cramped.
                            padding: '0.3em 0.9em',
                            fontSize: css.fontSize,
                            fontFamily: css.fontFamily,
                            lineHeight: 1.45,
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {c.name}
                    </span>
                );
            })}
        </div>
    );
}

function FieldText({element, css, record, table, interactive}) {
    const field = element.fieldId ? table.getFieldByIdIfExists(element.fieldId) : null;
    if (element.fieldId && !field) {
        return <DeletedField />;
    }
    const label = element.style.showFieldLabel && field ? field.name : null;
    const isLinked = field && field.type === FieldType.MULTIPLE_RECORD_LINKS;
    const linkedMode = element.style.linkedRecordDisplay || LinkedRecordDisplay.COMMA;
    const isSelectPill =
        field && field.type === FieldType.SINGLE_SELECT && element.style.selectDisplay === 'pill';
    const isInlineEditable =
        interactive && record && field && element.style.editable && editableInputKind(field.type);

    let body;
    if (isInlineEditable) {
        body = <EditableField field={field} record={record} table={table} css={css} />;
    } else if (isLinked && linkedMode === LinkedRecordDisplay.TABLE) {
        body = (
            <LinkedRecordTable
                element={element}
                field={field}
                record={record}
                table={table}
                editable={!!(interactive && record && element.style.editable)}
            />
        );
    } else if (isLinked && linkedMode === LinkedRecordDisplay.LIST) {
        body = <LinkedRecordList css={css} field={field} record={record} />;
    } else if (isSelectPill) {
        body = <SelectPills field={field} record={record} css={css} />;
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
export const ElementContent = memo(function ElementContent({element, record, table, colorOverride, eagerImages, interactive}) {
    const css = textStyle(colorOverride ? {...element.style, color: colorOverride} : element.style);
    switch (element.kind) {
        case ElementKind.FIELD:
            return <FieldText element={element} css={css} record={record} table={table} interactive={interactive} />;
        case ElementKind.TEXT:
            return <StaticText element={element} css={css} record={record} table={table} />;
        case ElementKind.IMAGE:
            return <ImageElement element={element} record={record} table={table} eager={eagerImages} />;
        case ElementKind.BARCODE:
        case ElementKind.QR_CODE:
            return <BarcodeElement element={element} record={record} table={table} />;
        case ElementKind.LINE:
            return <Line element={element} />;
        default:
            return null;
    }
});
