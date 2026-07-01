// Editor (edit-mode) orchestrator: palette + interactive canvas + right-hand
// inspector / page-settings tabs. config.layout (GlobalConfig, optimistic) is the
// source of truth; an in-flight drag renders from a local override and commits on
// release. Discrete edits (add/delete/inspector/z-order) persist immediately.

import {useEffect, useState} from 'react';
import {EditorCanvas} from './editor_canvas.js';
import {ElementInspector, MultiInspector} from './element_inspector.js';
import {PageSettingsPanel} from './page_settings_panel.js';
import {ElementPalette} from './element_palette.js';
import {PrintLayer} from '../view/print_layer.js';
import {useContainerWidth} from '../ui/use_container_width.js';
import {resolvePageSizePx, snapToGrid, PAGE_GRID_SIZE} from '../domain/page_geometry.mjs';
import {defaultSizeForKind} from '../domain/element_types.mjs';
import {
    addNewElement,
    updateElement,
    updateElements,
    removeElement,
    duplicateElement,
    bringToFront,
    sendToBack,
    clampElementToPage,
} from '../domain/layout_model.mjs';
import {alignElements, distributeElements} from '../domain/alignment.mjs';
import {Button, IconButton} from '../ui/primitives.js';
import {
    PrinterIcon,
    WarningIcon,
    CloseIcon,
    SettingsIcon,
    EyeIcon,
    GridIcon,
    UndoIcon,
    RedoIcon,
} from '../ui/icons.js';
import {ZoomControl} from '../ui/zoom_control.js';
import {usePrintMode} from '../view/use_print_mode.js';

