// Page Designer — single-file Omni custom page (render + print).
//
// A print-ready page designer collapsed into one Custom Element source file for
// Omni's "Edit source code" editor. It renders one designed page per record from
// the element's record source, and prints one clean sheet per record.
//
// This is the RENDER half of the full Page Designer extension. The interactive
// drag/resize editor is omitted on purpose: Omni's source-only sandbox has no
// persistent config store (no useGlobalConfig), so a layout can't be saved from
// inside the page. Instead you author the layout in the LAYOUT block below and
// swap in your own field names.
//
// ── How to use ────────────────────────────────────────────────────────────────
// 1. Edit PAGE for the sheet size/orientation.
// 2. Edit ELEMENTS (or PAGES for multiple sheets per record). Bind a field with
//    `field: 'Exact Field Name'`. Coordinates are page px: 109 px = 1 inch,
//    x/y = top-left corner of the element.
// 3. In the Interface builder, point the element's record source at the table and
//    make every field you reference VISIBLE in the element config — hidden fields
//    read back as empty.
// 4. Leave ELEMENTS empty to auto-render a simple label+value list of the
//    record's visible fields (handy first look before you design).
//
// SDK note: imports are limited to react + @airtable/blocks/interface/* (Omni's
// only allowed sources). No third-party libraries; barcodes/QR are not included.

import {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
    memo,
    Component,
} from 'react';
import {
    initializeBlock,
    useBase,
    useRecords,
    useCustomProperties,
    useColorScheme,
    colorUtils,
} from '@airtable/blocks/interface/ui';
import {FieldType} from '@airtable/blocks/interface/models';

// ════════════════════════════════════════════════════════════════════════════
//  LAYOUT — the part you edit
// ════════════════════════════════════════════════════════════════════════════

// Sheet geometry. type: LETTER | LEGAL | A4 | A5 | INDEX_CARD | BUSINESS_CARD |
// SLIDE_16_9 | SLIDE_4_3 | CUSTOM. orientation applies to paper sizes only.
const PAGE = {
    type: 'LETTER',
    orientation: 'PORTRAIT',
    customSize: {width: 8.5, height: 11}, // inches, only used when type === 'CUSTOM'
    backgroundColor: '#ffffff',
};

// One entry per element. `kind` is one of: 'field' | 'text' | 'image' | 'line'.
//  - field: renders a record field bound by name (`field: 'Client'`).
//  - text : static text; supports {Field name} merge tokens.
//  - image: an attachment field (`field: 'Logo'`) or a static URL (`url: '...'`).
//  - line : a horizontal/vertical divider (orientation follows width vs height).
// x, y, width, height are page px (109 px = 1 inch). style overrides are optional
// (see defaultStyle() for every key). Replace the sample below with your fields.
const ELEMENTS = [
    {kind: 'text', text: 'INVOICE', x: 44, y: 44, width: 420, height: 54, style: {fontSize: 36, fontWeight: 'bold'}},
    {kind: 'text', text: '{Invoice Number}', x: 44, y: 104, width: 420, height: 28, style: {fontSize: 15, color: '#6b7280'}},
    {kind: 'image', field: 'Logo', x: 620, y: 40, width: 180, height: 110, style: {imageFit: 'contain'}},
    {kind: 'line', x: 44, y: 168, width: 782, height: 2, style: {lineColor: '#d1d5db'}},
    {kind: 'field', field: 'Client', x: 44, y: 190, width: 360, height: 30, style: {showFieldLabel: true, fontSize: 15}},
    {kind: 'field', field: 'Status', x: 44, y: 250, width: 240, height: 30, style: {selectDisplay: 'pill'}},
    {kind: 'field', field: 'Amount Due', x: 560, y: 190, width: 266, height: 40, style: {fontSize: 26, fontWeight: 'bold', textAlign: 'right'}},
];

// For multiple sheets per record, define PAGES as an array of element arrays and
// each record renders every page in order. Otherwise ELEMENTS is the single page.
// Example: const PAGES = [ELEMENTS, PAGE_TWO_ELEMENTS];
const PAGES = null;

// ════════════════════════════════════════════════════════════════════════════
//  Page geometry (ported from domain/page_geometry.mjs)
// ════════════════════════════════════════════════════════════════════════════

const DPI = 109; // px per inch; matches the classic Page Designer coordinate space
const PRINT_SCALE = 96 / DPI; // the browser prints CSS px at 96 DPI

const PAGE_SIZES_INCHES = {
    LETTER: {width: 8.5, height: 11},
    LEGAL: {width: 8.5, height: 14},
    A4: {width: 8.268, height: 11.693},
    A5: {width: 5.827, height: 8.268},
    INDEX_CARD: {width: 3, height: 5},
    BUSINESS_CARD: {width: 2, height: 3.5},
    SLIDE_16_9: {width: 13.333, height: 7.5}, // stored landscape
    SLIDE_4_3: {width: 10, height: 7.5},
};

function pageTypeSupportsOrientation(type) {
    return type !== 'CUSTOM' && type !== 'SLIDE_16_9' && type !== 'SLIDE_4_3';
}

const inToPx = (inches) => inches * DPI;

// Effective page size in px, honoring orientation. Height is floored so Chrome
// doesn't spill a fractional px onto a blank extra sheet (legacy behavior).
function resolvePageSizePx(page) {
    if (page.type === 'CUSTOM') {
        const min = inToPx(0.5);
        const max = inToPx(48);
        const clamp = (v, fallbackIn) => {
            const px = Number.isFinite(v) ? inToPx(v) : inToPx(fallbackIn);
            return Math.round(Math.min(max, Math.max(min, px)));
        };
        return {
            width: clamp(page.customSize?.width, 8.5),
            height: clamp(page.customSize?.height, 11),
        };
    }
    const size = PAGE_SIZES_INCHES[page.type] || PAGE_SIZES_INCHES.LETTER;
    const width = inToPx(size.width);
    const height = inToPx(size.height);
    if (page.orientation === 'LANDSCAPE' && pageTypeSupportsOrientation(page.type)) {
        return {width: height, height: Math.floor(width)};
    }
    return {width, height: Math.floor(height)};
}

// ════════════════════════════════════════════════════════════════════════════
//  Element schema + defaults (ported from domain/element_types.mjs)
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_FONT = 'Inter';

