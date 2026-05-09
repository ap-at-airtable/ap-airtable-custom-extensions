import {useEffect, useRef, useCallback} from 'react';

export default function DepMetadataPopup({predName, succName, onClose, onDelete, position, canEdit}) {
    const popupRef = useRef(null);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    const handleClickOutside = useCallback((e) => {
        if (popupRef.current && !popupRef.current.contains(e.target)) {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleKeyDown, handleClickOutside]);

    return (
        <div
            ref={popupRef}
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                zIndex: 9999,
                background: 'var(--surface, #fff)',
                borderRadius: 'var(--radius-lg, 8px)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                padding: '8px 4px',
                fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
                fontSize: 13,
                color: 'var(--text-primary, #1b1b1b)',
                minWidth: 160,
            }}
        >
            {/* Header */}
            <div style={{
                fontSize: 12,
                padding: '4px 8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text-secondary, #666)',
            }}>
                {predName} → {succName}
            </div>

            {/* Delete button */}
            {canEdit && (
                <button
                    onClick={onDelete}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: 13,
                        fontWeight: 400,
                        color: '#dc043b',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderRadius: 'var(--radius-sm, 4px)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(220,4,59,0.06)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                    }}
                >
                    Remove dependency
                </button>
            )}
        </div>
    );
}
