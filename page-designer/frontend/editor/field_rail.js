// Left rail listing the source table's fields. Drag a field onto the canvas to
// place it, or check several and "Add" them at once (grid-placed). Dragging a field
// that's part of the checkbox selection drags the whole selection.

import {useState} from 'react';
import {Button} from '../ui/primitives.js';
import {FieldTypeIcon} from '../ui/field_icons.js';

// Payload key for a field drag (read by EditorCanvas's onDrop).
export const FIELD_DRAG_TYPE = 'application/x-pd-fields';

export function FieldRail({fields, onAddFields}) {
    const [selected, setSelected] = useState(() => new Set());

    const toggle = (id) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const allSelected = fields.length > 0 && selected.size === fields.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(fields.map((f) => f.id)));

    // Drag the whole checkbox selection if the dragged field is part of it.
    const dragIdsFor = (id) => (selected.has(id) && selected.size > 1 ? [...selected] : [id]);
    const onDragStart = (e, id) => {
        e.dataTransfer.setData(FIELD_DRAG_TYPE, JSON.stringify(dragIdsFor(id)));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex items-center justify-between border-b border-gray-gray200 px-3 py-2 dark:border-gray-gray700">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-gray500 dark:text-gray-gray400">
                    Fields
                </span>
                {fields.length ? (
                    <button
                        type="button"
                        onClick={toggleAll}
                        className="text-[11px] font-medium text-blue-blue hover:underline"
                    >
                        {allSelected ? 'Clear' : 'Select all'}
                    </button>
                ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
                {fields.map((f) => (
                    <div
                        key={f.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, f.id)}
                        title="Drag onto the page"
                        className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-gray700 hover:bg-gray-gray50 active:cursor-grabbing dark:text-gray-gray100 dark:hover:bg-gray-gray700"
                    >
                        <input
                            type="checkbox"
                            checked={selected.has(f.id)}
                            onChange={() => toggle(f.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5 shrink-0 accent-blue-blue"
                        />
                        <span className="shrink-0 text-gray-gray500 dark:text-gray-gray400" title={f.type}>
                            <FieldTypeIcon type={f.type} size={16} />
                        </span>
                        <span className="min-w-0 flex-1 break-words">{f.name}</span>
                    </div>
                ))}
            </div>

            {selected.size > 0 ? (
                <div className="border-t border-gray-gray200 p-2 dark:border-gray-gray700">
                    <Button
                        size="sm"
                        variant="primary"
                        className="w-full"
                        onClick={() => {
                            onAddFields([...selected]);
                            setSelected(new Set());
                        }}
                    >
                        Add {selected.size} {selected.size === 1 ? 'field' : 'fields'}
                    </Button>
                </div>
            ) : (
                <div className="border-t border-gray-gray200 px-3 py-2 text-[11px] leading-snug text-gray-gray500 dark:border-gray-gray700 dark:text-gray-gray400">
                    Drag a field onto the page, or check several and add them at once.
                </div>
            )}
        </div>
    );
}
