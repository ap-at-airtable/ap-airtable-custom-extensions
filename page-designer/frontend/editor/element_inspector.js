// Per-element configuration panel. Sections are collapsible accordions and only
// appear when relevant to the selected element's kind, so the panel stays short.
// Style edits go through onChange({style: {...}}) (shallow-merged into element.style);
// conditional rules go through onChange({rules: {...}}).

import {FieldType} from '@airtable/blocks/interface/models';
import {useBase} from '@airtable/blocks/interface/ui';

import {
    ElementKind,
    ElementKindLabels,
    ImageSource,
    ImageFit,
    TextAlign,
    VerticalAlign,
    BarcodeFormat,
    LinkedRecordDisplay,
} from '../domain/element_types.mjs';
import {
    NumberFormat,
    ConditionOp,
    CONDITION_OP_LABELS,
    VALUELESS_OPS,
    effectiveNumberFormat,
} from '../domain/dynamic_content.mjs';
import {AlignMode, DistributeAxis} from '../domain/alignment.mjs';
import {
    IconButton,
    TextInput,
    TextArea,
    NumberInput,
    Select,
    Toggle,
    Segmented,
    ColorInput,
    Field,
    Row,
    Section,
} from '../ui/primitives.js';
import {ReorderableList} from '../ui/reorderable_list.js';
import {
    TrashIcon,
    DuplicateIcon,
    BringFrontIcon,
    SendBackIcon,
    BoldIcon,
    ItalicIcon,
    UnderlineIcon,
    AlignLeftIcon,
    AlignCenterIcon,
    AlignRightIcon,
    ObjAlignLeftIcon,
    ObjAlignCenterHIcon,
    ObjAlignRightIcon,
    ObjAlignTopIcon,
    ObjAlignMiddleVIcon,
    ObjAlignBottomIcon,
    DistributeHIcon,
    DistributeVIcon,
} from '../ui/icons.js';
import {FONT_OPTIONS} from '../render/fonts.js';

// Shown when more than one element is selected: bulk actions + align/distribute.
export function MultiInspector({count, onAlign, onDistribute, onDuplicate, onDelete, onBringToFront, onSendToBack}) {
    const Divider = () => <span className="mx-1 w-px self-stretch bg-gray-gray200 dark:bg-gray-gray700" />;
    return (
        <div className="h-full overflow-auto px-3 pb-4">
            <Row className="justify-between py-3">
                <span className="text-sm font-semibold text-gray-gray700 dark:text-gray-gray100">
                    {count} selected
                </span>
                <Row className="gap-0.5">
                    <IconButton icon={DuplicateIcon} label="Duplicate all" onClick={onDuplicate} />
                    <IconButton icon={BringFrontIcon} label="Bring to front" onClick={onBringToFront} />
                    <IconButton icon={SendBackIcon} label="Send to back" onClick={onSendToBack} />
                    <IconButton
                        icon={TrashIcon}
                        label="Delete all"
                        onClick={onDelete}
                        className="text-red-red hover:bg-red-redLight2 dark:hover:bg-red-redDark1"
                    />
                </Row>
            </Row>
            <Section title="Align" defaultOpen>
                <Row className="gap-0.5">
                    <IconButton icon={ObjAlignLeftIcon} label="Align left" onClick={() => onAlign(AlignMode.LEFT)} />
                    <IconButton icon={ObjAlignCenterHIcon} label="Align center" onClick={() => onAlign(AlignMode.CENTER_H)} />
                    <IconButton icon={ObjAlignRightIcon} label="Align right" onClick={() => onAlign(AlignMode.RIGHT)} />
                    <Divider />
                    <IconButton icon={ObjAlignTopIcon} label="Align top" onClick={() => onAlign(AlignMode.TOP)} />
                    <IconButton icon={ObjAlignMiddleVIcon} label="Align middle" onClick={() => onAlign(AlignMode.MIDDLE_V)} />
                    <IconButton icon={ObjAlignBottomIcon} label="Align bottom" onClick={() => onAlign(AlignMode.BOTTOM)} />
                </Row>
                <Field label="Distribute" hint="Even spacing (needs 3+ elements).">
                    <Row className="gap-0.5">
                        <IconButton icon={DistributeHIcon} label="Distribute horizontally" onClick={() => onDistribute(DistributeAxis.HORIZONTAL)} />
                        <IconButton icon={DistributeVIcon} label="Distribute vertically" onClick={() => onDistribute(DistributeAxis.VERTICAL)} />
                    </Row>
                </Field>
            </Section>
        </div>
    );
}