function defaultStyle() {
    return {
        fontFamily: DEFAULT_FONT,
        fontSize: 16,
        fontWeight: 'normal', // 'normal' | 'bold'
        fontStyle: 'normal', // 'normal' | 'italic'
        underline: false,
        color: '#1d1f25',
        backgroundColor: 'transparent',
        textAlign: 'left', // 'left' | 'center' | 'right'
        verticalAlign: 'top', // 'top' | 'middle' | 'bottom'
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        borderWidth: 0,
        borderColor: '#cccccc',
        borderRadius: 0,
        imageFit: 'contain', // 'contain' | 'cover' | 'fill'
        showFieldLabel: false,
        linkedRecordDisplay: 'comma', // 'comma' | 'list' | 'table'
        tableHeaderColor: '#f3f3f5',
        tableStripeRows: true,
        tableHeaderTextColor: '',
        tableBorderColor: '#d9d9d9',
        tableStripeColor: '#f4f4f5',
        selectDisplay: 'text', // 'text' | 'pill' | 'stepper'
        stepperVariant: 'radio', // 'radio' | 'number'
        lineColor: '#1d1f25',
        lineThickness: 1,
    };
}

const KIND_DEFAULT_SIZE = {
    field: {width: 200, height: 40},
    text: {width: 240, height: 40},
    image: {width: 180, height: 180},
    line: {width: 240, height: 10},
};

// Normalize one authored element (from ELEMENTS) into a full internal element.
// Elements bind fields by NAME; the renderer resolves them per record.
function hydrateAuthoredElement(raw, id) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const kind = raw.kind || 'text';
    const size = KIND_DEFAULT_SIZE[kind] || KIND_DEFAULT_SIZE.field;
    const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    const isStaticImage = kind === 'image' && !raw.field && typeof raw.url === 'string';
    return {
        id,
        kind,
        x: num(raw.x, 0),
        y: num(raw.y, 0),
        width: Math.max(1, num(raw.width, size.width)),
        height: Math.max(1, num(raw.height, size.height)),
        rotation: num(raw.rotation, 0),
        fieldName: typeof raw.field === 'string' ? raw.field : null,
        text: kind === 'text' ? raw.text ?? '' : '',
        imageSource: kind === 'image' ? (isStaticImage ? 'static' : 'attachment') : null,
        imageUrl: isStaticImage ? raw.url : '',
        imageAlt: typeof raw.alt === 'string' ? raw.alt : '',
        // linkedColumns are field NAMES in the linked table (resolved at render).
        linkedColumns: Array.isArray(raw.linkedColumns) ? raw.linkedColumns : [],
        linkedColumnWidths:
            raw.linkedColumnWidths && typeof raw.linkedColumnWidths === 'object' ? raw.linkedColumnWidths : {},
        style: {...defaultStyle(), ...(raw.style || {})},
    };
}

// Build the list of pages (each a normalized element array) from PAGES/ELEMENTS.
function buildPages() {
    const source = Array.isArray(PAGES) && PAGES.length > 0 ? PAGES : [ELEMENTS];
    return source.map((list) =>
        (Array.isArray(list) ? list : [])
            .map((raw, i) => hydrateAuthoredElement(raw, `e${i}`))
            .filter(Boolean),
    );
}

