// Interactive editing surface: the read-only PageCanvas plus an overlay that
// adds selection, move, 8-way resize, and rotate. Supports multi-select
// (shift/cmd-click and drag-marquee); a move drags the whole selection together.
// Gestures emit a {id: patch} map — onPreview live, onCommit on release — applied
// to the latest local layout. Resize/rotate are single-selection only.

import {useRef, useState} from 'react';
import {resolvePageSizePx, PAGE_GRID_SIZE, snapToGrid} from '../domain/page_geometry.mjs';
import {getOrderedElements, clampElementToPage, clampGroupDelta} from '../domain/layout_model.mjs';
import {PageCanvas} from '../render/page_canvas.js';
import {FIELD_DRAG_TYPE} from './field_rail.js';

const HANDLES = [
    {key: 'nw', dirX: -1, dirY: -1, cursor: 'nwse-resize', left: 0, top: 0},
    {key: 'n', dirX: 0, dirY: -1, cursor: 'ns-resize', left: '50%', top: 0},
    {key: 'ne', dirX: 1, dirY: -1, cursor: 'nesw-resize', left: '100%', top: 0},
    {key: 'e', dirX: 1, dirY: 0, cursor: 'ew-resize', left: '100%', top: '50%'},
    {key: 'se', dirX: 1, dirY: 1, cursor: 'nwse-resize', left: '100%', top: '100%'},
    {key: 's', dirX: 0, dirY: 1, cursor: 'ns-resize', left: '50%', top: '100%'},
    {key: 'sw', dirX: -1, dirY: 1, cursor: 'nesw-resize', left: 0, top: '100%'},
    {key: 'w', dirX: -1, dirY: 0, cursor: 'ew-resize', left: 0, top: '50%'},
];

function beginGesture(e, {onMove, onEnd}) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    // Capture so a pointerup released outside the iframe still reaches us (else the
    // gesture strands, listeners leak, and dragOverride masks the real layout).
    try {
        target.setPointerCapture?.(pointerId);
    } catch {
        // Capture is best-effort; the window listeners below still drive the gesture.
    }
    const move = (ev) => onMove({dx: ev.clientX - startX, dy: ev.clientY - startY, event: ev});
    const cleanup = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cleanup);
        try {
            target.releasePointerCapture?.(pointerId);
        } catch {
            // Ignore: capture may already be gone (e.g. the element unmounted).
        }
    };
    const up = (ev) => {
        cleanup();
        if (onEnd) onEnd({dx: ev.clientX - startX, dy: ev.clientY - startY, event: ev});
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cleanup);
}