const TEXT_ALIGN_OPTIONS = [
    {value: TextAlign.LEFT, icon: AlignLeftIcon, title: 'Align left'},
    {value: TextAlign.CENTER, icon: AlignCenterIcon, title: 'Align center'},
    {value: TextAlign.RIGHT, icon: AlignRightIcon, title: 'Align right'},
];

const VERTICAL_ALIGN_OPTIONS = [
    {value: VerticalAlign.TOP, label: 'Top'},
    {value: VerticalAlign.MIDDLE, label: 'Middle'},
    {value: VerticalAlign.BOTTOM, label: 'Bottom'},
];

const IMAGE_SOURCE_OPTIONS = [
    {value: ImageSource.ATTACHMENT, label: 'Attachment'},
    {value: ImageSource.STATIC, label: 'URL'},
];

const IMAGE_FIT_OPTIONS = [
    {value: ImageFit.CONTAIN, label: 'Contain'},
    {value: ImageFit.COVER, label: 'Cover'},
    {value: ImageFit.FILL, label: 'Fill'},
];

const BARCODE_FORMAT_OPTIONS = Object.values(BarcodeFormat).map((v) => ({value: v, label: v}));

const NUMBER_FORMAT_OPTIONS = [
    {value: NumberFormat.AUTO, label: 'Auto'},
    {value: NumberFormat.NUMBER, label: 'Number'},
    {value: NumberFormat.CURRENCY, label: 'Currency'},
    {value: NumberFormat.PERCENT, label: 'Percent'},
];

const NUMERIC_FIELD_TYPES = new Set([
    FieldType.NUMBER,
    FieldType.CURRENCY,
    FieldType.PERCENT,
    FieldType.COUNT,
    FieldType.AUTO_NUMBER,
    FieldType.RATING,
    FieldType.DURATION,
]);

const OP_OPTIONS = Object.entries(CONDITION_OP_LABELS).map(([value, label]) => ({value, label}));

// Compact field/operator/value editor for a conditional rule.
function ConditionEditor({condition, table, onChange}) {
    const fieldOptions = table.fields.map((f) => ({value: f.id, label: f.name}));
    const needsValue = !VALUELESS_OPS.has(condition.op);
    return (
        <div className="space-y-2 rounded-md border border-gray-gray200 bg-gray-gray50 p-2 dark:border-gray-gray700 dark:bg-gray-gray900">
            <Select
                value={condition.fieldId}
                placeholder="Select a field"
                options={fieldOptions}
                onChange={(fieldId) => onChange({...condition, fieldId})}
            />
            <Select
                value={condition.op}
                options={OP_OPTIONS}
                onChange={(op) => onChange({...condition, op})}
            />
            {needsValue ? (
                <TextInput
                    value={condition.value}
                    onChange={(value) => onChange({...condition, value})}
                    placeholder="Value"
                />
            ) : null}
        </div>
    );
}

