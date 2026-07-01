// View (published) mode: renders one designed page per record from the query
// feed, with a print toolbar. A hidden print-only layer renders all pages at
// physical scale for the browser print dialog.

import {useEffect, useRef, useState} from 'react';
import {PageCanvas, ScaledPage} from '../render/page_canvas.js';
import {resolvePageSizePx} from '../domain/page_geometry.mjs';
import {getOrderedElements} from '../domain/layout_model.mjs';
import {PrintLayer} from './print_layer.js';
import {usePrintMode} from './use_print_mode.js';
import {Button, Segmented} from '../ui/primitives.js';
import {PrinterIcon, EmptyIcon, EditIcon, MaximizeIcon, CloseIcon} from '../ui/icons.js';
import {useContainerWidth, useContainerSize} from '../ui/use_container_width.js';
import {ZoomControl} from '../ui/zoom_control.js';

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

// Each record renders a full page. Continuous mode stacks them all into the DOM, so
// cap it to keep a huge feed from freezing the tab; single mode still pages through
// every record. Print is capped separately (a browser can't spool thousands of sheets).
const MAX_CONTINUOUS_PAGES = 100;
const MAX_PRINT_PAGES = 500;

function EmptyState({icon: Icon, title, subtitle}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-gray500">
            <Icon size={40} />
            <div className="text-sm font-medium text-gray-gray600 dark:text-gray-gray300">{title}</div>
            {subtitle ? <div className="max-w-sm text-xs">{subtitle}</div> : null}
        </div>
    );
}

