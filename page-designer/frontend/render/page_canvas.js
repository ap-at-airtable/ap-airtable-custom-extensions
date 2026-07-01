// Renders one page at true page-px size for a given record, with all elements
// absolutely positioned. Scaled via a CSS transform so element coordinates stay
// in page-px (scale=1 for print, fit-to-width on screen). Read-only and reused
// by both view mode and as the base layer of the editor.

import {resolvePageSizePx} from '../domain/page_geometry.mjs';
import {getOrderedElements} from '../domain/layout_model.mjs';
import {elementBoxStyle, elementContentStyle} from './geometry_style.js';
import {ElementContent, resolveElementRules} from './element_content.js';
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
                        const {visible, colorOverride} = resolveElementRules(element, record, table);
                        // Hidden by a rule: drop it entirely when published/printed; in the
                        // editor keep it (dimmed) so the builder can still select and edit it.
                        if (!visible && !editor) {
                            return null;
                        }
                        return (
                            <div
                                key={element.id}
                                style={{...elementBoxStyle(element), opacity: visible ? undefined : 0.4}}
                            >
                                <div style={elementContentStyle(element.style)}>
                                    <ElementBoundary
                                        resetKey={element}
                                        fallback={<ElementRenderError editor={editor} />}
                                    >
                                        <ElementContent
                                            element={element}
                                            record={record}
                                            table={table}
                                            colorOverride={colorOverride}
                                            eagerImages={eagerImages}
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