// Fallback layout when ELEMENTS is empty: a simple label+value stack of the
// record's visible fields, so a freshly-swapped-in page still shows something.
function autoLayout(table) {
    if (!table) {
        return [];
    }
    let fields = [];
    try {
        fields = table.fields || [];
    } catch {
        fields = [];
    }
    const marginX = 48;
    const rowH = 52;
    const top = 56;
    return fields.slice(0, 14).map((f, i) =>
        hydrateAuthoredElement(
            {
                kind: 'field',
                field: f.name,
                x: marginX,
                y: top + i * rowH,
                width: 700,
                height: rowH - 8,
                style: {showFieldLabel: true, fontSize: 15},
            },
            `auto${i}`,
        ),
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  Style helpers (ported from render/geometry_style.js)
// ════════════════════════════════════════════════════════════════════════════

function elementBoxStyle(element) {
    return {
        position: 'absolute',
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: 'center center',
    };
}

const ALIGN_TO_JUSTIFY = {top: 'flex-start', middle: 'center', bottom: 'flex-end'};

function elementContentStyle(style) {
    return {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: ALIGN_TO_JUSTIFY[style.verticalAlign] || 'flex-start',
        boxSizing: 'border-box',
        padding: `${style.paddingTop || 0}px ${style.paddingRight || 0}px ${style.paddingBottom || 0}px ${style.paddingLeft || 0}px`,
        backgroundColor:
            style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : undefined,
        border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : undefined,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        overflow: 'hidden',
    };
}

function textStyle(style) {
    return {
        fontFamily: `'${style.fontFamily}', sans-serif`,
        fontSize: `${style.fontSize}px`,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textDecoration: style.underline ? 'underline' : 'none',
        color: style.color,
        textAlign: style.textAlign,
        lineHeight: 1.25,
        width: '100%',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
    };
}

// ════════════════════════════════════════════════════════════════════════════
//  Cell-value helpers (ported from domain/cell_value_helpers.mjs)
// ════════════════════════════════════════════════════════════════════════════

function extractAttachments(cellValue) {
    if (!Array.isArray(cellValue)) return [];
    return cellValue.filter((a) => a && typeof a.url === 'string');
}

function flattenLookupValues(cellValue) {
    if (!Array.isArray(cellValue)) return [];
    const out = [];
    for (const entry of cellValue) {
        if (!entry || typeof entry !== 'object') continue;
        const value = 'value' in entry ? entry.value : entry;
        if (Array.isArray(value)) out.push(...value);
        else if (value != null) out.push(value);
    }
    return out;
}

function isAttachmentLookupConfig(config) {
    return Boolean(
        config &&
            config.type === 'multipleLookupValues' &&
            config.options &&
            config.options.isValid &&
            config.options.result &&
            config.options.result.type === 'multipleAttachments',
    );
}

// http(s) only — blocks javascript:/blob:/data: URLs in a static image source.
function isSafeImageUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function isImageAttachment(attachment) {
    if (!attachment) return false;
    if (typeof attachment.type === 'string' && attachment.type.startsWith('image/')) return true;
    const name = attachment.filename ?? '';
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function extractLinkedRecords(cellValue) {
    if (!Array.isArray(cellValue)) return [];
    return cellValue
        .filter((r) => r && (typeof r.id === 'string' || typeof r.name === 'string'))
        .map((r) => ({id: r.id, name: typeof r.name === 'string' ? r.name : ''}));
}

function extractSelectChoices(cellValue) {
    if (cellValue == null) return [];
    if (Array.isArray(cellValue)) return cellValue.filter((c) => c && typeof c.name === 'string');
    if (typeof cellValue === 'object' && typeof cellValue.name === 'string') return [cellValue];
    return [];
}

// ════════════════════════════════════════════════════════════════════════════
//  Merge-field templating (ported from domain/dynamic_content.mjs)
// ════════════════════════════════════════════════════════════════════════════

// Resolver for {Field name} tokens: the field's display string, or the field NAME
// when there's no record, or null for an unknown field (keeps the literal token).
function makeFieldTokenResolver(table, record) {
    return (name) => {
        const f = table ? table.getFieldByNameIfExists(name) : null;
        if (!f) return null;
        return record ? record.getCellValueAsString(f) : name;
    };
}

function renderTemplate(text, resolve) {
    if (typeof text !== 'string') return '';
    return text.replace(/\{([^{}]+)\}/g, (match, rawName) => {
        const value = resolve(rawName.trim());
        return value == null ? match : value;
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  Color helpers
// ════════════════════════════════════════════════════════════════════════════

function hexForColorName(name) {
    if (!name) return null;
    try {
        return colorUtils.getHexForColor(name) || null;
    } catch {
        return null;
    }
}

// Dark vs light text for a filled swatch (replaces the SDK's shouldUseLightText).
function readableTextOn(hex) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return '#1d1f25';
    const n = parseInt(hex.slice(1, 7), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1d1f25' : '#ffffff';
}

// ════════════════════════════════════════════════════════════════════════════
//  Field display: select pills, stepper, rating, checkbox, collaborators
//  (ported from render/select_pill.js, select_stepper.js, field_display.js)
// ════════════════════════════════════════════════════════════════════════════

function choiceColorName(field, choice) {
    if (choice.color) return choice.color;
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    const match = choices.find((c) => c.id === choice.id) || choices.find((c) => c.name === choice.name);
    return (match && match.color) || null;
}

function ChoicePill({field, choice, css}) {
    const colorName = choiceColorName(field, choice);
    const bg = hexForColorName(colorName) || '#eceef1';
    return (
        <span
            style={{
                display: 'inline-block',
                backgroundColor: bg,
                color: colorName ? readableTextOn(bg) : '#1d1f25',
                borderRadius: 9999,
                padding: '0.3em 0.72em',
                fontSize: css.fontSize,
                fontFamily: css.fontFamily,
                fontWeight: 400,
                lineHeight: 1.45,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
        >
            {choice.name}
        </span>
    );
}

const TEXT_ALIGN_TO_JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};

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

const MAX_STEPPER_STEPS = 12;
const STEP_RAIL = '#dfe1e5';
const STEP_SOFT = '#f2f4f8';
const STEP_TEXT = '#8a8f98';

function StepCircle({variant, index, active, color}) {
    const border = `2px solid ${active ? color : STEP_RAIL}`;
    if (variant === 'number') {
        return (
            <span
                style={{
                    flex: 'none',
                    width: '1.7em',
                    height: '1.7em',
                    borderRadius: '50%',
                    border,
                    backgroundColor: active ? color : STEP_SOFT,
                    color: active ? readableTextOn(color) : STEP_TEXT,
                    fontSize: '0.8em',
                    fontWeight: active ? 600 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                }}
            >
                {index + 1}
            </span>
        );
    }
    return (
        <span
            style={{
                flex: 'none',
                width: '1.5em',
                height: '1.5em',
                borderRadius: '50%',
                border,
                backgroundColor: STEP_SOFT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {active ? (
                <span style={{width: '0.72em', height: '0.72em', borderRadius: '50%', backgroundColor: color}} />
            ) : null}
        </span>
    );
}

function SelectStepper({field, record, css, variant = 'radio'}) {
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    const current = record ? record.getCellValue(field) : null;
    const currentIndex = current ? choices.findIndex((c) => c.id === current.id) : -1;
    const last = choices.length - 1;
    const selectedName = current ? choiceColorName(field, current) : null;
    const activeColor = hexForColorName(selectedName) || '#2d7ff9';

    return (
        <div style={{...css, display: 'flex', alignItems: 'flex-start', width: '100%'}}>
            {choices.map((choice, i) => {
                const active = i === currentIndex;
                return (
                    <div key={choice.id} style={{flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <div style={{display: 'flex', alignItems: 'center', width: '100%'}}>
                            <span style={{flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : STEP_RAIL}} />
                            <StepCircle variant={variant} index={i} active={active} color={activeColor} />
                            <span style={{flex: 1, height: 2, backgroundColor: i === last ? 'transparent' : STEP_RAIL}} />
                        </div>
                        <div style={{marginTop: '0.35em', maxWidth: '100%', textAlign: 'center'}}>
                            {active ? (
                                <ChoicePill field={field} choice={choice} css={css} />
                            ) : (
                                <span style={{color: STEP_TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block'}}>
                                    {choice.name}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const RATING_GLYPH = {star: '★', heart: '♥', thumbsUp: '👍', flag: '⚑'};
const RATING_EMPTY = 'rgba(15,23,42,0.18)';
const DISPLAY_JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};
const justifyFor = (css) => DISPLAY_JUSTIFY[css && css.textAlign] || 'flex-start';

function RatingDisplay({field, record, css}) {
    const opts = (field.config && field.config.options) || {};
    const max = opts.max || 5;
    const glyph = RATING_GLYPH[opts.icon] || '★';
    const value = record ? Number(record.getCellValue(field)) || 0 : 0;
    const color = hexForColorName(opts.color) || '#fcb400';
    return (
        <div style={{...css, display: 'flex', gap: '0.1em', justifyContent: justifyFor(css)}} role="img" aria-label={`${value} of ${max}`}>
            {Array.from({length: max}, (_, i) => i + 1).map((n) => (
                <span key={n} style={{color: n <= value ? color : RATING_EMPTY}}>
                    {glyph}
                </span>
            ))}
        </div>
    );
}

function CheckboxDisplay({field, record, css}) {
    const opts = (field.config && field.config.options) || {};
    const checked = record ? !!record.getCellValue(field) : false;
    const color = hexForColorName(opts.color) || '#2d7ff9';
    return (
        <div style={{...css, display: 'flex', alignItems: 'center', justifyContent: justifyFor(css)}}>
            <input
                type="checkbox"
                checked={checked}
                readOnly
                aria-label={field.name}
                style={{width: '1em', height: '1em', accentColor: color, pointerEvents: 'none'}}
            />
        </div>
    );
}

const AVATAR_COLORS = ['#2d7ff9', '#18bfff', '#20c933', '#fcb400', '#f82b60', '#8b46ff', '#ff6f2c', '#20d9d2'];
function avatarColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function CollaboratorAvatar({person, size = '1.35em'}) {
    const [imgBroken, setImgBroken] = useState(false);
    const label = (person && (person.name || person.email)) || '';
    const common = {
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    };
    if (person && person.profilePicUrl && !imgBroken) {
        return <img src={person.profilePicUrl} alt="" onError={() => setImgBroken(true)} style={{...common, objectFit: 'cover'}} />;
    }
    return (
        <span style={{...common, backgroundColor: avatarColor(label), color: '#ffffff', fontSize: '0.62em', fontWeight: 600}}>
            {label.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

function CollaboratorDisplay({field, record, css}) {
    const raw = record ? record.getCellValue(field) : null;
    const people = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    if (!people.length) return <div style={css}>{record ? '' : field.name}</div>;
    return (
        <div style={{...css, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5em', justifyContent: justifyFor(css)}}>
            {people.map((p, i) => (
                <span key={p.id || i} style={{display: 'inline-flex', alignItems: 'center', gap: '0.35em', maxWidth: '100%'}}>
                    <CollaboratorAvatar person={p} />
                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{p.name || p.email}</span>
                </span>
            ))}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  Linked-record table (read-only; ported from render/linked_record_table.js)
// ════════════════════════════════════════════════════════════════════════════

const MAX_TABLE_ROWS = 100;

// Normalized column widths (fractions summing to 1) for the given columns.
function columnFractions(columnIds, widths) {
    const n = columnIds.length;
    if (n === 0) return [];
    const w = widths || {};
    const raw = columnIds.map((id) => (typeof w[id] === 'number' && w[id] > 0 ? w[id] : 1 / n));
    const sum = raw.reduce((a, b) => a + b, 0);
    return sum > 0 ? raw.map((v) => v / sum) : columnIds.map(() => 1 / n);
}

function LinkedRecordTable({element, field, record, table}) {
    const base = useBase();
    const linkedTableId = field.config && field.config.options ? field.config.options.linkedTableId : null;
    const linkedTable = linkedTableId ? base.getTableByIdIfExists(linkedTableId) : null;
    // Hooks must run unconditionally: fall back to the primary table (its records
    // are ignored when there is no linked table).
    const linkedRecords = useRecords(linkedTable || table) || [];
    const ts = textStyle(element.style);

    // linkedColumns are authored as field NAMES in the linked table.
    const columns = linkedTable
        ? (element.linkedColumns && element.linkedColumns.length
              ? element.linkedColumns.map((name) => linkedTable.getFieldByNameIfExists(name)).filter(Boolean)
              : [linkedTable.primaryField])
        : [];

    if (!linkedTable || columns.length === 0) {
        const names = record ? extractLinkedRecords(record.getCellValue(field)).map((r) => r.name).join(', ') : field.name;
        return <div style={ts}>{names}</div>;
    }

    const recordById = new Map(linkedRecords.map((r) => [r.id, r]));
    const allRefs = record ? extractLinkedRecords(record.getCellValue(field)) : [];
    const refs = allRefs.slice(0, MAX_TABLE_ROWS);
    const hiddenRows = allRefs.length - refs.length;
    const fractions = columnFractions(columns.map((c) => c.id), element.linkedColumnWidths);

    const cellStyle = {
        ...ts,
        border: `1px solid ${element.style.tableBorderColor || 'rgba(0,0,0,0.15)'}`,
        padding: '2px 5px',
        verticalAlign: 'top',
        overflowWrap: 'break-word',
    };
    const headerTextColor = element.style.tableHeaderTextColor;
    const headStyle = {
        ...cellStyle,
        fontWeight: 'bold',
        backgroundColor: element.style.tableHeaderColor,
        ...(headerTextColor ? {color: headerTextColor} : {}),
    };
    const stripeRows = !!element.style.tableStripeRows;
    const stripeColor = element.style.tableStripeColor || 'rgba(0,0,0,0.04)';
    const rowStyle = (i) => (stripeRows && i % 2 === 1 ? {backgroundColor: stripeColor} : undefined);

    return (
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
                            <tr key={ref.id} style={rowStyle(rowIndex)}>
                                {columns.map((col, colIndex) => (
                                    <td key={col.id} style={cellStyle}>
                                        {linkedRecord ? linkedRecord.getCellValueAsString(col) : colIndex === 0 ? ref.name : ''}
                                    </td>
                                ))}
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        {columns.map((col) => (
                            <td key={col.id} style={cellStyle}>
                                {col.name}
                            </td>
                        ))}
                    </tr>
                )}
                {hiddenRows > 0 ? (
                    <tr>
                        <td colSpan={columns.length} style={{...cellStyle, textAlign: 'center', opacity: 0.6}}>
                            +{hiddenRows} more
                        </td>
                    </tr>
                ) : null}
            </tbody>
        </table>
    );
}

function LinkedRecordList({css, field, record}) {
    const names = record ? extractLinkedRecords(record.getCellValue(field)).map((r) => r.name) : [field.name];
    return (
        <ul style={{...css, margin: 0, paddingLeft: '1.1em', listStyle: 'disc'}}>
            {names.map((name, i) => (
                <li key={i}>{name}</li>
            ))}
        </ul>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  Image element (ported from render/image_element.js)
// ════════════════════════════════════════════════════════════════════════════

function ImagePlaceholder({label}) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-gray100 text-gray-gray500 dark:bg-gray-gray700">
            <span style={{fontSize: 22}}>🖼️</span>
            <span className="text-xs">{label}</span>
        </div>
    );
}

function resolveAttachmentUrl(record, table, element) {
    if (!element.fieldName) return null;
    const field = table.getFieldByNameIfExists(element.fieldName);
    if (!field) return null;
    const cellValue = record.getCellValue(field);
    const attachments = extractAttachments(
        isAttachmentLookupConfig(field.config) ? flattenLookupValues(cellValue) : cellValue,
    );
    const image = attachments.find(isImageAttachment) || attachments[0];
    if (!image) return null;
    return record.getAttachmentClientUrlFromCellValueUrl(image.id, image.url);
}

function ImageElement({element, record, table, eager = false}) {
    const isStatic = element.imageSource === 'static';
    const [failedUrl, setFailedUrl] = useState(null);
    let url = null;

    if (isStatic) {
        url = isSafeImageUrl(element.imageUrl) ? element.imageUrl.trim() : null;
    } else if (record && table) {
        url = resolveAttachmentUrl(record, table, element);
    }

    const attachmentField = !isStatic && element.fieldName ? table?.getFieldByNameIfExists(element.fieldName) : null;
    const alt = isStatic ? element.imageAlt || '' : attachmentField ? attachmentField.name : '';

    if (!url) {
        if (isStatic) return <ImagePlaceholder label="Image URL" />;
        if (!record) return <ImagePlaceholder label="Attachment" />;
        return <ImagePlaceholder label="No image" />;
    }
    if (url === failedUrl) return <ImagePlaceholder label="Image failed to load" />;

    return (
        <img
            src={url}
            alt={alt}
            draggable={false}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedUrl(url)}
            style={{width: '100%', height: '100%', objectFit: element.style.imageFit || 'contain', objectPosition: 'center'}}
        />
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  Element dispatch (ported from render/element_content.js)
// ════════════════════════════════════════════════════════════════════════════

function editableKind(fieldType) {
    switch (fieldType) {
        case FieldType.RATING:
            return 'rating';
        case FieldType.CHECKBOX:
            return 'checkbox';
        case FieldType.SINGLE_COLLABORATOR:
            return 'collaborator';
        case FieldType.MULTIPLE_COLLABORATORS:
            return 'multicollaborator';
        default:
            return null;
    }
}

function stepperFits(field) {
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    return choices.length <= MAX_STEPPER_STEPS;
}

function FieldText({element, css, record, table}) {
    const field = element.fieldName ? table.getFieldByNameIfExists(element.fieldName) : null;
    // A named field that doesn't exist (typo / hidden): render nothing rather than
    // a broken box, matching the extension's published behavior.
    if (element.fieldName && !field) return null;

    const label = element.style.showFieldLabel && field ? field.name : null;
    const isLinked = field && field.type === FieldType.MULTIPLE_RECORD_LINKS;
    const linkedMode = element.style.linkedRecordDisplay || 'comma';
    const isSelectField = field && (field.type === FieldType.SINGLE_SELECT || field.type === FieldType.MULTIPLE_SELECTS);
    const selectMode = isSelectField ? element.style.selectDisplay || 'text' : null;
    const isSelectPill = selectMode === 'pill';
    const isStepper = selectMode === 'stepper' && field.type === FieldType.SINGLE_SELECT;
    const fieldKind = field ? editableKind(field.type) : null;

    let body;
    if (isLinked && linkedMode === 'table') {
        body = <LinkedRecordTable element={element} field={field} record={record} table={table} />;
    } else if (isLinked && linkedMode === 'list') {
        body = <LinkedRecordList css={css} field={field} record={record} />;
    } else if (isSelectPill) {
        body = <SelectPills field={field} record={record} css={css} />;
    } else if (isStepper && stepperFits(field)) {
        body = <SelectStepper field={field} record={record} css={css} variant={element.style.stepperVariant || 'radio'} />;
    } else if (isStepper) {
        body = <SelectPills field={field} record={record} css={css} />;
    } else if (fieldKind === 'rating') {
        body = <RatingDisplay field={field} record={record} css={css} />;
    } else if (fieldKind === 'checkbox') {
        body = <CheckboxDisplay field={field} record={record} css={css} />;
    } else if (fieldKind === 'collaborator' || fieldKind === 'multicollaborator') {
        body = <CollaboratorDisplay field={field} record={record} css={css} />;
    } else {
        // Inherit the field's own formatting (currency, percent, date) via
        // getCellValueAsString. No record = show the field name so the layout reads.
        const value = record && field ? record.getCellValueAsString(field) : field ? field.name : '';
        body = <div style={css}>{value}</div>;
    }

    return (
        <div style={{width: '100%'}}>
            {label ? (
                <div style={{...css, fontSize: `${Math.max(9, element.style.fontSize * 0.7)}px`, fontWeight: 'bold', opacity: 0.6, marginBottom: '2px'}}>
                    {label}
                </div>
            ) : null}
            {body}
        </div>
    );
}

function StaticText({element, css, record, table}) {
    return <div style={css}>{renderTemplate(element.text || '', makeFieldTokenResolver(table, record))}</div>;
}

function LineElement({element}) {
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

// Memoized so a page with many elements only re-renders the ones whose bound cell
// value actually changed (valueKey busts the memo).
const ElementContent = memo(function ElementContent({element, record, table, eagerImages}) {
    const css = textStyle(element.style);
    switch (element.kind) {
        case 'field':
            return <FieldText element={element} css={css} record={record} table={table} />;
        case 'text':
            return <StaticText element={element} css={css} record={record} table={table} />;
        case 'image':
            return <ImageElement element={element} record={record} table={table} eager={eagerImages} />;
        case 'line':
            return <LineElement element={element} />;
        default:
            return null;
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  Page canvas (ported from render/page_canvas.js)
// ════════════════════════════════════════════════════════════════════════════

// Per-element error isolation: a single element that throws shows nothing rather
// than blanking the whole page.
class ElementBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {failed: false};
    }
    static getDerivedStateFromError() {
        return {failed: true};
    }
    componentDidUpdate(prev) {
        if (this.state.failed && prev.resetKey !== this.props.resetKey) {
            this.setState({failed: false});
        }
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

// scaleMode 'transform' (screen): visual-only scale. 'zoom' (print): resizes the
// layout box so Chrome paginates on the scaled height and pages don't spill.
function PageCanvas({page, elements, record, table, scale = 1, scaleMode = 'transform', eagerImages = false}) {
    const {width, height} = resolvePageSizePx(page);
    const useZoom = scaleMode === 'zoom';

    return (
        <div
            style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: !useZoom && scale !== 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'top left',
                zoom: useZoom && scale !== 1 ? scale : undefined,
                flex: 'none',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    backgroundColor: page.backgroundColor || '#ffffff',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06), 0 12px 28px -8px rgba(0,0,0,0.2)',
                    overflow: 'hidden',
                }}
            >
                <div style={{position: 'absolute', inset: 0}}>
                    {elements.map((element) => {
                        // Record objects mutate in place (stable ref), so thread the current
                        // value through to bust ElementContent's memo when it changes.
                        const boundField = element.fieldName && table ? table.getFieldByNameIfExists(element.fieldName) : null;
                        let valueKey = null;
                        if (boundField && record) {
                            try {
                                valueKey = record.getCellValueAsString(boundField);
                            } catch {
                                valueKey = null;
                            }
                        } else if (record && typeof element.text === 'string' && element.text.includes('{')) {
                            try {
                                valueKey = renderTemplate(element.text, makeFieldTokenResolver(table, record));
                            } catch {
                                valueKey = null;
                            }
                        }
                        return (
                            <div key={element.id} style={elementBoxStyle(element)}>
                                <div style={elementContentStyle(element.style)}>
                                    <ElementBoundary resetKey={element}>
                                        <ElementContent
                                            element={element}
                                            record={record}
                                            table={table}
                                            eagerImages={eagerImages}
                                            valueKey={valueKey}
                                        />
                                    </ElementBoundary>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Reserves the correct layout box for a transform-scaled page (CSS transform
// doesn't affect layout size), so scaled pages don't overlap.
function ScaledPage({page, scale, children}) {
    const {width, height} = resolvePageSizePx(page);
    return <div style={{width: `${width * scale}px`, height: `${height * scale}px`, flex: 'none'}}>{children}</div>;
}

// ════════════════════════════════════════════════════════════════════════════
//  Print (ported from view/print.js, print_layer.js, use_print_mode.js —
//  reworked to avoid react-dom's flushSync, which Omni can't import)
// ════════════════════════════════════════════════════════════════════════════

const MAX_PRINT_SHEETS = 500;

let _printStyleEl = null;

function updatePrintPageStyle(page) {
    if (!_printStyleEl) {
        _printStyleEl = document.createElement('style');
        _printStyleEl.id = 'pd-print-style';
        document.head.appendChild(_printStyleEl);
    }
    const {width, height} = resolvePageSizePx(page);
    const w = width / DPI;
    const h = height / DPI;
    _printStyleEl.textContent = `
        @page { size: ${w}in ${h}in; margin: 0; }
        @media screen { .pd-print-only { display: none; } }
        @media print {
            html, body { height: auto !important; min-height: 0 !important; background: #ffffff !important; }
            .dark { background: #ffffff !important; }
            .pd-print-only { display: block !important; background: #ffffff !important; }
            .pd-screen-only { display: none !important; }
            .pd-print-page, .pd-print-page * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .pd-print-page { break-inside: avoid; }
            .pd-print-page + .pd-print-page { break-before: page; }
            .pd-print-page, .pd-print-page * { box-shadow: none !important; }
        }
    `;
}

function PrintLayer({page, pages, records, table}) {
    const pageCount = Math.max(1, pages.length);
    const maxRecords = Math.max(1, Math.floor(MAX_PRINT_SHEETS / pageCount));
    const printable = records.length > maxRecords ? records.slice(0, maxRecords) : records;
    return (
        <div className="pd-print-only">
            {printable.map((record) =>
                pages.map((entry, i) => (
                    <div key={`${record.id}:${i}`} className="pd-print-page">
                        <ScaledPage page={page} scale={PRINT_SCALE}>
                            <PageCanvas
                                page={{...page, backgroundColor: entry.backgroundColor}}
                                elements={entry.elements}
                                record={record}
                                table={table}
                                scale={PRINT_SCALE}
                                scaleMode="zoom"
                                eagerImages
                            />
                        </ScaledPage>
                    </div>
                )),
            )}
        </div>
    );
}

// Print on demand. Mounts the (hidden) print layer, waits two frames for it to
// paint and for its eager images to load, then calls window.print(). afterprint
// unmounts it; a timer is the fallback for browsers that don't fire afterprint.
function usePrintMode(page) {
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        updatePrintPageStyle(page);
    }, [page]);

    useEffect(() => {
        const after = () => setPrinting(false);
        window.addEventListener('afterprint', after);
        return () => window.removeEventListener('afterprint', after);
    }, []);

    useEffect(() => {
        if (!printing) return undefined;
        let cancelled = false;
        const finish = () => {
            if (cancelled) return;
            window.print();
            window.setTimeout(() => setPrinting(false), 1000);
        };
        const run = () => {
            const pending = [...document.querySelectorAll('.pd-print-only img')].filter(
                (img) => !(img.complete && img.naturalWidth > 0),
            );
            if (pending.length === 0) {
                finish();
                return;
            }
            let remaining = pending.length;
            let settled = false;
            const go = () => {
                if (settled) return;
                settled = true;
                finish();
            };
            const one = () => {
                remaining -= 1;
                if (remaining <= 0) go();
            };
            pending.forEach((img) => {
                img.addEventListener('load', one, {once: true});
                img.addEventListener('error', one, {once: true});
            });
            window.setTimeout(go, 5000);
        };
        // Two frames so the print layer is in the DOM and laid out before printing.
        const id = requestAnimationFrame(() => requestAnimationFrame(run));
        return () => {
            cancelled = true;
            cancelAnimationFrame(id);
        };
    }, [printing]);

    const printNow = useCallback(() => setPrinting(true), []);

    // Route Cmd/Ctrl+P (focus inside the extension) through printNow so it waits
    // for images like the button does.
    useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                printNow();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [printNow]);

    return {printing, printNow};
}

// ════════════════════════════════════════════════════════════════════════════
//  Container sizing + fonts
// ════════════════════════════════════════════════════════════════════════════

function useContainerSize() {
    const [size, setSize] = useState({width: 0, height: 0});
    const observerRef = useRef(null);
    const ref = useCallback((node) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
        if (node) {
            const observer = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry) setSize({width: entry.contentRect.width, height: entry.contentRect.height});
            });
            observer.observe(node);
            setSize({width: node.clientWidth, height: node.clientHeight});
            observerRef.current = observer;
        }
    }, []);
    return [ref, size];
}

const FONT_FAMILIES = [
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Merriweather',
    'Playfair Display',
    'Oswald',
    'Source Sans 3',
    'Roboto Mono',
];

// Load web fonts by injecting a <link> (loadCSSFromURLAsync isn't in Omni's
// surface). A load failure degrades to system fonts, not a crash.
function ensureFontsLoaded() {
    if (document.getElementById('pd-fonts')) return;
    const families = FONT_FAMILIES.map((f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400;1,700`).join('&');
    const link = document.createElement('link');
    link.id = 'pd-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
}

function isTextEntryTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// ════════════════════════════════════════════════════════════════════════════
//  Toolbar primitives
// ════════════════════════════════════════════════════════════════════════════

function ToolbarButton({onClick, children, primary, title}) {
    const base =
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40';
    const look = primary
        ? 'bg-blue-blue text-white hover:bg-blue-blueDark1'
        : 'border border-gray-gray200 bg-white text-gray-gray700 hover:bg-gray-gray50 dark:border-gray-gray700 dark:bg-gray-gray800 dark:text-gray-gray100';
    return (
        <button type="button" onClick={onClick} title={title} className={`${base} ${look}`}>
            {children}
        </button>
    );
}

function Segmented({value, options, onChange}) {
    return (
        <div className="inline-flex rounded-md border border-gray-gray200 p-0.5 dark:border-gray-gray700">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${
                        value === opt.value
                            ? 'bg-gray-gray100 text-gray-gray700 dark:bg-gray-gray700 dark:text-white'
                            : 'text-gray-gray500 hover:text-gray-gray700'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function EmptyState({title, subtitle}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-gray500">
            <span style={{fontSize: 40, opacity: 0.5}}>📄</span>
            <div className="text-sm font-medium text-gray-gray600 dark:text-gray-gray300">{title}</div>
            {subtitle ? <div className="max-w-sm text-xs">{subtitle}</div> : null}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  View mode — the whole on-screen surface (ported from view/view_mode.js)
// ════════════════════════════════════════════════════════════════════════════

const MAX_CONTINUOUS_SHEETS = 100;

function PageDesignerView({page, pages, records, table, title}) {
    const {printing, printNow} = usePrintMode(page);
    const [scrollRef, containerSize] = useContainerSize();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [continuous, setContinuous] = useState(false);
    const [zoom, setZoom] = useState(null);
    const [presenting, setPresenting] = useState(false);
    const rootRef = useRef(null);
    const [stageRef, stageSize] = useContainerSize();

    const pageCount = Math.max(1, pages.length);
    const total = records.length * pageCount;

    const enterPresent = () => {
        setContinuous(false);
        setPresenting(true);
        rootRef.current?.requestFullscreen?.().catch(() => {});
    };
    const exitPresent = () => {
        setPresenting(false);
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };

    useEffect(() => {
        const onFsChange = () => {
            if (!document.fullscreenElement) setPresenting(false);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    useEffect(() => {
        setCurrentIndex((i) => Math.min(Math.max(i, 0), Math.max(total - 1, 0)));
    }, [total]);

    // Arrow/space paging (single-page mode + present).
    useEffect(() => {
        if (continuous) return undefined;
        const onKeyDown = (e) => {
            if (isTextEntryTarget(e.target)) return;
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                setCurrentIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (presenting && e.key === ' ')) {
                if (presenting) e.preventDefault();
                setCurrentIndex((i) => Math.min(i + 1, total - 1));
            } else if (e.key === 'Escape' && presenting) {
                exitPresent();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [total, continuous, presenting]);

    const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(total - 1, 0));
    const recordFor = (idx) => records[Math.floor(idx / pageCount)];
    const entryFor = (idx) => pages[idx % pageCount];
    const effectivePage = (entry) => ({...page, backgroundColor: entry.backgroundColor});
    const posLabel = (idx) => {
        const r = Math.floor(idx / pageCount) + 1;
        const p = (idx % pageCount) + 1;
        return pageCount > 1
            ? `Record ${r} of ${records.length} · Page ${p} of ${pageCount}`
            : `Record ${r} of ${records.length}`;
    };

    const totalElements = pages.reduce((n, e) => n + e.elements.length, 0);
    const continuousCapped = total > MAX_CONTINUOUS_SHEETS;
    const printCapped = total > MAX_PRINT_SHEETS;
    const maxPrintRecords = Math.max(1, Math.floor(MAX_PRINT_SHEETS / pageCount));
    const printRecords = printCapped ? records.slice(0, maxPrintRecords) : records;

    const {width: pageWidth, height: pageHeight} = resolvePageSizePx(page);
    const fitScale = containerSize.width > 0 ? Math.max(0.1, Math.min(1, (containerSize.width - 48) / pageWidth)) : 0.5;
    const scale = zoom != null ? zoom : fitScale;
    const applyZoom = (next) => setZoom(Math.max(0.25, Math.min(3, next)));

    const PRESENT_PADDING = 80;
    const presentScale =
        stageSize.width > 0 && stageSize.height > 0
            ? Math.max(
                  0.1,
                  Math.min(4, (stageSize.width - PRESENT_PADDING) / pageWidth, (stageSize.height - PRESENT_PADDING) / pageHeight),
              )
            : fitScale;

    if (totalElements === 0) {
        return (
            <EmptyState
                title="This layout is empty"
                subtitle="Edit the ELEMENTS block at the top of the source to add fields, text, and images."
            />
        );
    }
    if (records.length === 0) {
        return (
            <EmptyState
                title="No records to display"
                subtitle="This page renders one designed sheet per record in its source. Add records or adjust the source filter."
            />
        );
    }

    const visibleSheets = [];
    if (continuous) {
        for (let i = 0; i < Math.min(total, MAX_CONTINUOUS_SHEETS); i += 1) {
            const rec = recordFor(i);
            visibleSheets.push({key: `${rec.id}:${i % pageCount}`, record: rec, entry: entryFor(i)});
        }
    } else {
        const rec = recordFor(safeIndex);
        visibleSheets.push({key: `${rec ? rec.id : safeIndex}:${safeIndex % pageCount}`, record: rec, entry: entryFor(safeIndex)});
    }

    const presentRecord = recordFor(safeIndex);
    const presentEntry = entryFor(safeIndex);

    return (
        <div ref={rootRef} className="relative flex h-full flex-col bg-gray-gray50 dark:bg-gray-gray900">
            <div className="pd-screen-only flex flex-wrap items-center justify-between gap-2 border-b border-gray-gray200 bg-white px-4 py-2 dark:border-gray-gray700 dark:bg-gray-gray800">
                <div className="min-w-0">
                    <span className="truncate text-sm font-semibold text-gray-gray700 dark:text-gray-gray100">
                        {title || 'Page designer'}
                    </span>
                    <div className="text-xs text-gray-gray500">
                        {records.length} {records.length === 1 ? 'record' : 'records'}
                        {pageCount > 1 ? ` · ${pageCount} pages each` : ''}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {total > 1 ? (
                        <Segmented
                            value={continuous ? 'continuous' : 'single'}
                            options={[
                                {value: 'single', label: 'Single'},
                                {value: 'continuous', label: 'Continuous'},
                            ]}
                            onChange={(v) => setContinuous(v === 'continuous')}
                        />
                    ) : null}
                    {!continuous && total > 1 ? (
                        <span aria-live="polite" className="whitespace-nowrap text-xs tabular-nums text-gray-gray500">
                            {posLabel(safeIndex)}
                        </span>
                    ) : null}
                    <ToolbarButton onClick={enterPresent} title="Present full screen (arrow keys to move)">
                        Present
                    </ToolbarButton>
                    <ToolbarButton onClick={printNow} primary title="For exact sizing, set Margins: None and Scale: 100%.">
                        Print
                    </ToolbarButton>
                </div>
            </div>

            <div className="pd-screen-only border-b border-gray-gray200 bg-gray-gray25 px-4 py-1 text-[11px] text-gray-gray500 dark:border-gray-gray700 dark:bg-gray-gray800">
                For exact sizing, set <span className="font-medium">Margins: None</span> and{' '}
                <span className="font-medium">Scale: 100%</span> in the print dialog.
            </div>

            {(continuous && continuousCapped) || printCapped ? (
                <div className="pd-screen-only space-y-0.5 border-b border-yellow-yellowLight1 bg-yellow-yellowLight2 px-4 py-1 text-[11px] text-yellow-yellowDark1">
                    {continuous && continuousCapped ? (
                        <div>
                            Continuous view shows the first {MAX_CONTINUOUS_SHEETS} of {total} pages — switch to Single to page
                            through all of them.
                        </div>
                    ) : null}
                    {printCapped ? <div>Printing is limited to the first {maxPrintRecords * pageCount} of {total} pages.</div> : null}
                </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1 flex-col">
                <div ref={scrollRef} className="pd-screen-only flex-1 overflow-auto">
                    <div className="flex min-h-full w-max min-w-full flex-col items-center gap-4 p-6">
                        {visibleSheets.map((sheet) => (
                            <ScaledPage key={sheet.key} page={page} scale={scale}>
                                <PageCanvas
                                    page={effectivePage(sheet.entry)}
                                    elements={sheet.entry.elements}
                                    record={sheet.record}
                                    table={table}
                                    scale={scale}
                                />
                            </ScaledPage>
                        ))}
                    </div>
                </div>

                <div className="pd-screen-only pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-gray200 bg-white/95 px-1.5 py-1 shadow-md dark:border-gray-gray700 dark:bg-gray-gray800/95">
                    {!continuous && total > 1 ? (
                        <button
                            type="button"
                            onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                            disabled={safeIndex === 0}
                            className="pointer-events-auto rounded-full px-2 py-1 text-gray-gray600 hover:bg-gray-gray100 disabled:opacity-30 dark:text-gray-gray300"
                        >
                            ‹
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => applyZoom(scale - 0.1)}
                        className="pointer-events-auto rounded-full px-2 py-1 text-gray-gray600 hover:bg-gray-gray100 dark:text-gray-gray300"
                    >
                        −
                    </button>
                    <button
                        type="button"
                        onClick={() => setZoom(null)}
                        className="pointer-events-auto min-w-[3rem] rounded-full px-2 py-1 text-xs tabular-nums text-gray-gray600 hover:bg-gray-gray100 dark:text-gray-gray300"
                    >
                        {zoom == null ? 'Fit' : `${Math.round(scale * 100)}%`}
                    </button>
                    <button
                        type="button"
                        onClick={() => applyZoom(scale + 0.1)}
                        className="pointer-events-auto rounded-full px-2 py-1 text-gray-gray600 hover:bg-gray-gray100 dark:text-gray-gray300"
                    >
                        +
                    </button>
                    {!continuous && total > 1 ? (
                        <button
                            type="button"
                            onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
                            disabled={safeIndex === total - 1}
                            className="pointer-events-auto rounded-full px-2 py-1 text-gray-gray600 hover:bg-gray-gray100 disabled:opacity-30 dark:text-gray-gray300"
                        >
                            ›
                        </button>
                    ) : null}
                </div>
            </div>

            {presenting ? (
                <div ref={stageRef} className="pd-screen-only absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-gray-gray900">
                    <ScaledPage page={page} scale={presentScale}>
                        <PageCanvas page={effectivePage(presentEntry)} elements={presentEntry.elements} record={presentRecord} table={table} scale={presentScale} />
                    </ScaledPage>
                    <button
                        type="button"
                        aria-label="Exit presentation"
                        onClick={exitPresent}
                        title="Exit (Esc)"
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                    >
                        ×
                    </button>
                    {total > 1 ? (
                        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
                            <button
                                type="button"
                                aria-label="Previous page"
                                disabled={safeIndex === 0}
                                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                            >
                                ‹
                            </button>
                            <span aria-live="polite" className="rounded-full bg-black/50 px-3 py-1 text-center text-xs tabular-nums text-white">
                                {posLabel(safeIndex)}
                            </span>
                            <button
                                type="button"
                                aria-label="Next page"
                                disabled={safeIndex === total - 1}
                                onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                            >
                                ›
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {printing ? <PrintLayer page={page} pages={pages} records={printRecords} table={table} /> : null}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  Custom properties + root
// ════════════════════════════════════════════════════════════════════════════

function getCustomProperties(base) {
    return [
        {key: 'title', label: 'Title (optional)', type: 'string', defaultValue: ''},
        {key: 'table', label: 'Table', type: 'table', defaultValue: base.tables[0]},
    ];
}

// Root error boundary so a render throw shows a message, not a blank iframe.
class RootBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {failed: false};
    }
    static getDerivedStateFromError() {
        return {failed: true};
    }
    render() {
        if (this.state.failed) {
            return <EmptyState title="Something went wrong" subtitle="Reload the page. If it persists, check the browser console." />;
        }
        return this.props.children;
    }
}

function Designer({base}) {
    const {customPropertyValueByKey} = useCustomProperties(getCustomProperties);
    const table = (customPropertyValueByKey && customPropertyValueByKey.table) || base.tables[0];
    const title = (customPropertyValueByKey && customPropertyValueByKey.title) || '';
    const records = useRecords(table) || [];

    const page = {
        type: PAGE.type,
        orientation: PAGE.orientation,
        customSize: PAGE.customSize,
        backgroundColor: PAGE.backgroundColor || '#ffffff',
    };

    // Build the page list once. Fall back to an auto layout when no elements are
    // authored so a freshly swapped-in page still renders something.
    const pages = useMemo(() => {
        const authored = buildPages();
        const hasAny = authored.some((els) => els.length > 0);
        const list = hasAny ? authored : [autoLayout(table)];
        return list.map((elements) => ({backgroundColor: page.backgroundColor, elements}));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, page.backgroundColor]);

    return <PageDesignerView page={page} pages={pages} records={records} table={table} title={title} />;
}

function App() {
    useEffect(() => {
        ensureFontsLoaded();
    }, []);
    const base = useBase();
    const {colorScheme} = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <div className={isDark ? 'dark' : ''} style={{height: '100%'}}>
            <div className="h-full w-full bg-gray-gray50 font-sans text-gray-gray700 dark:bg-gray-gray900 dark:text-gray-gray100">
                <RootBoundary>
                    {base.tables.length === 0 ? <EmptyState title="This base has no tables" /> : <Designer base={base} />}
                </RootBoundary>
            </div>
        </div>
    );
}

initializeBlock({interface: () => <App />});