export function EditorCanvas({
    page,
    layout,
    record,
    table,
    selectedIds,
    scale,
    showGrid,
    onSelect,
    onToggle,
    onPreview,
    onCommit,
    onDropFields,
}) {
    const overlayRef = useRef(null);
    const [marquee, setMarquee] = useState(null);
    const {width: pageW, height: pageH} = resolvePageSizePx(page);
    const elements = getOrderedElements(layout);
    const isSingle = selectedIds.length === 1;

    // Move the whole selection by one clamped, grid-snapped delta (keeps spacing).
    const startMove = (e, ids) => {
        const starts = ids.map((id) => layout.elementsById[id]).filter(Boolean);
        const patchesFor = (dx, dy) => {
            const {sdx, sdy} = clampGroupDelta(
                snapToGrid(dx / scale),
                snapToGrid(dy / scale),
                starts,
                pageW,
                pageH,
            );
            const p = {};
            for (const s of starts) {
                p[s.id] = {x: s.x + sdx, y: s.y + sdy};
            }
            return p;
        };
        beginGesture(e, {
            onMove: ({dx, dy}) => onPreview(patchesFor(dx, dy)),
            onEnd: ({dx, dy}) => onCommit(patchesFor(dx, dy)),
        });
    };

    const computeResized = (start, dir, dx, dy) => {
        const ddx = dx / scale;
        const ddy = dy / scale;
        const right = start.x + start.width;
        const bottom = start.y + start.height;
        let {x, y, width, height} = start;
        if (dir.dirX === 1) width = start.width + ddx;
        if (dir.dirX === -1) width = start.width - ddx;
        if (dir.dirY === 1) height = start.height + ddy;
        if (dir.dirY === -1) height = start.height - ddy;
        width = Math.max(PAGE_GRID_SIZE, snapToGrid(width));
        height = Math.max(PAGE_GRID_SIZE, snapToGrid(height));
        // West/north handles: cap the size at the anchored edge so x/y stay >= 0 and
        // the later clamp never has to move the anchored edge (avoids a far-edge jump).
        if (dir.dirX === -1) {
            width = Math.min(width, right);
            x = right - width;
        }
        if (dir.dirY === -1) {
            height = Math.min(height, bottom);
            y = bottom - height;
        }
        return clampElementToPage({x: snapToGrid(x), y: snapToGrid(y), width, height}, pageW, pageH);
    };

    const startResize = (e, id, dir) => {
        const start = layout.elementsById[id];
        beginGesture(e, {
            onMove: ({dx, dy}) => onPreview({[id]: computeResized(start, dir, dx, dy)}),
            onEnd: ({dx, dy}) => onCommit({[id]: computeResized(start, dir, dx, dy)}),
        });
    };

    const startRotate = (e, id) => {
        const start = layout.elementsById[id];
        const rect = overlayRef.current.getBoundingClientRect();
        const cx = rect.left + (start.x + start.width / 2) * scale;
        const cy = rect.top + (start.y + start.height / 2) * scale;
        const angleFor = (ev) => {
            let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
            if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
            deg = Math.round(((deg % 360) + 360) % 360);
            return deg > 180 ? deg - 360 : deg;
        };
        beginGesture(e, {
            onMove: ({event}) => onPreview({[id]: {rotation: angleFor(event)}}),
            onEnd: ({event}) => onCommit({[id]: {rotation: angleFor(event)}}),
        });
    };

    // Drag on empty canvas = rubber-band select; a click with no drag deselects.
    const startMarquee = (e) => {
        const rect = overlayRef.current.getBoundingClientRect();
        const toPage = (ev) => ({
            x: (ev.clientX - rect.left) / scale,
            y: (ev.clientY - rect.top) / scale,
        });
        const origin = toPage(e);
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        beginGesture(e, {
            onMove: ({event}) => {
                const cur = toPage(event);
                setMarquee({x0: origin.x, y0: origin.y, x1: cur.x, y1: cur.y});
            },
            onEnd: ({dx, dy, event}) => {
                setMarquee(null);
                if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
                    if (!additive) onSelect([]);
                    return;
                }
                const cur = toPage(event);
                const x0 = Math.min(origin.x, cur.x);
                const x1 = Math.max(origin.x, cur.x);
                const y0 = Math.min(origin.y, cur.y);
                const y1 = Math.max(origin.y, cur.y);
                const hitIds = elements
                    .filter(
                        (el) =>
                            el.x < x1 && el.x + el.width > x0 && el.y < y1 && el.y + el.height > y0,
                    )
                    .map((el) => el.id);
                onSelect(additive ? [...new Set([...selectedIds, ...hitIds])] : hitIds);
            },
        });
    };

    // Accept fields dragged from the Field rail: drop places them at the cursor.
    const onDragOver = (e) => {
        if (e.dataTransfer.types.includes(FIELD_DRAG_TYPE)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    };
    const onDrop = (e) => {
        const data = e.dataTransfer.getData(FIELD_DRAG_TYPE);
        if (!data || !onDropFields) return;
        e.preventDefault();
        let ids;
        try {
            ids = JSON.parse(data);
        } catch {
            return;
        }
        const rect = overlayRef.current.getBoundingClientRect();
        const x = snapToGrid((e.clientX - rect.left) / scale);
        const y = snapToGrid((e.clientY - rect.top) / scale);
        onDropFields(ids, x, y);
    };

    return (
        <div
            ref={overlayRef}
            onPointerDown={startMarquee}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{position: 'relative', width: pageW * scale, height: pageH * scale, flex: 'none'}}
        >
            <div style={{position: 'absolute', top: 0, left: 0}}>
                <PageCanvas page={page} layout={layout} record={record} table={table} scale={scale} editor />
            </div>

            {showGrid ? (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage:
                            'linear-gradient(to right, rgba(22,110,225,0.14) 1px, transparent 1px),' +
                            'linear-gradient(to bottom, rgba(22,110,225,0.14) 1px, transparent 1px)',
                        backgroundSize: `${PAGE_GRID_SIZE * scale}px ${PAGE_GRID_SIZE * scale}px`,
                    }}
                />
            ) : null}

            {elements.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                    <div className="max-w-xs text-center text-gray-gray500">
                        <div className="text-sm font-medium text-gray-gray500">Empty page</div>
                        <div className="mt-1 text-xs">
                            Add a field, text, image, or barcode from the toolbar above to start
                            designing.
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{position: 'absolute', inset: 0}}>
                {elements.map((element) => {
                    const selected = selectedIds.includes(element.id);
                    return (
                        <div
                            key={element.id}
                            onPointerDown={(e) => {
                                const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                                if (additive) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onToggle(element.id);
                                    return;
                                }
                                const moveIds = selected ? selectedIds : [element.id];
                                if (!selected) onSelect([element.id]);
                                startMove(e, moveIds);
                            }}
                            style={{
                                position: 'absolute',
                                left: element.x * scale,
                                top: element.y * scale,
                                width: element.width * scale,
                                height: element.height * scale,
                                transform: element.rotation
                                    ? `rotate(${element.rotation}deg)`
                                    : undefined,
                                transformOrigin: 'center center',
                                cursor: 'move',
                                outline: selected
                                    ? '1.5px solid rgb(22,110,225)'
                                    : '1px solid rgba(22,110,225,0.12)',
                                outlineOffset: selected ? '1px' : 0,
                                boxSizing: 'border-box',
                            }}
                        >
                            {/* Resize/rotate handles only for a single selection. */}
                            {selected && isSingle ? (
                                <>
                                    <div
                                        onPointerDown={(e) => startRotate(e, element.id)}
                                        style={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: -24,
                                            width: 12,
                                            height: 12,
                                            transform: 'translate(-50%,-50%)',
                                            borderRadius: '50%',
                                            background: '#fff',
                                            border: '1.5px solid rgb(22,110,225)',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                                            cursor: 'grab',
                                        }}
                                    />
                                    {element.rotation === 0
                                        ? HANDLES.map((h) => (
                                              <div
                                                  key={h.key}
                                                  onPointerDown={(e) =>
                                                      startResize(e, element.id, h)
                                                  }
                                                  style={{
                                                      position: 'absolute',
                                                      left: h.left,
                                                      top: h.top,
                                                      width: 9,
                                                      height: 9,
                                                      transform: 'translate(-50%,-50%)',
                                                      borderRadius: 2,
                                                      background: '#fff',
                                                      border: '1.5px solid rgb(22,110,225)',
                                                      boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                                                      cursor: h.cursor,
                                                  }}
                                              />
                                          ))
                                        : null}
                                </>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            {marquee ? (
                <div
                    className="pointer-events-none absolute border border-dashed border-blue-blue bg-blue-blue/10"
                    style={{
                        left: Math.min(marquee.x0, marquee.x1) * scale,
                        top: Math.min(marquee.y0, marquee.y1) * scale,
                        width: Math.abs(marquee.x1 - marquee.x0) * scale,
                        height: Math.abs(marquee.y1 - marquee.y0) * scale,
                    }}
                />
            ) : null}
        </div>
    );
}
