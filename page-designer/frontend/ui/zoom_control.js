// Floating zoom pill over a page canvas. Click the percentage to snap back to
// fit-to-width. Shared by the editor and the published view. pd-screen-only so
// it never prints.

import {IconButton} from './primitives.js';
import {MinusIcon, PlusIcon} from './icons.js';

export function ZoomControl({scale, isFit, onOut, onIn, onReset}) {
    return (
        <div className="pd-screen-only pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-gray-gray200 bg-white p-1 shadow-md dark:border-gray-gray700 dark:bg-gray-gray800">
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
            </div>
        </div>
    );
}
