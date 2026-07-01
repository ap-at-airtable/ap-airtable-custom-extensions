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
        padding: 0,
        borderWidth: 0,
        borderColor: '#cccccc',
        borderRadius: 0,
        imageFit: ImageFit.CONTAIN,
        showFieldLabel: false,
        linkedRecordDisplay: LinkedRecordDisplay.COMMA,
        lineColor: '#1d1f25',
        lineThickness: 1,
        // Value formatting for FIELD elements (numberFormat 'auto' = the field's
        // own display string).
        numberFormat: 'auto',
        decimals: null,
        prefix: '',
        suffix: '',
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
        text: kind === ElementKind.TEXT ? 'Text' : '',
        imageSource: kind === ElementKind.IMAGE ? ImageSource.ATTACHMENT : null,
        imageUrl: '',
        imageAlt: '', // alt text for a static image (attachment images use the field name)
        barcodeFormat: kind === ElementKind.BARCODE ? BarcodeFormat.CODE128 : null,
        // Linked-table field ids shown as columns when a linked field renders as a table.
        linkedColumns: [],
        // Conditional rules ({visibility, color}); null = always shown, base color.
        rules: null,
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
    return {
        ...base,
        ...raw,
        // Sanitize geometry: a corrupt/legacy non-numeric x/y would otherwise pass
        // through and break absolute positioning.
        x: typeof raw.x === 'number' ? raw.x : 0,
        y: typeof raw.y === 'number' ? raw.y : 0,
        style: {...base.style, ...(raw.style && typeof raw.style === 'object' ? raw.style : {})},
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
