// Renders one page at true page-px size for a given record, with all elements
// absolutely positioned. Scaled via a CSS transform so element coordinates stay
// in page-px (scale=1 for print, fit-to-width on screen). Read-only and reused
// by both view mode and as the base layer of the editor.

import {resolvePageSizePx} from '../domain/page_geometry.mjs';
import {getOrderedElements} from '../domain/layout_model.mjs';
import {elementBoxStyle, elementContentStyle} from './geometry_style.js';
import {ElementContent} from './element_content.js';
import {ElementBoundary} from '../ui/error_boundary.js';

// Shown in place of an element whose render throws. Silent (null) when published so
// a viewer never sees a broken box; a subtle marker in the editor so the builder can
// find and fix it.
function ElementRenderError({editor}) {
    return editor ? (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-red-red bg-red-redLight2 text-[11px] text-red-redDark1">
            Can’t render
        </div>
    ) : null;
}

// scaleMode 'transform' (screen): visual-only scale, layout box stays full-size.
// scaleMode 'zoom' (print): resizes the layout box too — required for print, because
// Chrome paginates on the pre-transform height and would otherwise spill each page.
export function PageCanvas({
    page,
    layout,
    record,
    table,
    scale = 1,
    scaleMode = 'transform',
    className = '',
    editor = false,
    eagerImages = false,
    interactive = false,
}) {
    const {width, height} = resolvePageSizePx(page);
    const elements = getOrderedElements(layout);
    const useZoom = scaleMode === 'zoom';

    return (
        <div
            className={className}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: !useZoom && scale !== 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'top left',
                zoom: useZoom && scale !== 1 ? scale : undefined,
                flex: 'none',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    backgroundColor: page.backgroundColor || '#ffffff',
                    boxShadow:
                        '0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06), 0 12px 28px -8px rgba(0,0,0,0.2)',
                    overflow: 'hidden',
                }}
            >
                <div style={{position: 'absolute', inset: 0}}>
                    {elements.map((element) => {
                        // Cell-value signature: Record objects mutate in place (stable ref),
                        // so ElementContent's memo would miss a field's value changing —
                        // including server-recomputed formula/rollup values after an edit.
                        // Threading the current value busts the memo when it actually changes.
                        const boundField =
                            element.fieldId && table ? table.getFieldByIdIfExists(element.fieldId) : null;
                        let valueKey = null;
                        if (boundField && record) {
                            try {
                                valueKey = record.getCellValueAsString(boundField);
                            } catch {
                                valueKey = null;
                            }
                        }
                        // An editable field's affordance (ring/pill/input) can be taller
                        // than a small element box; let it spill instead of clipping in
                        // interactive view. Print and the editor stay clipped.
                        const editableInteractive = interactive && element.style.editable;
                        const contentStyle = elementContentStyle(element.style);
                        if (editableInteractive) contentStyle.overflow = 'visible';
                        return (
                            <div
                                key={element.id}
                                style={{
                                    ...elementBoxStyle(element),
                                    zIndex: editableInteractive ? 1 : undefined,
                                }}
                            >
                                <div style={contentStyle}>
                                    <ElementBoundary
                                        resetKey={element}
                                        fallback={<ElementRenderError editor={editor} />}
                                    >
                                        <ElementContent
                                            element={element}
                                            record={record}
                                            table={table}
                                            eagerImages={eagerImages}
                                            interactive={interactive}
                                            editor={editor}
                                            valueKey={valueKey}
                                        />
                                    </ElementBoundary>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Scaled wrapper that reserves the correct layout box for a scaled page so it
// doesn't overlap siblings (CSS transform doesn't affect layout size).
export function ScaledPage({page, scale, children}) {
    const {width, height} = resolvePageSizePx(page);
    return (
        <div style={{width: `${width * scale}px`, height: `${height * scale}px`, flex: 'none'}}>
            {children}
        </div>
    );
}
