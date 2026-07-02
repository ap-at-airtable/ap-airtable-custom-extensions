// GlobalConfig keys + the persisted document shape. Pure module.
//
// v2 document: one shared page geometry (`page`) plus a `pages` array, where each
// entry is one page of the document ({backgroundColor, layout}). Each record renders
// every page in order. v1 (single `page` + `layout`) is migrated on read.

import {PageType, PageOrientation, convertLengthFromInchesToPx} from './page_geometry.mjs';

export const SCHEMA_VERSION = 2;

export const ConfigKey = {
    SCHEMA_VERSION: 'schemaVersion',
    PAGE: 'page', // shared page geometry (type/orientation/customSize)
    PAGES: 'pages', // per-page entries: [{backgroundColor, layout}]
    LAYOUT: 'layout', // legacy v1 key, read-only for migration
};

// Shared page geometry (size). Background is per-page (see defaultPageEntry).
export function defaultPage() {
    return {
        type: PageType.LETTER,
        orientation: PageOrientation.PORTRAIT,
        customSize: {
            width: Math.round(convertLengthFromInchesToPx(8.5)),
            height: Math.round(convertLengthFromInchesToPx(11)),
        },
    };
}

export function defaultLayout() {
    return {order: [], elementsById: {}};
}

// One page of the document.
export function defaultPageEntry() {
    return {backgroundColor: '#ffffff', layout: defaultLayout()};
}

// Full default config document for a brand-new installation.
export function defaultConfigDocument() {
    return {
        [ConfigKey.SCHEMA_VERSION]: SCHEMA_VERSION,
        [ConfigKey.PAGE]: defaultPage(),
        [ConfigKey.PAGES]: [defaultPageEntry()],
    };
}
