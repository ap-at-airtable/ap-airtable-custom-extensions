// Page-setup panel for the Page Designer layout editor: page size, orientation,
// and custom dimensions.

import {
    PageType,
    PageOrientation,
    PAGE_TYPE_LABELS,
    DPI,
    MIN_CUSTOM_SIZE_INCHES,
    MAX_CUSTOM_SIZE_INCHES,
    convertLengthFromInchesToPx,
    pageTypeSupportsOrientation,
} from '../domain/page_geometry.mjs';
import {Select, NumberInput, Segmented, ColorInput, Field, SectionHeader} from '../ui/primitives.js';

const PAGE_TYPE_OPTIONS = Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => ({value, label}));

const ORIENTATION_OPTIONS = [
    {value: PageOrientation.PORTRAIT, label: 'Portrait'},
    {value: PageOrientation.LANDSCAPE, label: 'Landscape'},
];

// Custom size is stored in page px but edited in inches; round display to avoid
// float noise like 8.4999".
const pxToInchesDisplay = (px) => Math.round((px / DPI) * 100) / 100;

export function PageSettingsPanel({page, onChangePage}) {
    const isCustom = page.type === PageType.CUSTOM;

    const changeCustomDimension = (dimension, inches) => {
        onChangePage({
            customSize: {
                ...page.customSize,
                [dimension]: convertLengthFromInchesToPx(inches),
            },
        });
    };

    return (
        <div className="flex flex-col gap-4 overflow-auto p-4">
            <div className="space-y-3">
                <SectionHeader>Page</SectionHeader>

                <Field label="Type">
                    <Select
                        value={page.type}
                        options={PAGE_TYPE_OPTIONS}
                        onChange={(type) => onChangePage({type})}
                    />
                </Field>

                {pageTypeSupportsOrientation(page.type) ? (
                    <Field label="Orientation">
                        <Segmented
                            value={page.orientation}
                            options={ORIENTATION_OPTIONS}
                            onChange={(orientation) => onChangePage({orientation})}
                        />
                    </Field>
                ) : null}

                {isCustom ? (
                    <div className="flex gap-2">
                        <Field label="Width">
                            <NumberInput
                                value={pxToInchesDisplay(page.customSize.width)}
                                onChange={(inches) => changeCustomDimension('width', inches)}
                                step={0.1}
                                min={MIN_CUSTOM_SIZE_INCHES}
                                max={MAX_CUSTOM_SIZE_INCHES}
                                suffix={'"'}
                            />
                        </Field>
                        <Field label="Height">
                            <NumberInput
                                value={pxToInchesDisplay(page.customSize.height)}
                                onChange={(inches) => changeCustomDimension('height', inches)}
                                step={0.1}
                                min={MIN_CUSTOM_SIZE_INCHES}
                                max={MAX_CUSTOM_SIZE_INCHES}
                                suffix={'"'}
                            />
                        </Field>
                    </div>
                ) : null}

                <Field label="Background">
                    <ColorInput
                        value={page.backgroundColor}
                        onChange={(backgroundColor) => onChangePage({backgroundColor})}
                        allowClear
                    />
                </Field>
            </div>
        </div>
    );
}
