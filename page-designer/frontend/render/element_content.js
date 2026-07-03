// Dispatches an element to its content renderer. Pure presentation: takes an
// element plus the (optional) record + table and renders the inner content only.
// Positioning/rotation is applied by PageCanvas via elementBoxStyle. Merge tokens
// ({Field name}) resolve here.

import {memo} from 'react';
import {FieldType} from '@airtable/blocks/interface/models';
import {ElementKind, LinkedRecordDisplay} from '../domain/element_types.mjs';
import {extractLinkedRecords, extractSelectChoices} from '../domain/cell_value_helpers.mjs';
import {renderTemplate} from '../domain/dynamic_content.mjs';
import {textStyle} from './geometry_style.js';
import {ImageElement} from './image_element.js';
import {BarcodeElement} from './barcode_element.js';
import {LinkedRecordTable} from './linked_record_table.js';
import {EditableField} from './editable_field.js';
import {ChoicePill} from './select_pill.js';
import {SelectStepper, MAX_STEPPER_STEPS} from './select_stepper.js';
import {RatingDisplay, CheckboxDisplay, CollaboratorDisplay} from './field_display.js';
import {editableInputKind} from '../domain/editable_fields.mjs';

// A stepper with too many choices degrades into overlapping circles; render
// those fields as pills instead.
function stepperFits(field) {
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    return choices.length <= MAX_STEPPER_STEPS;
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

const TEXT_ALIGN_TO_JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};

// Renders single/multi-select choices as colored pills (chips). Editor preview
// (no record) shows the field name as a neutral pill.
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
            {choices.map((c, i) => (
                <ChoicePill key={i} field={field} choice={c} css={css} />
            ))}
        </div>
    );
}

function FieldText({element, css, record, table, interactive, editor}) {
    const field = element.fieldId ? table.getFieldByIdIfExists(element.fieldId) : null;
    if (element.fieldId && !field) {
        // A bound field was deleted. Flag it in the editor so the builder can re-bind;
        // published viewers/print see nothing rather than a red error box.
        return editor ? <DeletedField /> : null;
    }
    const label = element.style.showFieldLabel && field ? field.name : null;
    const isLinked = field && field.type === FieldType.MULTIPLE_RECORD_LINKS;
    const linkedMode = element.style.linkedRecordDisplay || LinkedRecordDisplay.COMMA;
    const isSelectField =
        field && (field.type === FieldType.SINGLE_SELECT || field.type === FieldType.MULTIPLE_SELECTS);
    const selectMode = isSelectField ? element.style.selectDisplay || 'text' : null;
    const isSelectPill = selectMode === 'pill';
    // Stepper is single-select only.
    const isStepper = selectMode === 'stepper' && field.type === FieldType.SINGLE_SELECT;
    // Field types that render a glyph (not text) when not being edited inline.
    const fieldKind = field ? editableInputKind(field.type) : null;
    const isRating = fieldKind === 'rating';
    const isCheckbox = fieldKind === 'checkbox';
    const isCollaborator = fieldKind === 'collaborator' || fieldKind === 'multicollaborator';
    const isInlineEditable =
        interactive && record && field && element.style.editable && editableInputKind(field.type);

    let body;
    if (isInlineEditable) {
        body = (
            <EditableField
                field={field}
                record={record}
                table={table}
                css={css}
                selectDisplay={selectMode || 'text'}
                stepperVariant={element.style.stepperVariant || 'radio'}
            />
        );
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
    } else if (isStepper && stepperFits(field)) {
        body = (
            <SelectStepper
                field={field}
                record={record}
                css={css}
                variant={element.style.stepperVariant || 'radio'}
            />
        );
    } else if (isStepper) {
        // Too many choices for a readable stepper: degrade to the pill display.
        body = <SelectPills field={field} record={record} css={css} />;
    } else if (isRating) {
        body = <RatingDisplay field={field} record={record} css={css} />;
    } else if (isCheckbox) {
        body = <CheckboxDisplay field={field} record={record} css={css} />;
    } else if (isCollaborator) {
        body = <CollaboratorDisplay field={field} record={record} css={css} />;
    } else {
        // Inherit the field's own formatting (currency symbol, percent, decimals,
        // date format) via getCellValueAsString. No record = editor preview: show the
        // field name so the layout reads.
        const value = record && field ? record.getCellValueAsString(field) : field ? field.name : '';
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
export const ElementContent = memo(function ElementContent({element, record, table, eagerImages, interactive, editor}) {
    const css = textStyle(element.style);
    switch (element.kind) {
        case ElementKind.FIELD:
            return <FieldText element={element} css={css} record={record} table={table} interactive={interactive} editor={editor} />;
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
