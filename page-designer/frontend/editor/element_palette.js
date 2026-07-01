// Add-element toolbar. Clicking a kind inserts a new element on the page.
// "Add fields" opens a multi-select to drop several bound fields at once,
// auto-arranged so they don't overlap.

import {useRef, useState} from 'react';
import {ElementKind, ElementKindLabels} from '../domain/element_types.mjs';
import {Button} from '../ui/primitives.js';
import {TextIcon, ImageIcon, BarcodeIcon, QrIcon, LineIcon, PlusIcon} from '../ui/icons.js';

// "Field" isn't here: adding fields goes through "Add fields" (multi-select), which
// drops them already bound. The kinds below are the non-field element types.
const ITEMS = [
    {kind: ElementKind.TEXT, icon: TextIcon},
    {kind: ElementKind.IMAGE, icon: ImageIcon},
    {kind: ElementKind.BARCODE, icon: BarcodeIcon},
    {kind: ElementKind.QR_CODE, icon: QrIcon},
    {kind: ElementKind.LINE, icon: LineIcon},
];

const CHIP =
    'flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-gray200 bg-white px-2.5 text-xs font-medium text-gray-gray600 shadow-xs transition-all hover:border-blue-blue hover:bg-blue-blueLight3 hover:text-blue-blue dark:border-gray-gray600 dark:bg-gray-gray800 dark:text-gray-gray200 dark:hover:border-blue-blue dark:hover:bg-gray-gray700';

function AddFieldsMenu({fields, onAddFields}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    // The popover is positioned with `fixed` (from the trigger's rect) so the
    // palette's horizontal-scroll container can't clip it.
    const [pos, setPos] = useState(null);
    const btnRef = useRef(null);

    const close = () => setOpen(false);
    const toggleOpen = () => {
        if (open) {
            close();
            return;
        }
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
            const width = 288;
            setPos({left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 4});
        }
        setSelected(new Set());
        setOpen(true);
    };
    const toggle = (id) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const allSelected = fields.length > 0 && selected.size === fields.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(fields.map((f) => f.id)));
    const confirm = () => {
        if (selected.size) onAddFields(fields.filter((f) => selected.has(f.id)).map((f) => f.id));
        close();
    };

    return (
        <div className="shrink-0">
            <button ref={btnRef} type="button" onClick={toggleOpen} className={CHIP} aria-expanded={open}>
                <PlusIcon size={14} />
                Add fields
            </button>
            {open && pos ? (
                <>
                    <div className="fixed inset-0 z-40" onClick={close} />
                    <div
                        className="fixed z-50 w-72 rounded-lg border border-gray-gray200 bg-white p-2 shadow-lg dark:border-gray-gray700 dark:bg-gray-gray800"
                        style={{left: pos.left, top: pos.top}}
                    >
                        <div className="flex items-center justify-between px-1 pb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-gray500 dark:text-gray-gray400">
                                Add fields
                            </span>
                            <button
                                type="button"
                                onClick={toggleAll}
                                className="text-[11px] font-medium text-blue-blue hover:underline"
                            >
                                {allSelected ? 'Clear' : 'Select all'}
                            </button>
                        </div>
                        <div className="max-h-64 overflow-auto">
                            {fields.map((f) => (
                                <label
                                    key={f.id}
                                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm text-gray-gray700 hover:bg-gray-gray50 dark:text-gray-gray100 dark:hover:bg-gray-gray700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(f.id)}
                                        onChange={() => toggle(f.id)}
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-blue"
                                    />
                                    <span className="min-w-0 break-words">{f.name}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button size="sm" variant="primary" onClick={confirm} disabled={selected.size === 0}>
                                Add{selected.size ? ` ${selected.size}` : ''}
                            </Button>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

export function ElementPalette({onAdd, fields, onAddFields}) {
    return (
        <div className="flex w-max items-center gap-1">
            {ITEMS.map(({kind, icon: Icon}) => (
                <button key={kind} type="button" onClick={() => onAdd(kind)} className={CHIP}>
                    <Icon size={14} />
                    {ElementKindLabels[kind]}
                </button>
            ))}
            {fields && fields.length > 0 ? (
                <AddFieldsMenu fields={fields} onAddFields={onAddFields} />
            ) : null}
        </div>
    );
}
