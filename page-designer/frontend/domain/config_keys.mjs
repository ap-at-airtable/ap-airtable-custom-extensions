// GlobalConfig keys + the layout document shape persisted per page element.
// Pure module.

import {PageType, PageOrientation, convertLengthFromInchesToPx} from './page_geometry.mjs';

// Stamped on every save as a forward-marker. Nothing reads it today (hydrateLayout
// normalizes version-agnostically by merging over defaults); a future v2 that needs
// a real migration should branch on it in hydrateLayout rather than assume one exists.
export const SCHEMA_VERSION = 1;

export const ConfigKey = {
    SCHEMA_VERSION: 'schemaVersion',
    PAGE: 'page',
    LAYOUT: 'layout',
};

export function defaultPage() {
    return {
        type: PageType.LETTER,
        orientation: PageOrientation.PORTRAIT,
        backgroundColor: '#ffffff',
        customSize: {
            width: Math.round(convertLengthFromInchesToPx(8.5)),
            height: Math.round(convertLengthFromInchesToPx(11)),
        },
    };
}

export function defaultLayout() {
    return {order: [], elementsById: {}};
}

// Full default config document for a brand-new installation.
export function defaultConfigDocument() {
    return {
        [ConfigKey.SCHEMA_VERSION]: SCHEMA_VERSION,
        [ConfigKey.PAGE]: defaultPage(),
        [ConfigKey.LAYOUT]: defaultLayout(),
    };
}
