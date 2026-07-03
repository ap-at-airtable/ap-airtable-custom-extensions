// Editor (edit-mode) orchestrator: palette + interactive canvas + right-hand
// inspector / page-settings. The document is config.pages (one entry per page),
// rendered as a continuous vertical stack with an "add page" tile at the bottom.
// The "active" page is whichever page holds the current selection/interaction.
// GlobalConfig (optimistic) is the source of truth; an in-flight drag renders from
// a local override (scoped to its page index) and commits on release.

import {useEffect, useRef, useState} from 'react';
import {EditorCanvas} from './editor_canvas.js';
import {ElementInspector, MultiInspector} from './element_inspector.js';
import {PageSettingsPanel} from './page_settings_panel.js';
import {ElementPalette} from './element_palette.js';
import {FieldRail} from './field_rail.js';
import {PrintLayer} from '../view/print_layer.js';
import {useContainerWidth} from '../ui/use_container_width.js';
import {loadLastPosition, saveLastPosition} from '../state/last_position_store.js';
import {resolvePageSizePx, snapToGrid, PAGE_GRID_SIZE} from '../domain/page_geometry.mjs';
import {defaultSizeForKind, ElementKind} from '../domain/element_types.mjs';
import {
    addNewElement,
    updateElement,
    updateElements,
    removeElement,
    duplicateElement,
    bringToFront,
    sendToBack,
    clampElementToPage,
    arrangeGrid,
    getOrderedElements,
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
    PlusIcon,
    TrashIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    FieldIcon,
} from '../ui/icons.js';
import {ZoomControl} from '../ui/zoom_control.js';
import {usePrintMode} from '../view/use_print_mode.js';

// Stable empty selection for non-active pages (avoids a new array each render).
const EMPTY_IDS = [];

