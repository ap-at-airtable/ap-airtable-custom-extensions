// Root component. Wires SDK data hooks, detects edit vs view mode, applies the
// Airtable color scheme, and renders the editor or the print view accordingly.
// The data hooks live in <Designer> so they only run once a valid table exists
// (a base always has >=1 table; useRecords requires a real table).

import {useEffect, useState} from 'react';
import {
    useBase,
    useRecords,
    useRunInfo,
    useColorScheme,
    useCustomProperties,
} from '@airtable/blocks/interface/ui';
import {getCustomProperties, CustomPropertyKey} from './state/custom_properties.js';
import {useConfigDocument} from './state/use_config_document.js';
import {ensureFontsLoaded} from './render/fonts.js';
import {ViewMode} from './view/view_mode.js';
import {EditorMode} from './editor/editor_mode.js';
import {ErrorBoundary} from './ui/error_boundary.js';
import {WarningIcon} from './ui/icons.js';

function Notice({title, subtitle}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-gray500">
            <WarningIcon size={36} />
            <div className="text-sm font-medium text-gray-gray600 dark:text-gray-gray300">{title}</div>
            {subtitle ? <div className="max-w-sm text-xs">{subtitle}</div> : null}
        </div>
    );
}

function Designer({base}) {
    const {customPropertyValueByKey, errorState} = useCustomProperties(getCustomProperties);
    const table = customPropertyValueByKey[CustomPropertyKey.TABLE] || base.tables[0];
    const title = customPropertyValueByKey[CustomPropertyKey.TITLE] || '';
    // useRecords can momentarily return null while loading; normalize to [].
    const records = useRecords(table) || [];
    const {isPageElementInEditMode} = useRunInfo();
    const config = useConfigDocument();
    // Local-only editor UI state. Kept here (not in EditorMode) so it survives the
    // preview round-trip, which unmounts EditorMode.
    const [preview, setPreview] = useState(false);
    const [showGrid, setShowGrid] = useState(false);

    if (errorState) {
        return (
            <Notice
                title="Couldn't load configuration"
                subtitle="Check the extension's properties panel for setup errors."
            />
        );
    }
    // Edit the layout only while the interface itself is in edit mode (the builder)
    // and the user can write config; a published interface always renders the view.
    const canEdit = isPageElementInEditMode && config.isEditable;
    if (canEdit && !preview) {
        return (
            <EditorMode
                table={table}
                records={records}
                config={config}
                showGrid={showGrid}
                onToggleGrid={() => setShowGrid((g) => !g)}
                onPreview={() => setPreview(true)}
            />
        );
    }
    return (
        <ViewMode
            page={config.page}
            pages={config.pages}
            records={records}
            table={table}
            title={title}
            onExitPreview={canEdit ? () => setPreview(false) : undefined}
        />
    );
}

export function App() {
    useEffect(() => {
        ensureFontsLoaded();
    }, []);

    const base = useBase();
    const {colorScheme} = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <div className={isDark ? 'dark' : ''} style={{height: '100%'}}>
            <div className="h-full w-full bg-gray-gray50 font-sans text-gray-gray700 dark:bg-gray-gray900 dark:text-gray-gray100">
                <ErrorBoundary
                    fallback={
                        <Notice
                            title="Something went wrong"
                            subtitle="Reload the page to try again. If it persists, check the browser console."
                        />
                    }
                >
                    {base.tables.length === 0 ? (
                        <Notice title="This base has no tables" />
                    ) : (
                        <Designer base={base} />
                    )}
                </ErrorBoundary>
            </div>
        </div>
    );
}
