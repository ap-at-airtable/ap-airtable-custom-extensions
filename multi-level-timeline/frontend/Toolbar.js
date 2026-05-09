import {MagnifyingGlassMinus, MagnifyingGlassPlus, Path, Rows, RowsPlusBottom, ArrowsOut} from '@phosphor-icons/react';
import {ZOOM_PRESETS, MIN_ZOOM_MULTIPLIER, MAX_ZOOM_MULTIPLIER} from './constants';

export default function Toolbar({
    timeScale, onTimeScaleChange,
    zoomMultiplier, onZoomChange,
    showDependencies, onToggleDependencies,
    isCompact, onToggleCompact,
    onFitToScreen,
}) {

    return (
        <div className="flex items-center gap-2 px-2.5 h-9 flex-shrink-0" style={{borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)'}}>
            {/* Time scale segmented control */}
            <div className="flex items-center rounded-md p-0.5" style={{background: 'rgba(0,0,0,0.04)'}}>
                {Object.entries(ZOOM_PRESETS).map(([key, preset]) => (
                    <button
                        key={key}
                        onClick={() => onTimeScaleChange(key)}
                        className="aero-transition"
                        style={{
                            padding: '2px 8px',
                            fontSize: 12,
                            fontWeight: timeScale === key ? 500 : 400,
                            color: timeScale === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                            background: timeScale === key ? 'var(--surface)' : 'transparent',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: timeScale === key ? 'var(--shadow-sm)' : 'none',
                            border: 'none',
                            cursor: 'pointer',
                            lineHeight: '20px',
                        }}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center" style={{gap: 2}}>
                <button
                    onClick={() => onZoomChange(Math.max(MIN_ZOOM_MULTIPLIER, zoomMultiplier - 0.25))}
                    className="aero-transition flex items-center justify-center"
                    style={{width: 24, height: 24, borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer'}}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Zoom out"
                >
                    <MagnifyingGlassMinus size={14} />
                </button>
                <span style={{fontSize: 11, color: 'var(--text-tertiary)', width: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums'}}>
                    {Math.round(zoomMultiplier * 100)}%
                </span>
                <button
                    onClick={() => onZoomChange(Math.min(MAX_ZOOM_MULTIPLIER, zoomMultiplier + 0.25))}
                    className="aero-transition flex items-center justify-center"
                    style={{width: 24, height: 24, borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer'}}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Zoom in"
                >
                    <MagnifyingGlassPlus size={14} />
                </button>
                <button
                    onClick={onFitToScreen}
                    className="aero-transition flex items-center justify-center"
                    style={{width: 24, height: 24, borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer'}}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Fit to screen"
                >
                    <ArrowsOut size={14} />
                </button>
            </div>

            {/* View toggles */}
            <div className="flex items-center" style={{gap: 1}}>
                <ToggleButton active={isCompact} onClick={onToggleCompact} title={isCompact ? 'Regular rows' : 'Compact rows'}>
                    {isCompact ? <Rows size={13} /> : <RowsPlusBottom size={13} />}
                </ToggleButton>
                <ToggleButton active={showDependencies} onClick={onToggleDependencies} title="Dependencies" accentColor="#166EE1">
                    <Path size={13} />
                </ToggleButton>
            </div>

            <div className="flex-1" />
        </div>
    );
}

function ToggleButton({active, onClick, title, accentColor, children}) {
    const activeStyle = active ? {
        background: accentColor ? `${accentColor}10` : 'rgba(0,0,0,0.06)',
        color: accentColor || 'var(--text-primary)',
    } : {
        background: 'transparent',
        color: 'var(--text-tertiary)',
    };

    return (
        <button
            onClick={onClick}
            className="aero-transition flex items-center justify-center"
            style={{
                width: 28,
                height: 24,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                ...activeStyle,
            }}
            title={title}
        >
            {children}
        </button>
    );
}
