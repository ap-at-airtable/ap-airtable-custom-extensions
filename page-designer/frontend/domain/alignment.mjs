// Pure align/distribute over a set of elements ({id, x, y, width, height}).
// Each returns a patches map {id: {x?} | {y?}} for only the axis that changes, so
// callers can apply it through the normal updateElement path. No SDK/React.

export const AlignMode = {
    LEFT: 'left',
    CENTER_H: 'centerH',
    RIGHT: 'right',
    TOP: 'top',
    MIDDLE_V: 'middleV',
    BOTTOM: 'bottom',
};

export const DistributeAxis = {HORIZONTAL: 'h', VERTICAL: 'v'};

// Align to the selection's bounding box. Needs >= 2 elements.
export function alignElements(elements, mode) {
    if (!Array.isArray(elements) || elements.length < 2) {
        return {};
    }
    const minL = Math.min(...elements.map((e) => e.x));
    const maxR = Math.max(...elements.map((e) => e.x + e.width));
    const minT = Math.min(...elements.map((e) => e.y));
    const maxB = Math.max(...elements.map((e) => e.y + e.height));
    const patches = {};
    for (const e of elements) {
        switch (mode) {
            case AlignMode.LEFT:
                patches[e.id] = {x: minL};
                break;
            case AlignMode.RIGHT:
                patches[e.id] = {x: maxR - e.width};
                break;
            case AlignMode.CENTER_H:
                patches[e.id] = {x: Math.round((minL + maxR) / 2 - e.width / 2)};
                break;
            case AlignMode.TOP:
                patches[e.id] = {y: minT};
                break;
            case AlignMode.BOTTOM:
                patches[e.id] = {y: maxB - e.height};
                break;
            case AlignMode.MIDDLE_V:
                patches[e.id] = {y: Math.round((minT + maxB) / 2 - e.height / 2)};
                break;
            default:
                break;
        }
    }
    return patches;
}

// Even spacing between the first and last element (by edge). Needs >= 3 elements.
export function distributeElements(elements, axis) {
    if (!Array.isArray(elements) || elements.length < 3) {
        return {};
    }
    const horizontal = axis === DistributeAxis.HORIZONTAL;
    const pos = (e) => (horizontal ? e.x : e.y);
    const size = (e) => (horizontal ? e.width : e.height);
    const sorted = [...elements].sort((a, b) => pos(a) - pos(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = pos(last) + size(last) - pos(first);
    const totalSize = sorted.reduce((sum, e) => sum + size(e), 0);
    const gap = (span - totalSize) / (sorted.length - 1);
    const patches = {};
    let cursor = pos(first);
    for (const e of sorted) {
        patches[e.id] = horizontal ? {x: Math.round(cursor)} : {y: Math.round(cursor)};
        cursor += size(e) + gap;
    }
    return patches;
}
