// Add-element toolbar. Clicking a kind inserts a new element on the page. Fields
// are added from the left Field rail (drag-drop or multi-select), not here.

import {ElementKind, ElementKindLabels} from '../domain/element_types.mjs';
import {TextIcon, ImageIcon, BarcodeIcon, QrIcon, LineIcon} from '../ui/icons.js';

const ITEMS = [
    {kind: ElementKind.TEXT, icon: TextIcon},
    {kind: ElementKind.IMAGE, icon: ImageIcon},
    {kind: ElementKind.BARCODE, icon: BarcodeIcon},
    {kind: ElementKind.QR_CODE, icon: QrIcon},
    {kind: ElementKind.LINE, icon: LineIcon},
];

const CHIP =
    'flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-gray200 bg-white px-2.5 text-xs font-medium text-gray-gray600 shadow-xs transition-all hover:border-blue-blue hover:bg-blue-blueLight3 hover:text-blue-blue dark:border-gray-gray600 dark:bg-gray-gray800 dark:text-gray-gray200 dark:hover:border-blue-blue dark:hover:bg-gray-gray700';

export function ElementPalette({onAdd}) {
    return (
        <div className="flex w-max items-center gap-1">
            {ITEMS.map(({kind, icon: Icon}) => (
                <button key={kind} type="button" onClick={() => onAdd(kind)} className={CHIP}>
                    <Icon size={14} />
                    {ElementKindLabels[kind]}
                </button>
            ))}
        </div>
    );
}
