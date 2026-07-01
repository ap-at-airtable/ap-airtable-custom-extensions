// Dependency-free drag-to-reorder list. Each item is {id, ...}; the caller
// renders the row body via renderItem and gets the reordered array on drop.
// Pointer gesture mirrors editor_canvas.js's beginGesture (window listeners
// added on pointerdown, removed on pointerup). Order changes commit live.

import {useRef, useState} from 'react';

function GripIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="2" r="1" />
            <circle cx="8" cy="2" r="1" />
            <circle cx="4" cy="6" r="1" />
            <circle cx="8" cy="6" r="1" />
            <circle cx="4" cy="10" r="1" />
            <circle cx="8" cy="10" r="1" />
        </svg>
    );
}

export function ReorderableList({items, onReorder, renderItem}) {
    const [draggingId, setDraggingId] = useState(null);
    // Holds the live order + row geometry for the in-flight gesture so listeners
    // see fresh values without re-subscribing on every reorder.
    const gesture = useRef(null);

    const startDrag = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget;
        const pointerId = e.pointerId;
        try {
            target.setPointerCapture?.(pointerId);
        } catch {
            // Best-effort; window listeners still drive the drag.
        }
        const rows = Array.from(
            e.currentTarget.closest('[data-reorderable]').querySelectorAll('[data-row-id]'),
        );
        const midpoints = rows.map((el) => {
            const r = el.getBoundingClientRect();
            return {id: el.getAttribute('data-row-id'), mid: r.top + r.height / 2};
        });
        gesture.current = {order: items.map((it) => it.id), midpoints};
        setDraggingId(id);

        const move = (ev) => {
            const g = gesture.current;
            if (!g) return;
            const from = g.order.indexOf(id);
            if (from === -1) return;
            let to = from;
            // Walk toward the pointer one slot at a time past each neighbor's midpoint.
            while (to > 0 && ev.clientY < midForId(g, g.order[to - 1])) to -= 1;
            while (to < g.order.length - 1 && ev.clientY > midForId(g, g.order[to + 1])) to += 1;
            if (to !== from) {
                const next = [...g.order];
                next.splice(from, 1);
                next.splice(to, 0, id);
                g.order = next;
                onReorder(next);
            }
        };
        const end = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            try {
                target.releasePointerCapture?.(pointerId);
            } catch {
                // Ignore: capture may already be gone (e.g. the row unmounted).
            }
            gesture.current = null;
            setDraggingId(null);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        // pointercancel fires if capture is lost mid-drag (unmount), preventing a leak.
        window.addEventListener('pointercancel', end);
    };

    return (
        <div data-reorderable className="space-y-1">
            {items.map((item) => {
                const dragging = item.id === draggingId;
                return (
                    <div
                        key={item.id}
                        data-row-id={item.id}
                        className={
                            'flex items-center gap-1.5 rounded-md border px-1.5 py-1 ' +
                            (dragging
                                ? 'border-blue-blue bg-blue-blueLight2 opacity-90 shadow-sm dark:bg-blue-blueDark1'
                                : 'border-gray-gray200 bg-white dark:border-gray-gray600 dark:bg-gray-gray800')
                        }
                    >
                        <button
                            type="button"
                            aria-label="Drag to reorder"
                            title="Drag to reorder"
                            onPointerDown={(e) => startDrag(e, item.id)}
                            className="shrink-0 cursor-grab touch-none text-gray-gray400 hover:text-gray-gray600 active:cursor-grabbing dark:hover:text-gray-gray200"
                        >
                            <GripIcon />
                        </button>
                        {renderItem(item)}
                    </div>
                );
            })}
        </div>
    );
}

// Midpoint captured at drag start; rows don't resize mid-gesture so this stays valid.
function midForId(g, id) {
    const m = g.midpoints.find((p) => p.id === id);
    return m ? m.mid : Infinity;
}
