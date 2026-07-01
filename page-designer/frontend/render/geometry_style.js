// Shared positioning style for a layout element, used by both the read-only
// PageCanvas and the editor's interaction overlay so they stay pixel-aligned.

export function elementBoxStyle(element) {
    return {
        position: 'absolute',
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: 'center center',
    };
}

const ALIGN_TO_JUSTIFY = {top: 'flex-start', middle: 'center', bottom: 'flex-end'};

// Inner content style derived from an element's `style` block.
export function elementContentStyle(style) {
    return {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: ALIGN_TO_JUSTIFY[style.verticalAlign] || 'flex-start',
        boxSizing: 'border-box',
        padding: `${style.padding || 0}px`,
        backgroundColor:
            style.backgroundColor && style.backgroundColor !== 'transparent'
                ? style.backgroundColor
                : undefined,
        border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : undefined,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        overflow: 'hidden',
    };
}

export function textStyle(style) {
    return {
        fontFamily: `'${style.fontFamily}', sans-serif`,
        fontSize: `${style.fontSize}px`,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textDecoration: style.underline ? 'underline' : 'none',
        color: style.color,
        textAlign: style.textAlign,
        lineHeight: 1.25,
        width: '100%',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'hidden',
    };
}
