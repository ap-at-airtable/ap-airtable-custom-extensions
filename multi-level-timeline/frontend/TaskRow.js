import {useState, useCallback, useRef, useEffect} from 'react';
import {expandRecord} from '@airtable/blocks/interface/ui';
import {CaretRight, CaretDown} from '@phosphor-icons/react';
import {ROW_HEIGHT as DEFAULT_ROW_HEIGHT, LEVEL_COLORS} from './constants';
import InlineCell from './InlineCell';

export default function TaskRow({item, onToggle, onDoubleClick, onExpandAll, onCollapseAll, sidebarColumns, nameWidth, frozenField, selectedRowIds, onSelect, searchHighlights, setSelectedRowId, rowHeight}) {
    const ROW_HEIGHT = rowHeight || DEFAULT_ROW_HEIGHT;
    const levelStyle = LEVEL_COLORS[Math.min(item.level, 3)];
    const indent = item.level * 20 + 8;
    const [contextMenu, setContextMenu] = useState(null);
    const menuRef = useRef(null);
    const isSelected = selectedRowIds ? selectedRowIds.has(item.id) : false;

    const handleToggle = useCallback((e) => {
        e.stopPropagation();
        onToggle(item.id);
    }, [item.id, onToggle]);

    const handleDblClick = useCallback(() => {
        if (onDoubleClick) onDoubleClick(item);
    }, [item, onDoubleClick]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        setContextMenu({x: e.clientX, y: e.clientY});
    }, []);

    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = () => setContextMenu(null);
        const handleKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setContextMenu(null); } };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKey);
        };
    }, [contextMenu]);

    const totalSidebarWidth = sidebarColumns ? sidebarColumns.reduce((sum, c) => sum + c.width, 0) : 0;
    // Frozen field replaces the name column — no separate frozen column width
    const nameField = frozenField || null;

    const handleClick = useCallback((e) => {
        if (setSelectedRowId) setSelectedRowId(item.id);
        if (onSelect) onSelect(item.id, e.metaKey || e.ctrlKey);
    }, [item.id, setSelectedRowId, onSelect]);

    const isSearchCursor = searchHighlights && searchHighlights.cursorId === item.id;
    const isSearchMatch = searchHighlights && searchHighlights.highlightIds && searchHighlights.highlightIds.has(item.id);
    const levelBg = levelStyle.bg;
    const rowBg = isSearchCursor ? 'rgba(22,110,225,0.15)' : isSearchMatch ? 'rgba(22,110,225,0.07)' : isSelected ? 'var(--surface-active)' : levelBg;

    return (
        <div
            className={`gantt-row flex items-center cursor-default ${isSelected ? 'is-selected' : ''}`}
            style={{
                height: ROW_HEIGHT,
                minWidth: '100%',
                borderTop: item.level === 0 ? '1px solid rgba(0,0,0,0.08)' : undefined,
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                background: rowBg,
            }}
            role="treeitem"
            aria-level={item.level + 1}
            aria-selected={isSelected}
            aria-expanded={item.hasChildren ? item.isExpanded : undefined}
            aria-label={item.name}
            tabIndex={-1}
            data-row-id={item.id}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            {contextMenu && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Row actions"
                    className="context-menu fixed z-50"
                    style={{left: contextMenu.x, top: contextMenu.y}}
                >
                    {item.record && (
                        <button
                            role="menuitem"
                            className="context-menu-item"
                            onClick={(e) => { e.stopPropagation(); try { expandRecord(item.record); } catch { /* */ } setContextMenu(null); }}
                        >
                            <span>Open record</span>
                            <span style={{fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 16}}>Space</span>
                        </button>
                    )}
                    {item.record && <div className="context-menu-separator" />}
                    {item.hasChildren && (
                        <button
                            role="menuitem"
                            className="context-menu-item"
                            onClick={(e) => { e.stopPropagation(); onToggle(item.id); setContextMenu(null); }}
                        >
                            <span>{item.isExpanded ? 'Collapse' : 'Expand'}</span>
                            <span style={{fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 16}}>{'\u2190'} / {'\u2192'}</span>
                        </button>
                    )}
                    <button
                        role="menuitem"
                        className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); onExpandAll(); setContextMenu(null); }}
                    >
                        Expand all
                    </button>
                    <button
                        role="menuitem"
                        className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); onCollapseAll(); setContextMenu(null); }}
                    >
                        Collapse all
                    </button>
                    <div className="context-menu-separator" />
                    <button
                        role="menuitem"
                        className="context-menu-item"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.name).catch(() => {}); setContextMenu(null); }}
                    >
                        Copy name
                    </button>
                </div>
            )}
            <div
                className="gantt-row-sticky flex items-center flex-shrink-0 min-w-0 overflow-hidden sticky left-0 z-10"
                style={{paddingLeft: indent, width: nameWidth || 200, backgroundColor: rowBg || 'var(--surface)'}}
                onDoubleClick={handleDblClick}
            >
                {item.hasChildren ? (
                    <button
                        onClick={handleToggle}
                        aria-label={item.isExpanded ? 'Collapse' : 'Expand'}
                        tabIndex={-1}
                        className="aero-transition flex-shrink-0 flex items-center justify-center mr-0.5 rounded"
                        style={{width: 18, height: 18, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer'}}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                    >
                        {item.isExpanded ? <CaretDown size={10} weight="bold" /> : <CaretRight size={10} weight="bold" />}
                    </button>
                ) : (
                    <span className="flex-shrink-0 mr-0.5" style={{width: 18}} />
                )}
                {/* Editable name via InlineCell if frozen field is set and item is a bar */}
                {nameField && item.type === 'bar' && item.record ? (
                    <div className="flex-1 min-w-0">
                        <InlineCell record={item.record} field={nameField} table={item.table} width={Math.max((nameWidth || 200) - indent - 22, 60)} />
                    </div>
                ) : (
                    <span className={`truncate leading-snug ${levelStyle.text} ${levelStyle.font}`} style={{fontSize: 13}}>
                        {item.name}
                    </span>
                )}
            </div>
            {sidebarColumns && sidebarColumns.length > 0 && item.type === 'bar' && (
                sidebarColumns.map(col => (
                    <InlineCell key={col.field.id} record={item.record} field={col.field} table={item.table} width={col.width} />
                ))
            )}
            {sidebarColumns && sidebarColumns.length > 0 && item.type === 'group' && (
                <div style={{width: totalSidebarWidth}} className="flex-shrink-0" />
            )}
        </div>
    );
}
