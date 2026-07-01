// Page geometry: sizes, orientation, grid, and inch->px conversion.
// Pure module (no SDK, no React) so it is unit-testable with `node --test`.

export const PageType = {
    LETTER: 'LETTER',
    LEGAL: 'LEGAL',
    A4: 'A4',
    A5: 'A5',
    INDEX_CARD: 'INDEX_CARD',
    BUSINESS_CARD: 'BUSINESS_CARD',
    SLIDE_16_9: 'SLIDE_16_9',
    SLIDE_4_3: 'SLIDE_4_3',
    CUSTOM: 'CUSTOM',
};

// Slides are inherently landscape, so orientation doesn't apply to them.
export function pageTypeSupportsOrientation(pageType) {
    return (
        pageType !== PageType.CUSTOM &&
        pageType !== PageType.SLIDE_16_9 &&
        pageType !== PageType.SLIDE_4_3
    );
}

export const PageOrientation = {
    PORTRAIT: 'PORTRAIT',
    LANDSCAPE: 'LANDSCAPE',
};

// Grid the editor snaps to, in page px.
export const PAGE_GRID_SIZE = 10;

// Custom page sizes are clamped so a 0/blank input can't yield a 0in @page (which
// makes the printer fall back to its default sheet), and an absurd value can't
// try to paint a multi-million-px canvas.
export const MIN_CUSTOM_SIZE_INCHES = 0.5;
export const MAX_CUSTOM_SIZE_INCHES = 48;

// Screen px per inch used to map physical page sizes into the coordinate space.
// Matches the legacy Page Designer value so layouts feel identical.
export const DPI = 109;

const PAGE_SIZES_INCHES = {
    [PageType.LETTER]: {width: 8.5, height: 11},
    [PageType.LEGAL]: {width: 8.5, height: 14},
    [PageType.A4]: {width: 8.268, height: 11.693},
    [PageType.A5]: {width: 5.827, height: 8.268},
    [PageType.INDEX_CARD]: {width: 3, height: 5},
    [PageType.BUSINESS_CARD]: {width: 2, height: 3.5},
    // Stored landscape (width > height) so the default renders as a wide slide.
    [PageType.SLIDE_16_9]: {width: 13.333, height: 7.5},
    [PageType.SLIDE_4_3]: {width: 10, height: 7.5},
};

export const PAGE_TYPE_LABELS = {
    [PageType.LETTER]: 'Letter (8.5" × 11")',
    [PageType.LEGAL]: 'Legal (8.5" × 14")',
    [PageType.A4]: 'A4',
    [PageType.A5]: 'A5',
    [PageType.INDEX_CARD]: 'Index card (3" × 5")',
    [PageType.BUSINESS_CARD]: 'Business card (2" × 3.5")',
    [PageType.SLIDE_16_9]: 'Slide 16:9',
    [PageType.SLIDE_4_3]: 'Slide 4:3',
    [PageType.CUSTOM]: 'Custom size',
};

export function convertLengthFromInchesToPx(lengthInches) {
    return lengthInches * DPI;
}

export function convertSizeFromInchesToPx({width, height}) {
    return {
        width: convertLengthFromInchesToPx(width),
        height: convertLengthFromInchesToPx(height),
    };
}

export function getPageSizeInches(pageType) {
    return PAGE_SIZES_INCHES[pageType] ?? PAGE_SIZES_INCHES[PageType.LETTER];
}

// Returns the page size in px for a non-custom page type, honoring orientation.
// Height is floored: you cannot print fractional px and Chrome otherwise spills
// content onto blank extra pages (legacy behavior, preserved deliberately).
export function getStandardPageSizePx(pageType, orientation) {
    const {width, height} = convertSizeFromInchesToPx(getPageSizeInches(pageType));
    if (orientation === PageOrientation.LANDSCAPE) {
        return {width: height, height: Math.floor(width)};
    }
    return {width, height: Math.floor(height)};
}

// Resolves the effective page size in px for any page config (custom or standard).
export function resolvePageSizePx(page) {
    if (page.type === PageType.CUSTOM) {
        const min = convertLengthFromInchesToPx(MIN_CUSTOM_SIZE_INCHES);
        const max = convertLengthFromInchesToPx(MAX_CUSTOM_SIZE_INCHES);
        const clamp = (v, fallbackInches) => {
            const px = Number.isFinite(v) ? v : convertLengthFromInchesToPx(fallbackInches);
            return Math.round(Math.min(max, Math.max(min, px)));
        };
        return {
            width: clamp(page.customSize?.width, 8.5),
            height: clamp(page.customSize?.height, 11),
        };
    }
    return getStandardPageSizePx(page.type, page.orientation);
}

export function snapToGrid(value, grid = PAGE_GRID_SIZE) {
    return Math.round(value / grid) * grid;
}
