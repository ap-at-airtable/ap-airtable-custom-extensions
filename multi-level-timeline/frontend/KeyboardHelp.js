const SHORTCUTS = [
    {key: '\u2191 / \u2193', description: 'Navigate rows'},
    {key: '\u2190 / \u2192', description: 'Collapse / Expand'},
    {key: 'Enter', description: 'Add sibling record'},
    {key: '\u21E7 Enter', description: 'Add child record'},
    {key: 'Space', description: 'Open record'},
    {key: 'Escape', description: 'Clear selection'},
    {key: '\u2318 \u232B', description: 'Delete record'},
    {key: 'Tab', description: 'Indent subtask'},
    {key: '\u21E7 Tab', description: 'Outdent subtask'},
    {key: '+ / \u2212', description: 'Zoom in / out'},
    {key: 'T', description: 'Scroll to today'},
    {key: 'F', description: 'Fit to screen'},
    {key: 'Home / End', description: 'Scroll to start / end'},
    {key: '?', description: 'Toggle this help'},
];

export default function KeyboardHelp({onClose}) {
    return (
        <div
            className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center"
            style={{background: 'rgba(0, 0, 0, 0.25)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)'}}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            onClick={onClose}
        >
            <div
                className="modal-content"
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px 24px',
                    width: 340,
                    boxShadow: 'var(--shadow-lg)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <h3 style={{fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, letterSpacing: '-0.01em'}}>
                    Keyboard Shortcuts
                </h3>
                <div style={{display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', alignItems: 'center'}}>
                    {SHORTCUTS.map(({key, description}) => (
                        <div key={key} className="contents">
                            <kbd style={{
                                display: 'inline-block',
                                fontSize: 11,
                                fontFamily: 'inherit',
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                background: 'rgba(0,0,0,0.04)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(0,0,0,0.06)',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                lineHeight: '16px',
                            }}>
                                {key}
                            </kbd>
                            <span style={{fontSize: 12, color: 'var(--text-secondary)'}}>
                                {description}
                            </span>
                        </div>
                    ))}
                </div>
                <div style={{marginTop: 16, display: 'flex', justifyContent: 'flex-end'}}>
                    <button
                        onClick={onClose}
                        style={{
                            fontSize: 12,
                            color: 'var(--text-tertiary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >
                        Press ? to close
                    </button>
                </div>
            </div>
        </div>
    );
}
