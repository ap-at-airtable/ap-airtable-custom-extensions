// View (published) mode: renders each record's pages from the query feed, with a
// print toolbar. A record with N pages produces N sheets in order. A hidden
// print-only layer renders every sheet at physical scale for the print dialog.

import {useEffect, useRef, useState} from 'react';
import {PageCanvas, ScaledPage} from '../render/page_canvas.js';
import {resolvePageSizePx} from '../domain/page_geometry.mjs';
import {PrintLayer, MAX_PRINT_SHEETS} from './print_layer.js';
import {usePrintMode} from './use_print_mode.js';
import {Button, Segmented} from '../ui/primitives.js';
import {PrinterIcon, EmptyIcon, EditIcon, MaximizeIcon, CloseIcon} from '../ui/icons.js';
import {useContainerWidth, useContainerSize} from '../ui/use_container_width.js';
import {ZoomControl} from '../ui/zoom_control.js';
import {isTextEntryTarget} from '../ui/dom.js';
import {loadLastPosition, saveLastPosition} from '../state/last_position_store.js';

// Sheet index for a stored position, clamped against the current records/pages
// (either may have changed since the position was saved).
function sheetIndexFor(pos, recordCount, pageCount) {
    if (recordCount === 0) return 0;
    const r = Math.min(pos.recordIndex, recordCount - 1);
    const p = Math.min(pos.pageIndex, pageCount - 1);
    return r * pageCount + p;
}

function ChevronLeft({size = 16}) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ChevronRight({size = 16}) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// A "sheet" is one page of one record. Continuous mode stacks sheets into the DOM,
// so cap it; single mode still pages through everything. Print is capped separately.
const MAX_CONTINUOUS_SHEETS = 100;

function EmptyState({icon: Icon, title, subtitle, action}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-gray500">
            <Icon size={40} />
            <div className="text-sm font-medium text-gray-gray600 dark:text-gray-gray300">{title}</div>
            {subtitle ? <div className="max-w-sm text-xs">{subtitle}</div> : null}
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    );
}

