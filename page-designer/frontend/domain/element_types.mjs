// Element schema for the page layout. A fresh, query-container-native model
// (no legacy FIELD/STATIC split, no per-table layouts). Pure module.

import {PAGE_GRID_SIZE} from './page_geometry.mjs';

export const ElementKind = {
    FIELD: 'field', // a field's value rendered as text
    TEXT: 'text', // static text
    IMAGE: 'image', // attachment-field image or a static image URL
    BARCODE: 'barcode', // 1D barcode from a field value
    QR_CODE: 'qrcode', // QR code from a field value
    LINE: 'line', // a horizontal/vertical divider
};

export const ElementKindLabels = {
    [ElementKind.FIELD]: 'Field',
    [ElementKind.TEXT]: 'Text',
    [ElementKind.IMAGE]: 'Image',
    [ElementKind.BARCODE]: 'Barcode',
    [ElementKind.QR_CODE]: 'QR code',
    [ElementKind.LINE]: 'Line',
};

export const ImageSource = {
    ATTACHMENT: 'attachment',
    STATIC: 'static',
};

export const ImageFit = {
    CONTAIN: 'contain',
    COVER: 'cover',
    FILL: 'fill',
};

// Starter content for a new Text element; the inspector treats it as a
// placeholder (focus selects it all so typing replaces it).
export const DEFAULT_TEXT_CONTENT = 'Text';

export const TextAlign = {LEFT: 'left', CENTER: 'center', RIGHT: 'right'};
export const VerticalAlign = {TOP: 'top', MIDDLE: 'middle', BOTTOM: 'bottom'};

// How a linked-record field renders its linked records.
export const LinkedRecordDisplay = {COMMA: 'comma', LIST: 'list', TABLE: 'table'};

// 1D barcode formats supported by jsbarcode (loaded at runtime).
export const BarcodeFormat = {
    CODE128: 'CODE128',
    CODE39: 'CODE39',
    EAN13: 'EAN13',
    UPC: 'UPC',
    ITF14: 'ITF14',
};

export const DEFAULT_FONT = 'Inter';

export function defaultStyle() {
    return {
        fontFamily: DEFAULT_FONT,
        fontSize: 16,
        fontWeight: 'normal', // 'normal' | 'bold'
        fontStyle: 'normal', // 'normal' | 'italic'
        underline: false,
        color: '#1d1f25',
        backgroundColor: 'transparent',
        textAlign: TextAlign.LEFT,
        verticalAlign: VerticalAlign.TOP,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        borderWidth: 0,
        borderColor: '#cccccc',
        borderRadius: 0,
        imageFit: ImageFit.CONTAIN,
        showFieldLabel: false,
        linkedRecordDisplay: LinkedRecordDisplay.COMMA,
        // Linked-record table styling: header cell fill and zebra row shading.
        tableHeaderColor: '#f3f3f5',
        tableStripeRows: true,
        // Empty = header text inherits the element's text color (body text always does).
        tableHeaderTextColor: '',
        // Defaults match the previous hardcoded rgba values as rendered on white.
        tableBorderColor: '#d9d9d9',
        tableStripeColor: '#f4f4f5',
        // How a select value renders: 'text', 'pill' (colored chip), or 'stepper'
        // (single-select only). Text/pill apply to single- and multi-select.
        selectDisplay: 'text',
        // Stepper style when selectDisplay==='stepper': 'radio' or 'number'. The
        // selected step is drawn in its choice's own color (no separate setting).
        stepperVariant: 'radio',
        // Let viewers edit this field's value inline (view mode only, supported types).
        editable: false,
        lineColor: '#1d1f25',
        lineThickness: 1,
    };
}

const KIND_DEFAULT_SIZE = {
    [ElementKind.FIELD]: {width: 20 * PAGE_GRID_SIZE, height: 4 * PAGE_GRID_SIZE},
    [ElementKind.TEXT]: {width: 24 * PAGE_GRID_SIZE, height: 4 * PAGE_GRID_SIZE},
    [ElementKind.IMAGE]: {width: 18 * PAGE_GRID_SIZE, height: 18 * PAGE_GRID_SIZE},
    [ElementKind.BARCODE]: {width: 24 * PAGE_GRID_SIZE, height: 8 * PAGE_GRID_SIZE},
    [ElementKind.QR_CODE]: {width: 12 * PAGE_GRID_SIZE, height: 12 * PAGE_GRID_SIZE},
    [ElementKind.LINE]: {width: 24 * PAGE_GRID_SIZE, height: PAGE_GRID_SIZE},
};

export function defaultSizeForKind(kind) {
    return KIND_DEFAULT_SIZE[kind] ?? {width: 20 * PAGE_GRID_SIZE, height: 4 * PAGE_GRID_SIZE};
}

// Builds a new element of `kind` positioned at (x, y). Caller supplies an id so
// id generation stays injectable/testable.
export function makeElement({id, kind, x, y, fieldId = null, overrides = {}}) {
    const size = defaultSizeForKind(kind);
    const base = {
        id,
        kind,
        x,
        y,
        width: size.width,
        height: size.height,
        rotation: 0,
        fieldId,
        text: kind === ElementKind.TEXT ? DEFAULT_TEXT_CONTENT : '',
        imageSource: kind === ElementKind.IMAGE ? ImageSource.ATTACHMENT : null,
        imageUrl: '',
        imageAlt: '', // alt text for a static image (attachment images use the field name)
        barcodeFormat: kind === ElementKind.BARCODE ? BarcodeFormat.CODE128 : null,
        // Linked-table field ids shown as columns when a linked field renders as a table.
        linkedColumns: [],
        // Per-column width fractions (fieldId -> fraction); missing = equal share.
        linkedColumnWidths: {},
        style: defaultStyle(),
    };
    return {...base, ...overrides, style: {...base.style, ...(overrides.style ?? {})}};
}

// Normalizes a stored element against the current defaults so a document written
// by an older version (missing style keys, missing fields added later) renders
// safely without every read site defending against undefined. Returns null for a
// non-object so a corrupt entry is dropped rather than crashing the render.
export function hydrateElement(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const base = makeElement({id: raw.id, kind: raw.kind, x: 0, y: 0});
    const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    const rawStyle = raw.style && typeof raw.style === 'object' ? raw.style : {};
    const style = {...base.style, ...rawStyle};
    // Older docs stored one uniform `padding`; spread it to the per-side keys
    // (only where a per-side value wasn't already written).
    if (typeof rawStyle.padding === 'number' && Number.isFinite(rawStyle.padding)) {
        for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
            if (typeof rawStyle[side] !== 'number') {
                style[side] = rawStyle.padding;
            }
        }
    }
    return {
        ...base,
        ...raw,
        // Sanitize everything the renderer does math on: corrupt/legacy values
        // (non-numeric geometry, non-array columns) must not reach layout code.
        x: num(raw.x, 0),
        y: num(raw.y, 0),
        width: Math.max(1, num(raw.width, base.width)),
        height: Math.max(1, num(raw.height, base.height)),
        rotation: num(raw.rotation, 0),
        linkedColumns: Array.isArray(raw.linkedColumns) ? raw.linkedColumns : [],
        linkedColumnWidths:
            raw.linkedColumnWidths && typeof raw.linkedColumnWidths === 'object' && !Array.isArray(raw.linkedColumnWidths)
                ? raw.linkedColumnWidths
                : {},
        style,
    };
}

export function kindUsesField(kind) {
    return (
        kind === ElementKind.FIELD ||
        kind === ElementKind.BARCODE ||
        kind === ElementKind.QR_CODE ||
        kind === ElementKind.IMAGE
    );
}