export function ViewMode({page, layout, records, table, title, onExitPreview}) {
    const {printing, printNow} = usePrintMode(page);
    const [scrollRef, containerWidth] = useContainerWidth();
    const [currentIndex, setCurrentIndex] = useState(0);
    // false = one page at a time with a pager; true = all pages stacked to scroll.
    const [continuous, setContinuous] = useState(false);
    const [zoom, setZoom] = useState(null);
    // Presenter/slideshow: one page filling the screen. Requests OS fullscreen when
    // the host iframe allows it, and presents in-place otherwise.
    const [presenting, setPresenting] = useState(false);
    const rootRef = useRef(null);
    const [stageRef, stageSize] = useContainerSize();

    const enterPresent = () => {
        setContinuous(false);
        setPresenting(true);
        rootRef.current?.requestFullscreen?.().catch(() => {
            // The host iframe may not grant fullscreen; present in-place instead.
        });
    };
    const exitPresent = () => {
        setPresenting(false);
        if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
        }
    };

    // Keep our state in sync when the user leaves fullscreen via Esc or the browser UI.
    useEffect(() => {
        const onFsChange = () => {
            if (!document.fullscreenElement) {
                setPresenting(false);
            }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // Keep the index in range as the record set shrinks/grows.
    useEffect(() => {
        setCurrentIndex((i) => Math.min(Math.max(i, 0), Math.max(records.length - 1, 0)));
    }, [records.length]);

    const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(records.length - 1, 0));

    // Arrow-key paging only applies to single-page mode.
    useEffect(() => {
        if (continuous) {
            return undefined;
        }
        const onKeyDown = (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
                return;
            }
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                setCurrentIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (presenting && e.key === ' ')) {
                // Space advances only in presenter mode, so it doesn't hijack normal scroll.
                if (presenting) e.preventDefault();
                setCurrentIndex((i) => Math.min(i + 1, records.length - 1));
            } else if (e.key === 'Escape' && presenting) {
                setPresenting(false);
                if (document.fullscreenElement) {
                    document.exitFullscreen?.().catch(() => {});
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [records.length, continuous, presenting]);

    const elements = getOrderedElements(layout);
    const continuousCapped = records.length > MAX_CONTINUOUS_PAGES;
    const printCapped = records.length > MAX_PRINT_PAGES;
    const printRecords = printCapped ? records.slice(0, MAX_PRINT_PAGES) : records;
    const {width: pageWidth, height: pageHeight} = resolvePageSizePx(page);
    const fitScale =
        containerWidth > 0 ? Math.max(0.1, Math.min(1, (containerWidth - 48) / pageWidth)) : 0.5;
    const scale = zoom != null ? zoom : fitScale;
    const applyZoom = (next) => setZoom(Math.max(0.25, Math.min(3, next)));

    // Presenter scale: fit the page within the stage on BOTH axes (contain), scaling
    // up a small page to fill a big screen. Falls back to fitScale before measured.
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

    if (elements.length === 0) {
        return (
            <EmptyState
                icon={EmptyIcon}
                title="This layout is empty"
                subtitle="Switch to edit mode in the Interface Designer to add fields, text, and images to the page."
            />
        );
    }

    if (records.length === 0) {
        return (
            <EmptyState
                icon={EmptyIcon}
                title="No records to display"
                subtitle="This extension renders a designed page for each record in its source. Add records or adjust the source filter to see pages."
            />
        );
    }

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
                        {records.length} {records.length === 1 ? 'page' : 'pages'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {records.length > 1 ? (
                        <Segmented
                            value={continuous ? 'continuous' : 'single'}
                            options={[
                                {value: 'single', label: 'Single'},
                                {value: 'continuous', label: 'Continuous'},
                            ]}
                            onChange={(v) => setContinuous(v === 'continuous')}
                        />
                    ) : null}
                    {!continuous && records.length > 1 ? (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="default"
                                size="sm"
                                icon={ChevronLeft}
                                aria-label="Previous record"
                                disabled={safeIndex === 0}
                                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                            />
                            <span
                                aria-live="polite"
                                className="whitespace-nowrap text-xs tabular-nums text-gray-gray500 dark:text-gray-gray400"
                            >
                                Record {safeIndex + 1} of {records.length}
                            </span>
                            <Button
                                variant="default"
                                size="sm"
                                icon={ChevronRight}
                                aria-label="Next record"
                                disabled={safeIndex === records.length - 1}
                                onClick={() => setCurrentIndex((i) => Math.min(i + 1, records.length - 1))}
                            />
                        </div>
                    ) : null}
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
                        variant="default"
                        size="sm"
                        icon={MaximizeIcon}
                        onClick={enterPresent}
                        title="Present full screen (one page per record, arrow keys to move)"
                    >
                        Present
                    </Button>
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

            <div className="pd-screen-only border-b border-gray-gray200 bg-gray-gray25 px-4 py-1 text-[11px] text-gray-gray500 dark:border-gray-gray700 dark:bg-gray-gray800">
                For exact sizing, set <span className="font-medium">Margins: None</span> and{' '}
                <span className="font-medium">Scale: 100%</span> in the print dialog.
            </div>

            {(continuous && continuousCapped) || printCapped ? (
                <div className="pd-screen-only space-y-0.5 border-b border-yellow-yellowLight1 bg-yellow-yellowLight2 px-4 py-1 text-[11px] text-yellow-yellowDark1 dark:border-yellow-yellowDark1 dark:bg-yellow-yellowDark1 dark:text-white">
                    {continuous && continuousCapped ? (
                        <div>
                            Continuous view shows the first {MAX_CONTINUOUS_PAGES} of {records.length}{' '}
                            pages — switch to Single to page through all of them.
                        </div>
                    ) : null}
                    {printCapped ? (
                        <div>
                            Printing is limited to the first {MAX_PRINT_PAGES} of {records.length} pages.
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1 flex-col">
                <div ref={scrollRef} className="pd-desk pd-screen-only flex-1 overflow-auto">
                    <div className="flex min-h-full w-max min-w-full flex-col items-center gap-4 p-6">
                        {(continuous ? records.slice(0, MAX_CONTINUOUS_PAGES) : [records[safeIndex]]).map((record) => (
                            <ScaledPage key={record.id} page={page} scale={scale}>
                                <PageCanvas
                                    page={page}
                                    layout={layout}
                                    record={record}
                                    table={table}
                                    scale={scale}
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
                />
                {/* On-page arrows: flip pages without needing keyboard focus. */}
                {!continuous && records.length > 1 ? (
                    <>
                        {safeIndex > 0 ? (
                            <button
                                type="button"
                                aria-label="Previous page"
                                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                                className="pd-screen-only absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-gray200 bg-white text-gray-gray600 shadow-md hover:bg-gray-gray50 dark:border-gray-gray700 dark:bg-gray-gray800 dark:text-gray-gray200"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        ) : null}
                        {safeIndex < records.length - 1 ? (
                            <button
                                type="button"
                                aria-label="Next page"
                                onClick={() =>
                                    setCurrentIndex((i) => Math.min(i + 1, records.length - 1))
                                }
                                className="pd-screen-only absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-gray200 bg-white text-gray-gray600 shadow-md hover:bg-gray-gray50 dark:border-gray-gray700 dark:bg-gray-gray800 dark:text-gray-gray200"
                            >
                                <ChevronRight size={20} />
                            </button>
                        ) : null}
                    </>
                ) : null}
            </div>

            {presenting ? (
                <div
                    ref={stageRef}
                    className="pd-screen-only absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-gray-gray900"
                >
                    <ScaledPage page={page} scale={presentScale}>
                        <PageCanvas
                            page={page}
                            layout={layout}
                            record={records[safeIndex]}
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

                    {records.length > 1 ? (
                        <>
                            {safeIndex > 0 ? (
                                <button
                                    type="button"
                                    aria-label="Previous page"
                                    onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                                    className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                                >
                                    <ChevronLeft size={26} />
                                </button>
                            ) : null}
                            {safeIndex < records.length - 1 ? (
                                <button
                                    type="button"
                                    aria-label="Next page"
                                    onClick={() =>
                                        setCurrentIndex((i) => Math.min(i + 1, records.length - 1))
                                    }
                                    className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                                >
                                    <ChevronRight size={26} />
                                </button>
                            ) : null}
                            <div
                                aria-live="polite"
                                className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs tabular-nums text-white"
                            >
                                {safeIndex + 1} / {records.length}
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}

            {printing ? (
                <PrintLayer page={page} layout={layout} records={printRecords} table={table} />
            ) : null}
        </div>
    );
}
