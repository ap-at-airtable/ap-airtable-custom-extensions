import {forwardRef, useState, useCallback, useRef, useEffect} from 'react';
import TaskRow from './TaskRow';
import AddRow from './AddRow';
import {HEADER_HEIGHT} from './constants';
import {useLocalStorage} from './useLocalStorage';

const MIN_COL_WIDTH = 60;
const DEFAULT_COL_WIDTH = 100;
const TaskList = forwardRef(function TaskList({items, onToggle, onDoubleClick, onScroll, onAddSubtask, onAddTask, onExpandAll, onCollapseAll, sidebarFields, frozenField, selectedRowId, setSelectedRowId, selectedRowIds, onSelect, searchHighlights, rowHeight, headerHeight}, ref) {
    const [columnWidths, setColumnWidths] = useLocalStorage('columnWidths', () => {
        const widths = {};
        if (sidebarFields) {
            for (const f of sidebarFields) {
                if (f) widths[f.id] = DEFAULT_COL_WIDTH;
            }
        }
        return widths;
    });

    // Update widths when new fields are added
    useEffect(() => {
        if (!sidebarFields) return;
        setColumnWidths(prev => {
            const next = {...prev};
            let changed = false;
            for (const f of sidebarFields) {
                if (f && !(f.id in next)) {
                    next[f.id] = DEFAULT_COL_WIDTH;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [sidebarFields, setColumnWidths]);

    const columns = (sidebarFields || []).filter(Boolean).map(field => ({
        field,
        width: columnWidths[field.id] || DEFAULT_COL_WIDTH,
    }));

    const totalSidebarWidth = columns.reduce((sum, c) => sum + c.width, 0);

    // Measure pane width so the name column fills remaining space
    const [paneWidth, setPaneWidth] = useState(420);
    const paneRef = useRef(null);
    useEffect(() => {
        const el = paneRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) setPaneWidth(entry.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const [nameWidth, setNameWidth] = useLocalStorage('nameColWidth', null); // null = auto-fill
    const nameColWidth = nameWidth !== null
        ? Math.max(120, nameWidth)
        : Math.max(120, paneWidth - totalSidebarWidth);
    const totalRowWidth = nameColWidth + totalSidebarWidth;

    const headerRef = useRef(null);
    const bodyRef = useRef(null);
    const dragState = useRef(null);

    const handleResizeStart = useCallback((e, fieldId) => {
        e.preventDefault();
        const isName = fieldId === '__name__';
        dragState.current = {
            fieldId,
            isName,
            startX: e.clientX,
            startWidth: isName ? nameColWidth : (columnWidths[fieldId] || DEFAULT_COL_WIDTH),
        };

        function onMouseMove(ev) {
            if (!dragState.current) return;
            const delta = ev.clientX - dragState.current.startX;
            if (dragState.current.isName) {
                setNameWidth(Math.max(120, dragState.current.startWidth + delta));
            } else {
                const newWidth = Math.max(MIN_COL_WIDTH, dragState.current.startWidth + delta);
                setNameWidth(prev => prev !== null ? prev : nameColWidth);
                setColumnWidths(prev => ({...prev, [dragState.current.fieldId]: newWidth}));
            }
        }

        function onMouseUp() {
            dragState.current = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [columnWidths, nameColWidth, setColumnWidths, setNameWidth]);

    // Sync vertical scroll to the external ref, horizontal scroll to header
    const handleBodyScroll = useCallback((e) => {
        if (onScroll) onScroll(e);
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.target.scrollLeft;
        }
    }, [onScroll]);

    // Ensure scrolled to leftmost on mount
    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollLeft = 0;
        if (headerRef.current) headerRef.current.scrollLeft = 0;
    }, []);

    // Combine refs: external ref for vertical sync + internal bodyRef
    const setBodyRef = useCallback((el) => {
        bodyRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
    }, [ref]);

    return (
        <div ref={paneRef} className="flex flex-col h-full bg-white">
            <div
                ref={headerRef}
                className="flex-shrink-0 overflow-hidden"
                style={{height: headerHeight || HEADER_HEIGHT, borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)'}}
            >
                <div className="flex items-end h-full" style={{width: totalRowWidth}}>
                    <div className="flex items-end flex-shrink-0 px-2 pb-1 relative sticky left-0 z-20" style={{width: nameColWidth, background: 'var(--surface)'}}>
                        <span style={{fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)'}}>
                            {frozenField ? frozenField.name : 'Task Name'}
                        </span>
                        <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10"
                            onMouseDown={(e) => handleResizeStart(e, '__name__')}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,110,225,0.3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        />
                    </div>
                    {columns.map(col => (
                        <div
                            key={col.field.id}
                            className="flex items-end pb-1 px-1.5 flex-shrink-0 relative"
                            style={{width: col.width, borderLeft: '1px solid var(--border-subtle)'}}
                        >
                            <span className="truncate" style={{fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)'}}>
                                {col.field.name}
                            </span>
                            <div
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10"
                                onMouseDown={(e) => handleResizeStart(e, col.field.id)}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,110,225,0.3)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div ref={setBodyRef} className="flex-1 overflow-y-auto overflow-x-auto" role="tree" aria-label="Task list" onScroll={handleBodyScroll}>
                {items.map(item => {
                    if (item.type === 'add') {
                        return (
                            <AddRow
                                key={item.id}
                                item={item}
                                onAdd={item.addType === 'task' ? onAddTask : onAddSubtask}
                                rowHeight={rowHeight}
                                isSelected={selectedRowId === item.id}
                                onSelect={onSelect}
                                setSelectedRowId={setSelectedRowId}
                            />
                        );
                    }
                    return (
                        <TaskRow
                            key={item.id}
                            item={item}
                            onToggle={onToggle}
                            onDoubleClick={onDoubleClick}
                            onExpandAll={onExpandAll}
                            onCollapseAll={onCollapseAll}
                            sidebarColumns={columns}
                            nameWidth={nameColWidth}
                            frozenField={frozenField}
                            selectedRowIds={selectedRowIds}
                            onSelect={onSelect}
                            searchHighlights={searchHighlights}
                            setSelectedRowId={setSelectedRowId}
                            rowHeight={rowHeight}
                        />
                    );
                })}
            </div>
        </div>
    );
});

export default TaskList;