export function ElementInspector({
    element,
    table,
    onChange,
    onDelete,
    onDuplicate,
    onBringToFront,
    onSendToBack,
}) {
    const {kind, style} = element;
    const setStyle = (patch) => onChange({style: patch});
    const base = useBase();

    const rules = element.rules || {};
    const setRule = (key, value) => {
        const next = {...rules, [key]: value};
        onChange({rules: next.visibility || next.color ? next : null});
    };

    // Field binding is irrelevant for a static-URL image (it has its own URL input).
    const showField =
        kind === ElementKind.FIELD ||
        kind === ElementKind.BARCODE ||
        kind === ElementKind.QR_CODE ||
        (kind === ElementKind.IMAGE && element.imageSource === ImageSource.ATTACHMENT);
    const showTypography = kind === ElementKind.FIELD || kind === ElementKind.TEXT;
    const showAppearance =
        kind === ElementKind.FIELD ||
        kind === ElementKind.TEXT ||
        kind === ElementKind.IMAGE ||
        kind === ElementKind.BARCODE ||
        kind === ElementKind.QR_CODE;

    // IMAGE with an attachment source can only bind to attachment fields.
    const restrictToAttachments =
        kind === ElementKind.IMAGE && element.imageSource === ImageSource.ATTACHMENT;
    const fieldOptions = table.fields
        .filter((f) => !restrictToAttachments || f.config.type === FieldType.MULTIPLE_ATTACHMENTS)
        .map((f) => ({value: f.id, label: f.name}));

    const boundField = element.fieldId ? table.getFieldByIdIfExists(element.fieldId) : null;
    const isLinkedField =
        kind === ElementKind.FIELD &&
        boundField &&
        boundField.config.type === FieldType.MULTIPLE_RECORD_LINKS;
    const isSingleSelectField =
        kind === ElementKind.FIELD && boundField && boundField.config.type === FieldType.SINGLE_SELECT;
    // Number/currency formatting only applies to numeric fields.
    const isNumericField = boundField && NUMERIC_FIELD_TYPES.has(boundField.config.type);
    // Percent style multiplies by 100 (0.5 -> "50%"), so it only makes sense on a
    // percent field; offering it elsewhere silently turns a "50" into "5,000%".
    const isPercentField = boundField && boundField.config.type === FieldType.PERCENT;
    const numberFormatOptions = isPercentField
        ? NUMBER_FORMAT_OPTIONS
        : NUMBER_FORMAT_OPTIONS.filter((o) => o.value !== NumberFormat.PERCENT);
    // Degrade a stale 'percent' setting to Auto so the control matches the render
    // when the element is bound to a non-percent field.
    const effectiveFormat = effectiveNumberFormat(style.numberFormat, isPercentField);
    const linkedTableId =
        isLinkedField && boundField.config.options ? boundField.config.options.linkedTableId : null;
    const linkedTable = linkedTableId ? base.getTableByIdIfExists(linkedTableId) : null;
    const linkedColumns = element.linkedColumns || [];

    return (
        <div className="h-full overflow-auto px-3 pb-4">
            <Row className="justify-between py-3">
                <span className="text-sm font-semibold text-gray-gray700 dark:text-gray-gray100">
                    {ElementKindLabels[kind] ?? kind}
                </span>
                <Row className="gap-0.5">
                    <IconButton icon={DuplicateIcon} label="Duplicate" onClick={onDuplicate} />
                    <IconButton icon={BringFrontIcon} label="Bring to front" onClick={onBringToFront} />
                    <IconButton icon={SendBackIcon} label="Send to back" onClick={onSendToBack} />
                    <IconButton
                        icon={TrashIcon}
                        label="Delete"
                        onClick={onDelete}
                        className="text-red-red hover:bg-red-redLight2 dark:hover:bg-red-redDark1"
                    />
                </Row>
            </Row>

            {showField ? (
                <Section title="Field" defaultOpen>
                    <Field>
                        <Select
                            value={element.fieldId}
                            options={fieldOptions}
                            onChange={(v) => onChange({fieldId: v})}
                            placeholder="Select a field"
                        />
                    </Field>
                    {isLinkedField ? (
                        <Field label="Linked records">
                            <Segmented
                                label="Linked records"
                                value={style.linkedRecordDisplay || LinkedRecordDisplay.COMMA}
                                options={[
                                    {value: LinkedRecordDisplay.COMMA, label: 'Comma'},
                                    {value: LinkedRecordDisplay.LIST, label: 'List'},
                                    {value: LinkedRecordDisplay.TABLE, label: 'Table'},
                                ]}
                                onChange={(v) => setStyle({linkedRecordDisplay: v})}
                            />
                        </Field>
                    ) : null}
                    {isLinkedField &&
                    style.linkedRecordDisplay === LinkedRecordDisplay.TABLE &&
                    linkedTable ? (
                        <>
                            <LinkedColumnsField
                                linkedTable={linkedTable}
                                linkedColumns={linkedColumns}
                                onChange={onChange}
                            />
                            <Field label="Header fill">
                                <ColorInput
                                    value={style.tableHeaderColor}
                                    onChange={(tableHeaderColor) => setStyle({tableHeaderColor})}
                                />
                            </Field>
                            <Toggle
                                label="Alternate row shading"
                                checked={!!style.tableStripeRows}
                                onChange={(tableStripeRows) => setStyle({tableStripeRows})}
                            />
                        </>
                    ) : null}
                </Section>
            ) : null}

            {kind === ElementKind.TEXT ? (
                <Section title="Content" defaultOpen>
                    <Field hint="Type text, and use {Field name} to insert record values.">
                        <TextArea value={element.text} onChange={(text) => onChange({text})} />
                    </Field>
                    <Select
                        value=""
                        placeholder="Insert field…"
                        options={table.fields.map((f) => ({value: f.name, label: f.name}))}
                        onChange={(name) => onChange({text: `${element.text || ''}{${name}}`})}
                    />
                </Section>
            ) : null}

            {kind === ElementKind.FIELD && !isLinkedField ? (
                <Section title="Format">
                    {isSingleSelectField ? (
                        <Field label="Display">
                            <Segmented
                                label="Display"
                                value={style.selectDisplay || 'text'}
                                options={[
                                    {value: 'text', label: 'Text'},
                                    {value: 'pill', label: 'Pill'},
                                ]}
                                onChange={(v) => setStyle({selectDisplay: v})}
                            />
                        </Field>
                    ) : null}
                    {isNumericField ? (
                        <>
                            <Field label="Number format" hint="Auto uses the field's own formatting.">
                                <Select
                                    value={effectiveFormat}
                                    options={numberFormatOptions}
                                    onChange={(numberFormat) => setStyle({numberFormat})}
                                />
                            </Field>
                            {effectiveFormat !== NumberFormat.AUTO ? (
                                <Field label="Decimals">
                                    <NumberInput
                                        value={style.decimals}
                                        min={0}
                                        max={10}
                                        onChange={(decimals) => setStyle({decimals})}
                                    />
                                </Field>
                            ) : null}
                        </>
                    ) : null}
                    <Row>
                        <Field label="Prefix">
                            <TextInput
                                value={style.prefix}
                                onChange={(prefix) => setStyle({prefix})}
                                placeholder="$"
                            />
                        </Field>
                        <Field label="Suffix">
                            <TextInput
                                value={style.suffix}
                                onChange={(suffix) => setStyle({suffix})}
                                placeholder="USD"
                            />
                        </Field>
                    </Row>
                </Section>
            ) : null}

            {kind === ElementKind.IMAGE ? (
                <Section title="Image" defaultOpen>
                    <Field label="Source">
                        <Segmented
                            label="Source"
                            value={element.imageSource}
                            options={IMAGE_SOURCE_OPTIONS}
                            onChange={(v) => onChange({imageSource: v})}
                        />
                    </Field>
                    {element.imageSource === ImageSource.STATIC ? (
                        <>
                            <Field label="Image URL" hint="Use an https:// image URL.">
                                <TextInput
                                    value={element.imageUrl}
                                    onChange={(imageUrl) =>
                                        /^\s*data:/i.test(imageUrl) ? undefined : onChange({imageUrl})
                                    }
                                    placeholder="https://…"
                                />
                            </Field>
                            <Field label="Alt text" hint="Describes the image for screen readers.">
                                <TextInput
                                    value={element.imageAlt || ''}
                                    onChange={(imageAlt) => onChange({imageAlt})}
                                    placeholder="Company logo"
                                />
                            </Field>
                        </>
                    ) : null}
                    <Field label="Fit">
                        <Segmented
                            label="Fit"
                            value={style.imageFit}
                            options={IMAGE_FIT_OPTIONS}
                            onChange={(imageFit) => setStyle({imageFit})}
                        />
                    </Field>
                </Section>
            ) : null}

            {kind === ElementKind.BARCODE ? (
                <Section title="Barcode" defaultOpen>
                    <Field label="Format">
                        <Select
                            value={element.barcodeFormat}
                            options={BARCODE_FORMAT_OPTIONS}
                            onChange={(v) => onChange({barcodeFormat: v})}
                        />
                    </Field>
                </Section>
            ) : null}

            {showTypography ? (
                <Section title="Typography" defaultOpen>
                    <Field label="Font">
                        <Select
                            value={style.fontFamily}
                            options={FONT_OPTIONS}
                            onChange={(fontFamily) => setStyle({fontFamily})}
                        />
                    </Field>
                    <Row>
                        <Field label="Size">
                            <NumberInput
                                value={style.fontSize}
                                min={6}
                                suffix="px"
                                onChange={(fontSize) => setStyle({fontSize})}
                            />
                        </Field>
                        <Row className="gap-0.5 pt-4">
                            <IconButton
                                icon={BoldIcon}
                                label="Bold"
                                active={style.fontWeight === 'bold'}
                                onClick={() =>
                                    setStyle({
                                        fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold',
                                    })
                                }
                            />
                            <IconButton
                                icon={ItalicIcon}
                                label="Italic"
                                active={style.fontStyle === 'italic'}
                                onClick={() =>
                                    setStyle({
                                        fontStyle:
                                            style.fontStyle === 'italic' ? 'normal' : 'italic',
                                    })
                                }
                            />
                            <IconButton
                                icon={UnderlineIcon}
                                label="Underline"
                                active={!!style.underline}
                                onClick={() => setStyle({underline: !style.underline})}
                            />
                        </Row>
                    </Row>
                    <Field label="Color">
                        <ColorInput value={style.color} onChange={(color) => setStyle({color})} />
                    </Field>
                    <Field label="Horizontal align">
                        <Segmented
                            label="Horizontal align"
                            value={style.textAlign}
                            options={TEXT_ALIGN_OPTIONS}
                            onChange={(textAlign) => setStyle({textAlign})}
                        />
                    </Field>
                    <Field label="Vertical align">
                        <Segmented
                            label="Vertical align"
                            value={style.verticalAlign}
                            options={VERTICAL_ALIGN_OPTIONS}
                            onChange={(verticalAlign) => setStyle({verticalAlign})}
                        />
                    </Field>
                    {kind === ElementKind.FIELD ? (
                        <Toggle
                            label="Show field label"
                            checked={!!style.showFieldLabel}
                            onChange={(showFieldLabel) => setStyle({showFieldLabel})}
                        />
                    ) : null}
                </Section>
            ) : null}

            {kind === ElementKind.LINE ? (
                <Section title="Line" defaultOpen>
                    <Field label="Color">
                        <ColorInput
                            value={style.lineColor}
                            onChange={(lineColor) => setStyle({lineColor})}
                        />
                    </Field>
                    <Field label="Thickness">
                        <NumberInput
                            value={style.lineThickness}
                            min={1}
                            suffix="px"
                            onChange={(lineThickness) => setStyle({lineThickness})}
                        />
                    </Field>
                </Section>
            ) : null}

            {showAppearance ? (
                <Section title="Appearance">
                    <Field label="Background">
                        <ColorInput
                            value={style.backgroundColor}
                            onChange={(backgroundColor) => setStyle({backgroundColor})}
                        />
                    </Field>
                    <Field label="Padding">
                        <NumberInput
                            value={style.padding}
                            min={0}
                            suffix="px"
                            onChange={(padding) => setStyle({padding})}
                        />
                    </Field>
                    <Row>
                        <Field label="Border width">
                            <NumberInput
                                value={style.borderWidth}
                                min={0}
                                suffix="px"
                                onChange={(borderWidth) => setStyle({borderWidth})}
                            />
                        </Field>
                        <Field label="Border radius">
                            <NumberInput
                                value={style.borderRadius}
                                min={0}
                                suffix="px"
                                onChange={(borderRadius) => setStyle({borderRadius})}
                            />
                        </Field>
                    </Row>
                    <Field label="Border color">
                        <ColorInput
                            value={style.borderColor}
                            onChange={(borderColor) => setStyle({borderColor})}
                        />
                    </Field>
                </Section>
            ) : null}

            <Section title="Position & size">
                <Row>
                    <Field label="X">
                        <NumberInput value={element.x} suffix="px" onChange={(x) => onChange({x})} />
                    </Field>
                    <Field label="Y">
                        <NumberInput value={element.y} suffix="px" onChange={(y) => onChange({y})} />
                    </Field>
                </Row>
                <Row>
                    <Field label="Width">
                        <NumberInput
                            value={element.width}
                            suffix="px"
                            onChange={(width) => onChange({width})}
                        />
                    </Field>
                    <Field label="Height">
                        <NumberInput
                            value={element.height}
                            suffix="px"
                            onChange={(height) => onChange({height})}
                        />
                    </Field>
                </Row>
                <Field label="Rotation">
                    <NumberInput
                        value={element.rotation}
                        min={-180}
                        max={180}
                        suffix="°"
                        onChange={(rotation) => onChange({rotation})}
                    />
                </Field>
            </Section>

            <Section title="Rules">
                <Field label="Show this element">
                    <Select
                        value={rules.visibility ? 'conditional' : 'always'}
                        options={[
                            {value: 'always', label: 'Always'},
                            {value: 'conditional', label: 'Only when…'},
                        ]}
                        onChange={(v) =>
                            setRule(
                                'visibility',
                                v === 'conditional'
                                    ? {fieldId: '', op: ConditionOp.NOT_EMPTY, value: ''}
                                    : null,
                            )
                        }
                    />
                </Field>
                {rules.visibility ? (
                    <ConditionEditor
                        condition={rules.visibility}
                        table={table}
                        onChange={(c) => setRule('visibility', c)}
                    />
                ) : null}
                <Toggle
                    label="Conditional color"
                    checked={!!rules.color}
                    onChange={(on) =>
                        setRule(
                            'color',
                            on
                                ? {fieldId: '', op: ConditionOp.NOT_EMPTY, value: '', color: '#dc043b'}
                                : null,
                        )
                    }
                />
                {rules.color ? (
                    <>
                        <ConditionEditor
                            condition={rules.color}
                            table={table}
                            onChange={(c) => setRule('color', {...c, color: rules.color.color})}
                        />
                        <Field label="Color">
                            <ColorInput
                                value={rules.color.color}
                                onChange={(color) => setRule('color', {...rules.color, color})}
                            />
                        </Field>
                    </>
                ) : null}
            </Section>
        </div>
    );
}

function RemoveIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

function LinkedColumnsField({linkedTable, linkedColumns, onChange}) {
    const items = linkedColumns.map((id) => ({id, field: linkedTable.getFieldByIdIfExists(id)}));
    const unselected = linkedTable.fields.filter((f) => !linkedColumns.includes(f.id));

    return (
        <Field label="Columns" hint="Fields from the linked table to show. Drag to reorder.">
            <ReorderableList
                items={items}
                onReorder={(nextIds) => onChange({linkedColumns: nextIds})}
                renderItem={(item) => (
                    <>
                        <span
                            className={
                                'min-w-0 flex-1 truncate text-sm ' +
                                (item.field
                                    ? 'text-gray-gray700 dark:text-gray-gray100'
                                    : 'italic text-gray-gray400')
                            }
                        >
                            {item.field ? item.field.name : item.id}
                        </span>
                        <IconButton
                            icon={RemoveIcon}
                            label="Remove column"
                            size={14}
                            onClick={() =>
                                onChange({
                                    linkedColumns: linkedColumns.filter((id) => id !== item.id),
                                })
                            }
                        />
                    </>
                )}
            />
            {unselected.length > 0 ? (
                <Select
                    value=""
                    placeholder="Add column…"
                    options={unselected.map((f) => ({value: f.id, label: f.name}))}
                    onChange={(id) => onChange({linkedColumns: [...linkedColumns, id]})}
                />
            ) : null}
        </Field>
    );
}