export function EditorMode({table, records, config, onPreview, showGrid, onToggleGrid}) {
    const [selectedIds, setSelectedIds] = useState([]);
    const [dragOverride, setDragOverride] = useState(null);
    const [rightTab, setRightTab] = useState('page');
    const [error, setError] = useState(null);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [railOpen, setRailOpen] = useState(false);
    const [zoom, setZoom] = useState(null);
    // Restore the page the user was last on (mode flips remount this component).
    const [pageIndex, setPageIndex] = useState(() => loadLastPosition(table.id).pageIndex);
    const [centerRef, centerWidth] = useContainerWidth();
    // Set when a page is added so we scroll it into view once it actually renders
    // (the GlobalConfig write + re-render is async; a fixed timeout races it).
    const pendingScrollBottom = useRef(false);
    const bottomRef = useRef(null); // sentinel below the last page, for scroll-into-view
    const restoredPageRef = useRef(null); // wrapper of the restored page, for the one-time scroll
    const didRestoreScroll = useRef(false);
    // Page index awaiting delete confirmation (a misclick shouldn't destroy a page).
    const [confirmDeletePage, setConfirmDeletePage] = useState(null);

    const fieldList = table.fields.map((f) => ({id: f.id, name: f.name, type: f.config.type}));

    const {printing, printNow} = usePrintMode(config.page);

    // Keep the active page index in range as pages are added/removed, and drop any
    // pending delete confirmation (its index may now point at a different page).
    useEffect(() => {
        setPageIndex((i) => Math.min(Math.max(i, 0), config.pages.length - 1));
        setConfirmDeletePage(null);
    }, [config.pages.length]);

    // After a page is added and has rendered, scroll it into view. scrollIntoView on
    // a bottom sentinel finds whatever ancestor actually scrolls (ours or the host).
    useEffect(() => {
        if (!pendingScrollBottom.current) return;
        pendingScrollBottom.current = false;
        bottomRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
    }, [config.pages.length]);

    const activeIndex = Math.min(Math.max(pageIndex, 0), config.pages.length - 1);

    useEffect(() => {
        saveLastPosition(table.id, {pageIndex: activeIndex});
    }, [table.id, activeIndex]);

    // Bring the restored page into view once after mount (the stack starts at page
    // 1). Wait for the first width measurement: fit-scale resizes the pages right
    // after mount, which would leave an earlier scroll pointing mid-page.
    useEffect(() => {
        if (didRestoreScroll.current || centerWidth === 0) return;
        didRestoreScroll.current = true;
        if (activeIndex > 0) restoredPageRef.current?.scrollIntoView({block: 'start'});
    }, [activeIndex, centerWidth]);

    const pageEntry = config.pages[activeIndex];
    // Effective page for the active page = shared geometry + this page's background.
    const effectivePage = {...config.page, backgroundColor: pageEntry.backgroundColor};
    const currentLayout = pageEntry.layout;

    // A drag override belongs to one page; only that page renders from it.
    const layoutFor = (i) =>
        dragOverride && dragOverride.index === i ? dragOverride.layout : config.pages[i].layout;
    const layout = layoutFor(activeIndex);
    const record = records[0] || null;
    const selected = selectedIds.length === 1 ? layout.elementsById[selectedIds[0]] : null;

    const {width: pageW, height: pageH} = resolvePageSizePx(config.page);
    const fitScale = centerWidth > 0 ? Math.max(0.1, Math.min(1, (centerWidth - 48) / pageW)) : 0.5;
    const scale = zoom != null ? zoom : fitScale;
    const applyZoom = (next) => setZoom(Math.max(0.25, Math.min(3, next)));

    const TOO_LARGE = 'This design is too large to save. Remove some elements or images.';
    const isTooLarge = (err) => err && (err.message === 'DOC_TOO_LARGE' || err.message === 'LAYOUT_TOO_LARGE');
    const onSaveError = (err) => {
        if (isTooLarge(err)) {
            setError(TOO_LARGE);
        } else {
            console.error('Failed to save', err);
            setError("Couldn't save your changes. Please try again.");
        }
    };

    const persistTo = (index, nextLayout) => {
        setDragOverride({index, layout: nextLayout});
        config.setLayout(index, nextLayout).then(
            () => {
                setDragOverride(null);
                setError(null);
            },
            (err) => {
                setDragOverride(null);
                onSaveError(err);
            },
        );
    };
    const persist = (nextLayout) => persistTo(activeIndex, nextLayout);

    // Page-settings panel emits single-key patches: background is per-page, the rest
    // (size/orientation) is shared geometry.
    const persistPage = (patch) => {
        const write =
            'backgroundColor' in patch
                ? config.setBackground(activeIndex, patch.backgroundColor)
                : config.setPageGeometry({...config.page, ...patch});
        write.then(() => setError(null), onSaveError);
    };

    const switchPage = (i) => {
        setDragOverride(null);
        setSelectedIds([]);
        setRightTab('page');
        setPageIndex(i);
    };
    const handleAddPage = () => {
        const target = config.pages.length; // new page's index after append
        config.addPage().then(() => {
            setError(null);
            pendingScrollBottom.current = true; // scrolled in by the effect once it renders
            switchPage(target);
        }, onSaveError);
    };
    const handleRemovePage = (i) => {
        config.removePage(i).then(() => setError(null), onSaveError);
        setSelectedIds([]);
        setDragOverride(null);
        // Keep the same page active: shift down if we removed one before it, else clamp.
        setPageIndex((cur) => (i < cur ? cur - 1 : Math.min(cur, config.pages.length - 2)));
    };
    // Move a page one slot (to = from ± 1). Keep the active page focused through the swap.
    const handleMovePage = (from, to) => {
        setDragOverride(null);
        setConfirmDeletePage(null);
        config.movePage(from, to).then(() => setError(null), onSaveError);
        setPageIndex((cur) => (cur === from ? to : cur === to ? from : cur));
    };

    const handleAdd = (kind) => {
        const size = defaultSizeForKind(kind);
        const x = snapToGrid(Math.max(0, (pageW - size.width) / 2));
        const y = snapToGrid(Math.max(0, (pageH - size.height) / 3));
        const {layout: next, element} = addNewElement(currentLayout, {kind, x, y});
        persist(next);
        setSelectedIds([element.id]);
        setRightTab('element');
        setInspectorOpen(true);
    };

    // Add several bound fields at once, packed into a non-overlapping grid so they
    // don't stack. Labels are shown so a freshly-populated page stays readable.
    const handleAddFields = (fieldIds) => {
        if (!fieldIds.length) return;
        const size = defaultSizeForKind(ElementKind.FIELD);
        const margin = PAGE_GRID_SIZE * 2;
        const existing = getOrderedElements(currentLayout);
        const bottom = existing.reduce((m, el) => Math.max(m, el.y + el.height), 0);
        let startY = existing.length ? snapToGrid(bottom + PAGE_GRID_SIZE) : margin;
        if (startY + size.height > pageH - margin) startY = margin;
        const positions = arrangeGrid(fieldIds.length, {
            pageWidth: pageW,
            pageHeight: pageH,
            itemWidth: size.width,
            itemHeight: size.height,
            startY,
        });
        let next = currentLayout;
        const newIds = [];
        fieldIds.forEach((fieldId, i) => {
            const {layout: withEl, element} = addNewElement(next, {
                kind: ElementKind.FIELD,
                x: positions[i].x,
                y: positions[i].y,
                fieldId,
            });
            next = updateElement(withEl, element.id, {style: {showFieldLabel: true}});
            newIds.push(element.id);
        });
        persist(next);
        setSelectedIds(newIds);
        setRightTab('element');
        setInspectorOpen(true);
    };

    // Drop fields from the rail at the cursor: stack them down from the drop point,
    // clamped to the page. One field = placed exactly where dropped.
    const handleDropFields = (index, fieldIds, x, y) => {
        if (!fieldIds || !fieldIds.length) return;
        const size = defaultSizeForKind(ElementKind.FIELD);
        let next = config.pages[index].layout;
        const newIds = [];
        fieldIds.forEach((fieldId, i) => {
            const clamped = clampElementToPage(
                {x, y: y + i * (size.height + PAGE_GRID_SIZE), width: size.width, height: size.height},
                pageW,
                pageH,
            );
            const {layout: withEl, element} = addNewElement(next, {
                kind: ElementKind.FIELD,
                x: clamped.x,
                y: clamped.y,
                fieldId,
            });
            next = withEl;
            newIds.push(element.id);
        });
        setPageIndex(index);
        persistTo(index, next);
        setSelectedIds(newIds);
        setRightTab('element');
        setInspectorOpen(true);
    };

    const handleSelect = (ids) => {
        setSelectedIds(ids);
        if (ids.length) {
            setRightTab('element');
            setInspectorOpen(true);
        }
    };
    const handleToggle = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        setRightTab('element');
        setInspectorOpen(true);
    };

    const GEOMETRY_KEYS = ['x', 'y', 'width', 'height'];
    const updateSelected = (patch) => {
        if (selectedIds.length !== 1) return;
        const id = selectedIds[0];
        let next = updateElement(currentLayout, id, patch);
        if (GEOMETRY_KEYS.some((k) => k in patch)) {
            const el = next.elementsById[id];
            if (el) next = updateElement(next, id, clampElementToPage(el, pageW, pageH));
        }
        persist(next);
    };
    const deleteSelected = () => {
        if (!selectedIds.length) return;
        let next = currentLayout;
        for (const id of selectedIds) next = removeElement(next, id);
        persist(next);
        setSelectedIds([]);
        setRightTab('page');
    };
    const duplicateSelected = () => {
        if (!selectedIds.length) return;
        let next = currentLayout;
        const newIds = [];
        for (const id of selectedIds) {
            const {layout: n, element} = duplicateElement(next, id);
            next = n;
            if (element) newIds.push(element.id);
        }
        persist(next);
        setSelectedIds(newIds);
    };
    const bringSelectedToFront = () => {
        let next = currentLayout;
        for (const id of selectedIds) next = bringToFront(next, id);
        persist(next);
    };
    const sendSelectedToBack = () => {
        let next = currentLayout;
        for (const id of selectedIds) next = sendToBack(next, id);
        persist(next);
    };
    const applyAlign = (mode) => {
        const els = selectedIds.map((id) => currentLayout.elementsById[id]).filter(Boolean);
        const patches = alignElements(els, mode);
        if (Object.keys(patches).length) persist(updateElements(currentLayout, patches));
    };
    const applyDistribute = (axis) => {
        const els = selectedIds.map((id) => currentLayout.elementsById[id]).filter(Boolean);
        const patches = distributeElements(els, axis);
        if (Object.keys(patches).length) persist(updateElements(currentLayout, patches));
    };

    // Drop selected ids whose element no longer exists on the active page.
    useEffect(() => {
        setSelectedIds((prev) => {
            const valid = prev.filter((id) => currentLayout.elementsById[id]);
            return valid.length === prev.length ? prev : valid;
        });
    }, [currentLayout]);

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
            if (e.key === 'Escape') {
                setInspectorOpen(false);
                setSelectedIds([]);
                return;
            }
            const mod = e.metaKey || e.ctrlKey;
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
            if (!selectedIds.length) return;
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
                    const el = currentLayout.elementsById[id];
                    if (!el) continue;
                    const moved = clampElementToPage({...el, x: el.x + dx, y: el.y + dy}, pageW, pageH);
                    patches[id] = {x: moved.x, y: moved.y};
                }
                persist(updateElements(currentLayout, patches));
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds, currentLayout, config.page, config.undo, config.redo, activeIndex]);

    const multiPage = config.pages.length > 1;

    return (
        <>
            <div className="pd-screen-only flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-gray-gray200 bg-white px-3 py-2 dark:border-gray-gray700 dark:bg-gray-gray800">
                    <IconButton
                        icon={FieldIcon}
                        label="Fields"
                        onClick={() => setRailOpen((o) => !o)}
                        className="shrink-0 md:hidden"
                    />
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
                    {/* Field rail: static left column on md+, slide-in drawer on narrow. */}
                    {railOpen ? (
                        <div
                            className="absolute inset-0 z-10 bg-black/40 md:hidden"
                            onClick={() => setRailOpen(false)}
                        />
                    ) : null}
                    <div
                        className={
                            'absolute left-0 top-0 z-20 flex h-full w-56 max-w-[85%] flex-col bg-white shadow-xl transition-transform ' +
                            'md:static md:z-auto md:max-w-none md:shrink-0 md:border-r md:border-gray-gray200 md:shadow-none ' +
                            'dark:bg-gray-gray800 md:dark:border-gray-gray700 ' +
                            (railOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
                        }
                    >
                        <FieldRail
                            fields={fieldList}
                            onAddFields={(ids) => {
                                handleAddFields(ids);
                                setRailOpen(false);
                            }}
                        />
                    </div>

                    <div className="relative flex min-w-0 flex-1 flex-col">
                        <div ref={centerRef} className="pd-desk min-w-0 flex-1 overflow-auto">
                            <div className="flex min-h-full w-max min-w-full flex-col items-center gap-14 p-6">
                                {config.pages.map((p, i) => (
                                    <div
                                        key={i}
                                        ref={i === activeIndex ? restoredPageRef : undefined}
                                        className="flex flex-col"
                                        style={{width: pageW * scale}}
                                    >
                                        <div className="pointer-events-none relative z-10 mb-2 flex items-center justify-between px-0.5">
                                            <span className="text-[11px] font-medium text-gray-gray400">
                                                Page {i + 1}
                                            </span>
                                            {multiPage && confirmDeletePage === i ? (
                                                <div className="pointer-events-auto flex items-center gap-1.5 text-[11px]">
                                                    <span className="text-gray-gray500">
                                                        Delete this page and its elements?
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeletePage(null)}
                                                        className="rounded px-1.5 py-0.5 font-medium text-gray-gray500 hover:bg-gray-gray100 dark:hover:bg-gray-gray700"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setConfirmDeletePage(null);
                                                            handleRemovePage(i);
                                                        }}
                                                        className="rounded bg-red-red px-1.5 py-0.5 font-medium text-white hover:opacity-90"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            ) : multiPage ? (
                                                <div className="pointer-events-auto flex items-center gap-0.5">
                                                    <button
                                                        type="button"
                                                        aria-label={`Move page ${i + 1} up`}
                                                        title="Move up"
                                                        disabled={i === 0}
                                                        onClick={() => handleMovePage(i, i - 1)}
                                                        className="flex items-center rounded p-1 text-gray-gray400 hover:bg-gray-gray100 hover:text-gray-gray600 disabled:opacity-30 dark:hover:bg-gray-gray700"
                                                    >
                                                        <ChevronUpIcon size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Move page ${i + 1} down`}
                                                        title="Move down"
                                                        disabled={i === config.pages.length - 1}
                                                        onClick={() => handleMovePage(i, i + 1)}
                                                        className="flex items-center rounded p-1 text-gray-gray400 hover:bg-gray-gray100 hover:text-gray-gray600 disabled:opacity-30 dark:hover:bg-gray-gray700"
                                                    >
                                                        <ChevronDownIcon size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Delete page ${i + 1}`}
                                                        title="Delete page"
                                                        onClick={() => setConfirmDeletePage(i)}
                                                        className="flex items-center rounded p-1 text-gray-gray400 hover:bg-red-redLight2 hover:text-red-red dark:hover:bg-red-redDark1"
                                                    >
                                                        <TrashIcon size={15} />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                        <EditorCanvas
                                            page={{...config.page, backgroundColor: p.backgroundColor}}
                                            layout={layoutFor(i)}
                                            record={record}
                                            table={table}
                                            selectedIds={i === activeIndex ? selectedIds : EMPTY_IDS}
                                            scale={scale}
                                            showGrid={showGrid}
                                            onSelect={(ids) => {
                                                setPageIndex(i);
                                                handleSelect(ids);
                                            }}
                                            onToggle={(id) => {
                                                setPageIndex(i);
                                                handleToggle(id);
                                            }}
                                            onPreview={(patches) =>
                                                setDragOverride({
                                                    index: i,
                                                    layout: updateElements(config.pages[i].layout, patches),
                                                })
                                            }
                                            onCommit={(patches) =>
                                                persistTo(i, updateElements(config.pages[i].layout, patches))
                                            }
                                            onDropFields={(fieldIds, x, y) => handleDropFields(i, fieldIds, x, y)}
                                        />
                                    </div>
                                ))}
                                {config.pages.length < config.maxPages ? (
                                    <button
                                        type="button"
                                        onClick={handleAddPage}
                                        className="relative z-10 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-gray200 text-gray-gray400 transition-colors hover:border-blue-blue hover:text-blue-blue dark:border-gray-gray700"
                                        style={{width: pageW * scale, height: Math.max(96, pageH * scale * 0.14)}}
                                    >
                                        <PlusIcon size={22} />
                                        <span className="text-xs font-medium">Add page</span>
                                    </button>
                                ) : null}
                                {/* Spacer so the last page / add tile can scroll clear of the
                                    floating zoom pill (which is pinned bottom-center). */}
                                <div ref={bottomRef} aria-hidden="true" className="h-20 shrink-0" />
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
                                <PageSettingsPanel page={effectivePage} onChangePage={persistPage} />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {printing ? (
                <PrintLayer page={config.page} pages={config.pages} records={records} table={table} />
            ) : null}
        </>
    );
}