export function EditorMode({table, records, config, onPreview, showGrid, onToggleGrid}) {
    const [selectedIds, setSelectedIds] = useState([]);
    const [dragOverride, setDragOverride] = useState(null);
    const [rightTab, setRightTab] = useState('page');
    const [error, setError] = useState(null);
    // On narrow viewports the inspector is a slide-in drawer toggled by this flag;
    // on wide viewports (md+) it's always a static side column (flag ignored).
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [zoom, setZoom] = useState(null);
    const [centerRef, centerWidth] = useContainerWidth();

    const {printing, printNow} = usePrintMode(config.page);

    const layout = dragOverride || config.layout;
    const record = records[0] || null;
    // Read from the rendered layout so the inspector tracks an in-flight drag.
    const selected = selectedIds.length === 1 ? layout.elementsById[selectedIds[0]] : null;

    const {width: pageW, height: pageH} = resolvePageSizePx(config.page);
    // Floor at 0.1: a pane narrower than the 48px padding would otherwise yield a
    // zero/negative scale, and gestures divide by it (dx/scale) → NaN/Infinity
    // geometry that gets persisted. Never let scale reach 0.
    const fitScale = centerWidth > 0 ? Math.max(0.1, Math.min(1, (centerWidth - 48) / pageW)) : 0.5;
    // null zoom = auto fit-to-width; a number is an explicit user zoom.
    const scale = zoom != null ? zoom : fitScale;
    const applyZoom = (next) => setZoom(Math.max(0.25, Math.min(3, next)));

    // Hold the rendered layout on the local override until GlobalConfig's optimistic
    // update lands, so a committed drag never flashes back to its pre-commit state.
    const TOO_LARGE = 'This design is too large to save. Remove some elements or images.';
    const isTooLarge = (err) => err && (err.message === 'DOC_TOO_LARGE' || err.message === 'LAYOUT_TOO_LARGE');

    const persist = (nextLayout) => {
        setDragOverride(nextLayout);
        config.setLayout(nextLayout).then(
            () => {
                setDragOverride(null);
                setError(null);
            },
            (err) => {
                setDragOverride(null);
                if (isTooLarge(err)) {
                    setError(TOO_LARGE);
                } else {
                    // Permission loss / host write failure is NOT a size problem;
                    // don't tell the user to delete work that was fine.
                    console.error('Failed to save layout', err);
                    setError("Couldn't save your changes. Please try again.");
                }
            },
        );
    };

    const persistPage = (patch) => {
        config.setPage({...config.page, ...patch}).then(
            () => setError(null),
            (err) => {
                if (isTooLarge(err)) {
                    setError(TOO_LARGE);
                } else {
                    console.error('Failed to save page settings', err);
                    setError("Couldn't save the page settings. Please try again.");
                }
            },
        );
    };

    const handleAdd = (kind) => {
        const {width: pw, height: ph} = resolvePageSizePx(config.page);
        const size = defaultSizeForKind(kind);
        const x = snapToGrid(Math.max(0, (pw - size.width) / 2));
        const y = snapToGrid(Math.max(0, (ph - size.height) / 3));
        const {layout: next, element} = addNewElement(config.layout, {kind, x, y});
        persist(next);
        setSelectedIds([element.id]);
        setRightTab('element');
        setInspectorOpen(true);
    };

    const handleSelect = (ids) => {
        setSelectedIds(ids);
        if (ids.length) {
            setRightTab('element');
            setInspectorOpen(true); // reveal the drawer on narrow viewports
        }
    };
    const handleToggle = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        setRightTab('element');
        setInspectorOpen(true);
    };

    const GEOMETRY_KEYS = ['x', 'y', 'width', 'height'];
    const updateSelected = (patch) => {
        if (selectedIds.length !== 1) {
            return;
        }
        const id = selectedIds[0];
        let next = updateElement(config.layout, id, patch);
        // Inspector number inputs can type geometry out of bounds; keep it on-page.
        if (GEOMETRY_KEYS.some((k) => k in patch)) {
            const el = next.elementsById[id];
            if (el) {
                next = updateElement(next, id, clampElementToPage(el, pageW, pageH));
            }
        }
        persist(next);
    };
    const deleteSelected = () => {
        if (!selectedIds.length) return;
        let next = config.layout;
        for (const id of selectedIds) next = removeElement(next, id);
        persist(next);
        setSelectedIds([]);
        setRightTab('page');
    };
    const duplicateSelected = () => {
        if (!selectedIds.length) return;
        let next = config.layout;
        const newIds = [];
        for (const id of selectedIds) {
            const {layout: n, element} = duplicateElement(next, id);
            next = n;
            if (element) newIds.push(element.id);
        }
        persist(next);
        setSelectedIds(newIds);
    };
    // Z-order + align/distribute act on every selected element.
    const bringSelectedToFront = () => {
        let next = config.layout;
        for (const id of selectedIds) next = bringToFront(next, id);
        persist(next);
    };
    const sendSelectedToBack = () => {
        let next = config.layout;
        for (const id of selectedIds) next = sendToBack(next, id);
        persist(next);
    };
    const applyAlign = (mode) => {
        const els = selectedIds.map((id) => config.layout.elementsById[id]).filter(Boolean);
        const patches = alignElements(els, mode);
        if (Object.keys(patches).length) persist(updateElements(config.layout, patches));
    };
    const applyDistribute = (axis) => {
        const els = selectedIds.map((id) => config.layout.elementsById[id]).filter(Boolean);
        const patches = distributeElements(els, axis);
        if (Object.keys(patches).length) persist(updateElements(config.layout, patches));
    };

    // Drop selected ids whose element no longer exists (e.g. after an undo that
    // removed an added element, or a delete by another collaborator), so the
    // inspector never points at a missing element.
    useEffect(() => {
        setSelectedIds((prev) => {
            const valid = prev.filter((id) => config.layout.elementsById[id]);
            return valid.length === prev.length ? prev : valid;
        });
    }, [config.layout]);

    // Keyboard shortcuts (edit mode): undo/redo, delete/duplicate/z-order/deselect
    // + arrow nudge. Skipped while a form control or rich-text field has focus so
    // typing in the inspector never mutates the selected element.
    useEffect(() => {
        const onKeyDown = (e) => {
            const tag = e.target && e.target.tagName;
            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                (e.target && e.target.isContentEditable)
            ) {
                return;
            }
            // Escape closes the drawer (narrow viewports) and deselects, so keyboard
            // users are never trapped in the overlay — handle before the selection guard.
            if (e.key === 'Escape') {
                setInspectorOpen(false);
                setSelectedIds([]);
                return;
            }
            const mod = e.metaKey || e.ctrlKey;
            // Undo/redo work with or without a selection, so handle before the guard.
            // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y = redo.
            if (mod && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                setDragOverride(null);
                if (e.shiftKey) config.redo();
                else config.undo();
                return;
            }
            if (mod && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                setDragOverride(null);
                config.redo();
                return;
            }
            if (!selectedIds.length) {
                return;
            }
            if (mod && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                duplicateSelected();
            } else if (mod && e.key === ']') {
                e.preventDefault();
                bringSelectedToFront();
            } else if (mod && e.key === '[') {
                e.preventDefault();
                sendSelectedToBack();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteSelected();
            } else if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                const step = e.shiftKey ? PAGE_GRID_SIZE : 1;
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                const patches = {};
                for (const id of selectedIds) {
                    const el = config.layout.elementsById[id];
                    if (!el) continue;
                    const moved = clampElementToPage({...el, x: el.x + dx, y: el.y + dy}, pageW, pageH);
                    patches[id] = {x: moved.x, y: moved.y};
                }
                persist(updateElements(config.layout, patches));
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds, config.layout, config.page, config.undo, config.redo]);

    return (
        <>
            <div className="pd-screen-only flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-gray-gray200 bg-white px-3 py-2 dark:border-gray-gray700 dark:bg-gray-gray800">
                <div className="min-w-0 flex-1 overflow-x-auto">
                    <ElementPalette onAdd={handleAdd} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-gray-gray500 lg:inline">
                        {records.length} {records.length === 1 ? 'record' : 'records'}
                    </span>
                    <IconButton
                        icon={UndoIcon}
                        label="Undo (⌘Z)"
                        disabled={!config.canUndo}
                        onClick={() => config.undo()}
                    />
                    <IconButton
                        icon={RedoIcon}
                        label="Redo (⌘⇧Z)"
                        disabled={!config.canRedo}
                        onClick={() => config.redo()}
                    />
                    <IconButton
                        icon={GridIcon}
                        label="Toggle grid"
                        active={showGrid}
                        onClick={onToggleGrid}
                    />
                    {onPreview ? (
                        <Button
                            variant="default"
                            size="sm"
                            icon={EyeIcon}
                            onClick={onPreview}
                            title="Preview the published view"
                        >
                            Preview
                        </Button>
                    ) : null}
                    <Button
                        variant="primary"
                        size="sm"
                        icon={PrinterIcon}
                        onClick={printNow}
                        title="For exact sizing, set Margins to None and Scale to 100% in the print dialog."
                    >
                        Print
                    </Button>
                    <IconButton
                        icon={SettingsIcon}
                        label="Toggle settings panel"
                        onClick={() => setInspectorOpen((o) => !o)}
                        className="md:hidden"
                    />
                </div>
            </div>

            {error ? (
                <div className="pd-screen-only flex items-center gap-2 bg-red-redLight2 px-3 py-1.5 text-xs text-red-redDark1">
                    <WarningIcon size={14} />
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                        <CloseIcon size={14} />
                    </button>
                </div>
            ) : null}

            {!record ? (
                <div className="pd-screen-only bg-blue-blueLight3 px-3 py-1.5 text-xs text-blue-blueDark1">
                    Previewing with placeholders. Bound field values appear once the source has
                    records.
                </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1">
                <div className="relative flex min-w-0 flex-1 flex-col">
                    <div
                        ref={centerRef}
                        // min-w-0 lets this pane shrink below the page's intrinsic width so the
                        // measured width is the real available space (correct fit-scale) and the
                        // inspector panel is never pushed off-screen.
                        className="pd-desk min-w-0 flex-1 overflow-auto"
                    >
                        {/* w-max + min-w-full: center the page when it fits, and grow the
                            row so an oversized (zoomed-in) page is fully scrollable. */}
                        <div className="flex min-h-full w-max min-w-full items-start justify-center p-6">
                            <EditorCanvas
                                page={config.page}
                                layout={layout}
                                record={record}
                                table={table}
                                selectedIds={selectedIds}
                                scale={scale}
                                showGrid={showGrid}
                                onSelect={handleSelect}
                                onToggle={handleToggle}
                                onPreview={(patches) =>
                                    setDragOverride(updateElements(config.layout, patches))
                                }
                                onCommit={(patches) => persist(updateElements(config.layout, patches))}
                            />
                        </div>
                    </div>
                    <ZoomControl
                        scale={scale}
                        isFit={zoom == null}
                        onOut={() => applyZoom(scale - 0.1)}
                        onIn={() => applyZoom(scale + 0.1)}
                        onReset={() => setZoom(null)}
                    />
                </div>

                {inspectorOpen ? (
                    <div
                        className="absolute inset-0 z-10 bg-black/40 md:hidden"
                        onClick={() => setInspectorOpen(false)}
                    />
                ) : null}

                <div
                    className={
                        'absolute right-0 top-0 z-20 flex h-full w-72 max-w-[85%] flex-col border-l border-gray-gray200 bg-white shadow-xl transition-transform ' +
                        'md:static md:z-auto md:max-w-none md:shrink-0 md:shadow-none ' +
                        'dark:border-gray-gray700 dark:bg-gray-gray800 ' +
                        (inspectorOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0')
                    }
                >
                    <div className="flex items-center border-b border-gray-gray200 text-xs font-medium dark:border-gray-gray700">
                        <button
                            type="button"
                            onClick={() => setRightTab('page')}
                            className={`flex-1 px-3 py-2 ${
                                rightTab === 'page'
                                    ? 'border-b-2 border-blue-blue text-blue-blue'
                                    : 'text-gray-gray500'
                            }`}
                        >
                            Page
                        </button>
                        <button
                            type="button"
                            disabled={selectedIds.length === 0}
                            onClick={() => setRightTab('element')}
                            className={`flex-1 px-3 py-2 disabled:opacity-40 ${
                                rightTab === 'element'
                                    ? 'border-b-2 border-blue-blue text-blue-blue'
                                    : 'text-gray-gray500'
                            }`}
                        >
                            Element
                        </button>
                        <button
                            type="button"
                            aria-label="Close panel"
                            onClick={() => setInspectorOpen(false)}
                            className="shrink-0 px-2 text-gray-gray400 hover:text-gray-gray600 md:hidden"
                        >
                            <CloseIcon size={16} />
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                        {rightTab === 'element' && selected ? (
                            <ElementInspector
                                element={selected}
                                table={table}
                                onChange={updateSelected}
                                onDelete={deleteSelected}
                                onDuplicate={duplicateSelected}
                                onBringToFront={bringSelectedToFront}
                                onSendToBack={sendSelectedToBack}
                            />
                        ) : rightTab === 'element' && selectedIds.length > 1 ? (
                            <MultiInspector
                                count={selectedIds.length}
                                onAlign={applyAlign}
                                onDistribute={applyDistribute}
                                onDuplicate={duplicateSelected}
                                onDelete={deleteSelected}
                                onBringToFront={bringSelectedToFront}
                                onSendToBack={sendSelectedToBack}
                            />
                        ) : (
                            <PageSettingsPanel page={config.page} onChangePage={persistPage} />
                        )}
                    </div>
                </div>
            </div>
            </div>

            {printing ? (
                <PrintLayer page={config.page} layout={config.layout} records={records} table={table} />
            ) : null}
        </>
    );
}
