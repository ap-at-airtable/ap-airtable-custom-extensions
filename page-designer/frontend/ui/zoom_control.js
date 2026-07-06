// Floating zoom pill over a page canvas. Click the percentage to snap back to
// fit-to-width. Shared by the editor and the published view. pd-screen-only so
// it never prints. When onPrev/onNext are passed (published single-page view), it
// also shows page-nav arrows on either side of the zoom controls.

import {IconButton} from './primitives.js';
import {MinusIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon} from './icons.js';

function Divider() {
    return <span className="mx-0.5 h-5 w-px self-center bg-gray-gray200 dark:bg-gray-gray700" />;
}

export function ZoomControl({scale, isFit, onOut, onIn, onReset, onPrev, onNext, prevDisabled, nextDisabled, align = 'center'}) {
    const hasNav = Boolean(onPrev || onNext);
    // The editor pins the pill bottom-right so it never covers footer elements being
    // edited; the view keeps its pager pill centered (conventional for paging).
    const alignClass = align === 'right' ? 'justify-end pr-3' : 'justify-center';
    return (
        <div className={`pd-screen-only pointer-events-none absolute inset-x-0 bottom-3 flex ${alignClass}`}>
            <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-gray-gray200 bg-white p-1 shadow-md dark:border-gray-gray700 dark:bg-gray-gray800">
                {hasNav ? (
                    <>
                        <IconButton
                            icon={ChevronLeftIcon}
                            label="Previous page"
                            onClick={onPrev}
                            disabled={prevDisabled}
                        />
                        <Divider />
                    </>
                ) : null}
                <IconButton icon={MinusIcon} label="Zoom out" onClick={onOut} />
                <button
                    type="button"
                    onClick={onReset}
                    title={isFit ? 'Fit to width' : 'Reset to fit'}
                    className="min-w-[3.25rem] rounded-md px-2 py-1 text-xs font-medium tabular-nums text-gray-gray600 hover:bg-gray-gray100 dark:text-gray-gray200 dark:hover:bg-gray-gray700"
                >
                    {Math.round(scale * 100)}%
                </button>
                <IconButton icon={PlusIcon} label="Zoom in" onClick={onIn} />
                {hasNav ? (
                    <>
                        <Divider />
                        <IconButton
                            icon={ChevronRightIcon}
                            label="Next page"
                            onClick={onNext}
                            disabled={nextDisabled}
                        />
                    </>
                ) : null}
            </div>
        </div>
    );
}