export function ViewMode({page, pages, records, table, title, onExitPreview}) {
    const {printing, printNow} = usePrintMode(page);
    const [scrollRef, containerWidth] = useContainerWidth();
    // Restore the last viewed sheet (mode flips remount this component). Records can
    // arrive after mount; keep the position pending until they do.
    const [currentIndex, setCurrentIndex] = useState(() =>
        sheetIndexFor(loadLastPosition(table.id), records.length, Math.max(1, pages.length)),
    );
    const pendingRestore = useRef(records.length === 0 ? loadLastPosition(table.id) : null);
    const [continuous, setContinuous] = useState(false);
    const [zoom, setZoom] = useState(null);
    const [presenting, setPresenting] = useState(false);
    const rootRef = useRef(null);
    const scaleRef = useRef(1);
    const [stageRef, stageSize] = useContainerSize();

    const pageCount = pages.length;
    const total = records.length * pageCount; // total sheets

    const enterPresent = () => {
        setContinuous(false);
        setPresenting(true);
        rootRef.current?.requestFullscreen?.().catch(() => {});
    };
    const exitPresent = () => {
        setPresenting(false);
        if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
        }
    };

    useEffect(() => {
        const onFsChange = () => {
            if (!document.fullscreenElement) setPresenting(false);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // Keep the sheet index in range as records/pages change; consume a pending
    // restore once records have actually arrived.
    useEffect(() => {
        if (pendingRestore.current && total > 0) {
            const pos = pendingRestore.current;
            pendingRestore.current = null;
            setCurrentIndex(sheetIndexFor(pos, records.length, pageCount));
            return;
        }
        setCurrentIndex((i) => Math.min(Math.max(i, 0), Math.max(total - 1, 0)));
    }, [total, records.length, pageCount]);

    // Persist the position (skip until a pending restore has been applied, so the
    // initial index 0 doesn't overwrite the saved spot before records load).
    useEffect(() => {
        if (total === 0 || pendingRestore.current) return;
        saveLastPosition(table.id, {
            recordIndex: Math.floor(currentIndex / pageCount),
            pageIndex: currentIndex % pageCount,
        });
    }, [table.id, currentIndex, pageCount, total]);

    const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(total - 1, 0));
    const recordFor = (idx) => records[Math.floor(idx / pageCount)];
    const entryFor = (idx) => pages[idx % pageCount];
    const effectivePage = (entry) => ({...page, backgroundColor: entry.backgroundColor});
    const posLabel = (idx) => {
        const r = Math.floor(idx / pageCount) + 1;
        const p = (idx % pageCount) + 1;
        return pageCount > 1
            ? `Record ${r} of ${records.length} · Page ${p} of ${pageCount}`
            : `Record ${r} of ${records.length}`;
    };

    // Arrow-key paging only applies to single-page mode.
    useEffect(() => {
        if (continuous) return undefined;
        const onKeyDown = (e) => {
            if (isTextEntryTarget(e.target)) return; // don't hijack keys while editing a field
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                setCurrentIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (presenting && e.key === ' ')) {
                if (presenting) e.preventDefault();
                setCurrentIndex((i) => Math.min(i + 1, total - 1));
            } else if (e.key === 'Escape' && presenting) {
                setPresenting(false);
                if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [total, continuous, presenting]);

    // Pinch-to-zoom on touch: the extension runs in an iframe with no native visual
    // viewport, so drive the existing zoom state from a two-finger gesture.
    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return undefined;
        let startDist = 0;
        let startScale = 1;
        let pinching = false;
        const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const onStart = (e) => {
            if (e.touches.length === 2) {
                pinching = true;
                startDist = dist(e.touches);
                startScale = scaleRef.current;
            }
        };
        const onMove = (e) => {
            if (pinching && e.touches.length === 2 && startDist > 0) {
                e.preventDefault();
                setZoom(Math.max(0.25, Math.min(3, startScale * (dist(e.touches) / startDist))));
            }
        };
        const onEnd = (e) => {
            if (e.touches.length < 2) pinching = false;
        };
        node.addEventListener('touchstart', onStart, {passive: false});
        node.addEventListener('touchmove', onMove, {passive: false});
        node.addEventListener('touchend', onEnd);
        node.addEventListener('touchcancel', onEnd);
        return () => {
            node.removeEventListener('touchstart', onStart);
            node.removeEventListener('touchmove', onMove);
            node.removeEventListener('touchend', onEnd);
            node.removeEventListener('touchcancel', onEnd);
        };
    }, [total, scrollRef]);

    const totalElements = pages.reduce((n, e) => n + (e.layout.order ? e.layout.order.length : 0), 0);
    const continuousCapped = total > MAX_CONTINUOUS_SHEETS;
    const printCapped = total > MAX_PRINT_SHEETS;
    const maxPrintRecords = Math.max(1, Math.floor(MAX_PRINT_SHEETS / pageCount));
    const printRecords = printCapped ? records.slice(0, maxPrintRecords) : records;
    const {width: pageWidth, height: pageHeight} = resolvePageSizePx(page);
    const fitScale =
        containerWidth > 0 ? Math.max(0.1, Math.min(1, (containerWidth - 48) / pageWidth)) : 0.5;
    const scale = zoom != null ? zoom : fitScale;
    scaleRef.current = scale; // read by the pinch handler without re-subscribing
    const applyZoom = (next) => setZoom(Math.max(0.25, Math.min(3, next)));

    const PRESENT_PADDING = 80;
    const presentScale =
        stageSize.width > 0 && stageSize.height > 0
            ? Math.max(
                  0.1,
                  Math.min(
                      4,
                      (stageSize.width - PRESENT_PADDING) / pageWidth,
                      (stageSize.height - PRESENT_PADDING) / pageHeight,
                  ),
              )
            : fitScale;

    if (totalElements === 0) {
        return (
            <EmptyState
                icon={EmptyIcon}
                title="This layout is empty"
                subtitle="Switch to edit mode in the Interface Designer to add fields, text, and images to the page."
                action={
                    onExitPreview ? (
                        <Button variant="default" size="sm" icon={EditIcon} onClick={onExitPreview}>
                            Back to editing
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    if (records.length === 0) {
        return (
            <EmptyState
                icon={EmptyIcon}
                title="No records to display"
                subtitle="This extension renders a designed page for each record in its source. Add records or adjust the source filter to see pages."
                action={
                    onExitPreview ? (
                        <Button variant="default" size="sm" icon={EditIcon} onClick={onExitPreview}>
                            Back to editing
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    // Sheets to render in the scroll area (single = current only; continuous = capped).
    const visibleSheets = [];
    if (continuous) {
        for (let i = 0; i < Math.min(total, MAX_CONTINUOUS_SHEETS); i += 1) {
            // Key by record identity: an index key would let React reuse a sheet (and
            // any open inline-edit draft) for a DIFFERENT record when the feed shifts.
            visibleSheets.push({key: `${recordFor(i).id}:${i % pageCount}`, record: recordFor(i), entry: entryFor(i)});
        }
    } else {
        const rec = recordFor(safeIndex);
        visibleSheets.push({key: `${rec ? rec.id : safeIndex}:${safeIndex % pageCount}`, record: rec, entry: entryFor(safeIndex)});
    }

    const presentRecord = recordFor(safeIndex);
    const presentEntry = entryFor(safeIndex);

    return (
        <div ref={rootRef} className="relative flex h-full flex-col bg-gray-gray50 dark:bg-gray-gray900">
            <div className="pd-screen-only flex flex-wrap items-center justify-between gap-2 border-b border-gray-gray200 bg-white px-4 py-2 dark:border-gray-gray700 dark:bg-gray-gray800">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-gray700 dark:text-gray-gray100">
                            {title || 'Page designer'}
                        </span>
                        {onExitPreview ? (
                            <span className="shrink-0 rounded bg-blue-blueLight2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-blueDark1 dark:bg-blue-blueDark1 dark:text-white">
                                Preview
                            </span>
                        ) : null}
                    </div>
                    <div className="text-xs text-gray-gray500">
                        {total} {total === 1 ? 'page' : 'pages'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {total > 1 ? (
                        <Segmented
                            value={continuous ? 'continuous' : 'single'}
                            options={[
                                {value: 'single', label: 'Single'},
                                {value: 'continuous', label: 'Continuous'},
                            ]}
                            onChange={(v) => setContinuous(v === 'continuous')}
                        />
                    ) : null}
                    {!continuous && total > 1 ? (
                        <span
                            aria-live="polite"
                            className="whitespace-nowrap text-xs tabular-nums text-gray-gray500 dark:text-gray-gray400"
                        >
                            {posLabel(safeIndex)}
                        </span>
                    ) : null}
                    <Button
                        variant="default"
                        size="sm"
                        icon={MaximizeIcon}
                        onClick={enterPresent}
                        title="Present full screen (arrow keys to move)"
                    >
                        Present
                    </Button>
                    {onExitPreview ? (
                        <Button
                            variant="default"
                            size="sm"
                            icon={EditIcon}
                            onClick={onExitPreview}
                            title="Return to the editor"
                        >
                            Back to editing
                        </Button>
                    ) : null}
                    <Button
                        variant="primary"
                        icon={PrinterIcon}
                        onClick={printNow}
                        title="For exact sizing, set Margins to None and Scale to 100% in the print dialog."
                    >
                        Print
                    </Button>
                </div>
            </div>

            {(continuous && continuousCapped) || printCapped ? (
                <div className="pd-screen-only space-y-0.5 border-b border-yellow-yellowLight1 bg-yellow-yellowLight2 px-4 py-1 text-[11px] text-yellow-yellowDark1 dark:border-yellow-yellowDark1 dark:bg-yellow-yellowDark1 dark:text-white">
                    {continuous && continuousCapped ? (
                        <div>
                            Continuous view shows the first {MAX_CONTINUOUS_SHEETS} of {total} pages —
                            switch to Single to page through all of them.
                        </div>
                    ) : null}
                    {printCapped ? (
                        <div>
                            Printing is limited to the first {maxPrintRecords * pageCount} of {total} pages.
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1 flex-col">
                <div
                    ref={scrollRef}
                    className="pd-desk pd-screen-only flex-1 overflow-auto"
                    style={{touchAction: 'pan-x pan-y'}}
                >
                    <div className="flex min-h-full w-max min-w-full flex-col items-center gap-4 p-6">
                        {visibleSheets.map((sheet) => (
                            <ScaledPage key={sheet.key} page={page} scale={scale}>
                                <PageCanvas
                                    page={effectivePage(sheet.entry)}
                                    layout={sheet.entry.layout}
                                    record={sheet.record}
                                    table={table}
                                    scale={scale}
                                    interactive
                                />
                            </ScaledPage>
                        ))}
                    </div>
                </div>
                <ZoomControl
                    scale={scale}
                    isFit={zoom == null}
                    onOut={() => applyZoom(scale - 0.1)}
                    onIn={() => applyZoom(scale + 0.1)}
                    onReset={() => setZoom(null)}
                    onPrev={
                        !continuous && total > 1
                            ? () => setCurrentIndex((i) => Math.max(i - 1, 0))
                            : undefined
                    }
                    onNext={
                        !continuous && total > 1
                            ? () => setCurrentIndex((i) => Math.min(i + 1, total - 1))
                            : undefined
                    }
                    prevDisabled={safeIndex === 0}
                    nextDisabled={safeIndex === total - 1}
                />
            </div>

            {presenting ? (
                <div
                    ref={stageRef}
                    className="pd-screen-only absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-gray-gray900"
                >
                    <ScaledPage page={page} scale={presentScale}>
                        <PageCanvas
                            page={effectivePage(presentEntry)}
                            layout={presentEntry.layout}
                            record={presentRecord}
                            table={table}
                            scale={presentScale}
                        />
                    </ScaledPage>

                    <button
                        type="button"
                        aria-label="Exit presentation"
                        onClick={exitPresent}
                        title="Exit (Esc)"
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                        <CloseIcon size={20} />
                    </button>

                    {total > 1 ? (
                        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
                            <button
                                type="button"
                                aria-label="Previous page"
                                disabled={safeIndex === 0}
                                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span
                                aria-live="polite"
                                className="rounded-full bg-black/50 px-3 py-1 text-center text-xs tabular-nums text-white"
                            >
                                {posLabel(safeIndex)}
                            </span>
                            <button
                                type="button"
                                aria-label="Next page"
                                disabled={safeIndex === total - 1}
                                onClick={() => setCurrentIndex((i) => Math.min(i + 1, total - 1))}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {printing ? (
                <PrintLayer page={page} pages={pages} records={printRecords} table={table} />
            ) : null}
        </div>
    );
}
