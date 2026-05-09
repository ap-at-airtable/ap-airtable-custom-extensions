import {useState, useRef, useCallback, useMemo, useEffect} from 'react';
import {expandRecord} from '@airtable/blocks/interface/ui';
import {CaretLeft, CaretRight, Crosshair} from '@phosphor-icons/react';
import Toolbar from './Toolbar';
import KeyboardHelp from './KeyboardHelp';
import SplitPane from './SplitPane';
import TaskList from './TaskList';
import TimelineHeader from './TimelineHeader';
import TimelineGrid from './TimelineGrid';
import SearchBar from './SearchBar';
import {addDays, makeDayDiff, today as getToday} from './dateUtils';
import {ZOOM_PRESETS, DEFAULT_ZOOM, MIN_ZOOM_MULTIPLIER, MAX_ZOOM_MULTIPLIER, ROW_HEIGHT, ROW_HEIGHT_COMPACT, HEADER_HEIGHT, HEADER_HEIGHT_DAY} from './constants';
import {useLocalStorage} from './useLocalStorage';
import {useUndoRedo} from './useUndoRedo';

export default function GanttChart({items, timelineStart, timelineEnd, toggleExpand, expandAll, collapseAll, selectedRowId, setSelectedRowId, config}) {
    const [timeScale, setTimeScale] = useLocalStorage('timeScale', DEFAULT_ZOOM);
    const [zoomMultiplier, setZoomMultiplier] = useLocalStorage('zoomMultiplier', 1);
    const [showDeps, setShowDeps] = useLocalStorage('showDeps', config.showDependencies !== false);
    const [isCompact, setIsCompact] = useLocalStorage('isCompact', false);
    const [rightPanelWidth, setRightPanelWidth] = useState(0);
    const [showHelp, setShowHelp] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const [selectedRowIds, setSelectedRowIds] = useState(new Set());
    const [showSearch, setShowSearch] = useState(false);
    const [searchHighlights, setSearchHighlights] = useState({cursorId: null, highlightIds: new Set()});
    const {undo, redo} = useUndoRedo();
    const rootRef = useRef(null);

    const toggleSelection = useCallback((id, additive) => {
        setSelectedRowIds(prev => {
            const next = new Set(prev);
            if (additive) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                return new Set([id]);
            }
            return next;
        });
    }, []);

    const taskListRef = useRef(null);
    const timelineGridRef = useRef(null);
    const timelineHeaderRef = useRef(null);
    const rightPanelRef = useRef(null);

    const pxPerDay = ZOOM_PRESETS[timeScale].basePxPerDay * zoomMultiplier;
    const dayDiff = useMemo(() => makeDayDiff(config.hideWeekends), [config.hideWeekends]);
    const rowHeight = isCompact ? ROW_HEIGHT_COMPACT : ROW_HEIGHT;
    const headerHeight = timeScale === 'day' ? HEADER_HEIGHT_DAY : HEADER_HEIGHT;

    // Measure the right panel so we can ensure the timeline fills it
    useEffect(() => {
        const el = rightPanelRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setRightPanelWidth(entry.contentRect.width);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Infinite scroll: extend timeline start/end as user scrolls near edges
    const EXTEND_DAYS = 90;
    const EDGE_THRESHOLD_PX = 200;
    const [startOffset, setStartOffset] = useState(0); // days added before data start
    const [endOffset, setEndOffset] = useState(0); // days added after data end

    const effectiveTimelineStart = useMemo(() => {
        if (!timelineStart) return timelineStart;
        return startOffset > 0 ? addDays(timelineStart, -startOffset) : timelineStart;
    }, [timelineStart, startOffset]);

    const effectiveTimelineEnd = useMemo(() => {
        if (!timelineEnd) return timelineEnd;
        const baseEnd = addDays(timelineEnd, endOffset);
        // Also ensure we fill the viewport
        if (effectiveTimelineStart && rightPanelWidth > 0) {
            const totalDays = dayDiff(effectiveTimelineStart, baseEnd);
            const visibleDays = Math.ceil(rightPanelWidth / pxPerDay) + 14;
            if (totalDays < visibleDays) {
                return addDays(effectiveTimelineStart, visibleDays);
            }
        }
        return baseEnd;
    }, [timelineEnd, endOffset, effectiveTimelineStart, rightPanelWidth, pxPerDay, dayDiff]);

    const criticalSet = useMemo(() => new Set(), []);

    const handleTaskListScroll = useCallback((e) => {
        if (timelineGridRef.current) {
            timelineGridRef.current.scrollTop = e.target.scrollTop;
        }
    }, []);

    const extendingRef = useRef(false);
    const hasScrolledRef = useRef(false);
    const handleTimelineScroll = useCallback((e) => {
        const el = e.target;
        if (taskListRef.current) {
            taskListRef.current.scrollTop = el.scrollTop;
        }
        if (timelineHeaderRef.current) {
            timelineHeaderRef.current.scrollLeft = el.scrollLeft;
        }

        if (extendingRef.current) return; // skip during scroll compensation

        // Track that user has interacted with scroll
        if (el.scrollLeft > EDGE_THRESHOLD_PX) hasScrolledRef.current = true;

        // Infinite scroll: extend right edge
        const scrollRight = el.scrollWidth - el.scrollLeft - el.clientWidth;
        if (scrollRight < EDGE_THRESHOLD_PX) {
            setEndOffset(prev => prev + EXTEND_DAYS);
        }

        // Infinite scroll: extend left edge (only after user has scrolled past threshold once)
        if (hasScrolledRef.current && el.scrollLeft < EDGE_THRESHOLD_PX && el.scrollWidth > el.clientWidth) {
            extendingRef.current = true;
            setStartOffset(prev => {
                const newOffset = prev + EXTEND_DAYS;
                // Compensate scroll position after React re-renders with new width
                requestAnimationFrame(() => {
                    const addedPx = EXTEND_DAYS * pxPerDay;
                    el.scrollLeft += addedPx;
                    if (timelineHeaderRef.current) {
                        timelineHeaderRef.current.scrollLeft += addedPx;
                    }
                    // Allow next extension after compensation settles
                    requestAnimationFrame(() => { extendingRef.current = false; });
                });
                return newOffset;
            });
        }
    }, [pxPerDay]);

    const handleDoubleClick = useCallback((item) => {
        if (item.record) {
            try {
                expandRecord(item.record);
            } catch {
                // Silently fail if expand not available
            }
        }
    }, []);

    const handleScrollToToday = useCallback(() => {
        const t = getToday();
        if (!effectiveTimelineStart || !timelineGridRef.current) return;
        const todayX = dayDiff(effectiveTimelineStart, t) * pxPerDay;
        const containerWidth = rightPanelWidth || 600;
        const scrollLeft = Math.max(0, todayX - containerWidth / 3);
        timelineGridRef.current.scrollTo({left: scrollLeft, behavior: 'smooth'});
        if (timelineHeaderRef.current) {
            requestAnimationFrame(() => {
                if (timelineHeaderRef.current) {
                    timelineHeaderRef.current.scrollLeft = timelineGridRef.current.scrollLeft;
                }
            });
        }
    }, [effectiveTimelineStart, pxPerDay, rightPanelWidth, dayDiff]);

    const handleScrollByUnit = useCallback((direction) => {
        if (!timelineGridRef.current) return;
        const unitDays = timeScale === 'day' ? 7 : timeScale === 'week' ? 14 : 30;
        const delta = direction * unitDays * pxPerDay;
        const newScrollLeft = timelineGridRef.current.scrollLeft + delta;
        timelineGridRef.current.scrollTo({left: newScrollLeft, behavior: 'smooth'});
        if (timelineHeaderRef.current) {
            requestAnimationFrame(() => {
                if (timelineHeaderRef.current) {
                    timelineHeaderRef.current.scrollLeft = timelineGridRef.current.scrollLeft;
                }
            });
        }
    }, [timeScale, pxPerDay]);

    const handleFitToScreen = useCallback(() => {
        if (!timelineStart || !timelineEnd || !rightPanelWidth) return;
        // Reset offsets so fit works against original data range
        setStartOffset(0);
        setEndOffset(0);
        const totalDays = dayDiff(timelineStart, timelineEnd);
        if (totalDays <= 0) return;
        const idealPxPerDay = rightPanelWidth / totalDays;
        let bestScale = 'week';
        let bestMultiplier = 1;
        let bestDiff = Infinity;
        for (const [key, preset] of Object.entries(ZOOM_PRESETS)) {
            const multiplier = idealPxPerDay / preset.basePxPerDay;
            const clamped = Math.max(MIN_ZOOM_MULTIPLIER, Math.min(MAX_ZOOM_MULTIPLIER, multiplier));
            const diff = Math.abs(clamped * preset.basePxPerDay - idealPxPerDay);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestScale = key;
                bestMultiplier = clamped;
            }
        }
        setTimeScale(bestScale);
        setZoomMultiplier(Math.round(bestMultiplier * 4) / 4);
        if (timelineGridRef.current) {
            timelineGridRef.current.scrollLeft = 0;
            if (timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = 0;
        }
    }, [timelineStart, timelineEnd, rightPanelWidth, setTimeScale, setZoomMultiplier, dayDiff]);

    // Scroll selected row into view
    const scrollRowIntoView = useCallback((rowId) => {
        requestAnimationFrame(() => {
            const el = taskListRef.current?.querySelector?.(`[data-row-id="${rowId}"]`)
                || document.querySelector(`[data-row-id="${rowId}"]`);
            if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        });
    }, []);

    const handleSearchHighlight = useCallback((cursorId, highlightIds) => {
        setSearchHighlights({cursorId, highlightIds});
        if (cursorId) scrollRowIntoView(cursorId);
    }, [scrollRowIntoView]);

    const announce = useCallback((msg) => {
        setAnnouncement(msg);
        setTimeout(() => setAnnouncement(''), 1000);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;

        function selectRow(id, label) {
            setSelectedRowId(id);
            toggleSelection(id, false);
            scrollRowIntoView(id);
            if (label) announce(label);
        }

        function activateAddRow(rowId) {
            // Directly click the add row DOM element to trigger its editing state
            requestAnimationFrame(() => {
                const el = document.querySelector(`[data-row-id="${rowId}"]`);
                if (el) el.click();
            });
        }

        function handleKeyDown(e) {
            // Skip if user is interacting with form elements or buttons
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Skip if a context menu is open (let context menu handle its own keys)
            if (document.querySelector('.context-menu')) {
                if (e.key === 'Escape') return; // let context menu close itself
                return; // don't navigate rows while menu is open
            }
            // Skip if focused element is a button (toolbar, etc.) — except when no modifier
            // Allow global shortcuts like +/-/t/f/? but not Space/Enter/Arrow on buttons
            if (tag === 'BUTTON') {
                const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Tab', 'Escape'];
                if (navKeys.includes(e.key)) return;
            }

            // Cmd/Ctrl+F: open search
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearch(true);
                return;
            }
            // Cmd/Ctrl+Z: undo, Cmd/Ctrl+Shift+Z: redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) { redo(); } else { undo(); }
                return;
            }

            // All items are navigable (including add rows)
            const currentIdx = items.findIndex(i => i.id === selectedRowId);
            const currentItem = currentIdx >= 0 ? items[currentIdx] : null;

            switch (e.key) {
                case 'ArrowUp': {
                    e.preventDefault();
                    if (items.length === 0) return;
                    const nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
                    const next = items[nextIdx];
                    selectRow(next.id, next.name || (next.type === 'add' ? (next.addType === 'task' ? 'Add task' : 'Add subtask') : ''));
                    break;
                }
                case 'ArrowDown': {
                    e.preventDefault();
                    if (items.length === 0) return;
                    const nextIdx = currentIdx < items.length - 1 ? currentIdx + 1 : items.length - 1;
                    const next = items[nextIdx];
                    selectRow(next.id, next.name || (next.type === 'add' ? (next.addType === 'task' ? 'Add task' : 'Add subtask') : ''));
                    break;
                }
                case 'Enter': {
                    e.preventDefault();
                    if (!currentItem) break;
                    if (currentItem.type === 'add') {
                        // Already on an add row — activate it
                        activateAddRow(currentItem.id);
                        announce(currentItem.addType === 'task' ? 'Adding task' : 'Adding subtask');
                    } else if (e.shiftKey) {
                        // Shift+Enter: add a child record — find the add row inside this item's children
                        // For groups (project/task): find the add row with parentId === currentItem.id
                        // For bars (subtask): would need sub-subtask add row (parentId === currentItem.id)
                        let addRow = null;
                        for (let i = currentIdx + 1; i < items.length; i++) {
                            if (items[i].type === 'add' && items[i].parentId === currentItem.id) {
                                addRow = items[i];
                                break;
                            }
                            // Stop if we leave this item's scope
                            if (items[i].level <= currentItem.level && items[i].type !== 'add') break;
                        }
                        if (addRow) {
                            // Expand if collapsed so the add row is visible
                            if (currentItem.hasChildren && !currentItem.isExpanded) {
                                toggleExpand(currentItem.id);
                            }
                            selectRow(addRow.id, addRow.addType === 'task' ? 'Adding task' : 'Adding subtask');
                            activateAddRow(addRow.id);
                        }
                    } else {
                        // Enter: add a sibling record — find the add row for the current item's parent
                        let addRow = null;
                        for (let i = currentIdx + 1; i < items.length; i++) {
                            if (items[i].type === 'add' && items[i].parentId === currentItem.parentId) {
                                addRow = items[i];
                                break;
                            }
                        }
                        // Also search backward if not found forward
                        if (!addRow) {
                            for (let i = currentIdx - 1; i >= 0; i--) {
                                if (items[i].type === 'add' && items[i].parentId === currentItem.parentId) {
                                    addRow = items[i];
                                    break;
                                }
                            }
                        }
                        if (addRow) {
                            selectRow(addRow.id, addRow.addType === 'task' ? 'Adding task' : 'Adding subtask');
                            activateAddRow(addRow.id);
                        }
                    }
                    break;
                }
                case ' ': {
                    e.preventDefault();
                    if (!currentItem || currentItem.type === 'add') break;
                    if (currentItem.record) {
                        try { expandRecord(currentItem.record); } catch { /* */ }
                        announce(`Opened ${currentItem.name}`);
                    }
                    break;
                }
                case 'ArrowLeft': {
                    e.preventDefault();
                    if (!currentItem || currentItem.type === 'add') break;
                    if (currentItem.hasChildren && currentItem.isExpanded) {
                        toggleExpand(currentItem.id);
                        announce(`Collapsed ${currentItem.name}`);
                    } else if (currentItem.parentId) {
                        const parent = items.find(i => i.id === currentItem.parentId);
                        selectRow(currentItem.parentId, parent?.name);
                    }
                    break;
                }
                case 'ArrowRight': {
                    e.preventDefault();
                    if (!currentItem || currentItem.type === 'add') break;
                    if (currentItem.hasChildren && !currentItem.isExpanded) {
                        toggleExpand(currentItem.id);
                        announce(`Expanded ${currentItem.name}`);
                    }
                    break;
                }
                case 'Escape': {
                    e.preventDefault();
                    if (showSearch) {
                        setShowSearch(false);
                        setSearchHighlights({cursorId: null, highlightIds: new Set()});
                    } else if (showHelp) {
                        setShowHelp(false);
                    } else {
                        setSelectedRowId(null);
                        setSelectedRowIds(new Set());
                        announce('Selection cleared');
                    }
                    break;
                }
                case 'Delete':
                case 'Backspace': {
                    // Only Delete (not Backspace unless explicitly intended) to avoid accidental deletion
                    if (e.key === 'Backspace' && !e.metaKey) break;
                    e.preventDefault();
                    if (!currentItem || currentItem.type === 'add' || !currentItem.record || !currentItem.table) break;
                    try {
                        if (currentItem.table.hasPermissionToDeleteRecords()) {
                            const recordName = currentItem.name;
                            currentItem.table.deleteRecordAsync(currentItem.record);
                            announce(`Deleted ${recordName}`);
                            // Move selection to next or previous row
                            const nextIdx = currentIdx < items.length - 1 ? currentIdx + 1 : currentIdx - 1;
                            if (nextIdx >= 0 && items[nextIdx]) {
                                setSelectedRowId(items[nextIdx].id);
                            } else {
                                setSelectedRowId(null);
                            }
                        }
                    } catch { /* */ }
                    break;
                }
                case '+':
                case '=': {
                    e.preventDefault();
                    setZoomMultiplier(z => Math.min(MAX_ZOOM_MULTIPLIER, z + 0.25));
                    break;
                }
                case '-': {
                    e.preventDefault();
                    setZoomMultiplier(z => Math.max(MIN_ZOOM_MULTIPLIER, z - 0.25));
                    break;
                }
                case 't':
                case 'T': {
                    e.preventDefault();
                    handleScrollToToday();
                    break;
                }
                case 'f':
                case 'F': {
                    e.preventDefault();
                    handleFitToScreen();
                    break;
                }
                case 'Home': {
                    e.preventDefault();
                    if (timelineGridRef.current) {
                        timelineGridRef.current.scrollLeft = 0;
                        if (timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = 0;
                    }
                    break;
                }
                case 'End': {
                    e.preventDefault();
                    if (timelineGridRef.current) {
                        timelineGridRef.current.scrollLeft = timelineGridRef.current.scrollWidth;
                        if (timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = timelineGridRef.current.scrollWidth;
                    }
                    break;
                }
                case '?': {
                    e.preventDefault();
                    setShowHelp(h => !h);
                    break;
                }
                case 'Tab': {
                    e.preventDefault();
                    if (!currentItem || currentItem.type !== 'bar' || !currentItem.record) break;
                    if (!config.subtaskSelfLink || !config.subtasksTable) break;

                    if (e.shiftKey) {
                        // Outdent: remove from parent subtask's self-link
                        if (currentItem.level <= 2) break;
                        const parentItem = items.find(i => i.id === currentItem.parentId);
                        if (!parentItem || parentItem.type !== 'bar' || !parentItem.record) break;
                        try {
                            const existing = parentItem.record.getCellValue(config.subtaskSelfLink) || [];
                            const updated = existing.filter(link => link.id !== currentItem.record.id);
                            config.subtasksTable.updateRecordAsync(parentItem.record, {
                                [config.subtaskSelfLink.id]: updated,
                            });
                            announce(`Outdented ${currentItem.name}`);
                        } catch { /* */ }
                    } else {
                        // Indent: add to the subtask above as a child via self-link
                        if (currentItem.level < 2) break;
                        let targetItem = null;
                        for (let i = currentIdx - 1; i >= 0; i--) {
                            if (items[i].type === 'bar' && items[i].level === currentItem.level) {
                                targetItem = items[i];
                                break;
                            }
                            if (items[i].level < currentItem.level) break;
                        }
                        if (!targetItem || !targetItem.record) break;
                        try {
                            const existing = targetItem.record.getCellValue(config.subtaskSelfLink) || [];
                            const alreadyLinked = existing.some(link => link.id === currentItem.record.id);
                            if (!alreadyLinked) {
                                const updated = [...existing, {id: currentItem.record.id}];
                                config.subtasksTable.updateRecordAsync(targetItem.record, {
                                    [config.subtaskSelfLink.id]: updated,
                                });
                                announce(`Indented ${currentItem.name}`);
                            }
                        } catch { /* */ }
                    }
                    break;
                }
                default:
                    break;
            }
        }

        el.addEventListener('keydown', handleKeyDown);
        return () => el.removeEventListener('keydown', handleKeyDown);
    }, [items, selectedRowId, setSelectedRowId, setZoomMultiplier, toggleExpand, handleScrollToToday, handleFitToScreen, scrollRowIntoView, announce, showHelp, showSearch, config.subtaskSelfLink, config.subtasksTable, toggleSelection, undo, redo]);

    const handleAddSubtask = useCallback(async (addItem, name) => {
        if (!config.subtasksTable || !config.tasksTable || !config.taskSubtasksLink) return;

        try {
            const canCreate = config.subtasksTable.hasPermissionToCreateRecords();
            if (!canCreate) return;

            const fields = {
                [config.subtasksTable.primaryField.id]: name,
            };

            const newRecordId = await config.subtasksTable.createRecordAsync(fields);

            if (addItem.parentRecord && config.taskSubtasksLink) {
                const existingLinks = addItem.parentRecord.getCellValue(config.taskSubtasksLink) || [];
                const updatedLinks = [...existingLinks, {id: newRecordId}];
                await config.tasksTable.updateRecordAsync(addItem.parentRecord, {
                    [config.taskSubtasksLink.id]: updatedLinks,
                });
            }
        } catch {
            // Create failed
        }
    }, [config.subtasksTable, config.tasksTable, config.taskSubtasksLink]);

    const handleAddTask = useCallback(async (addItem, name) => {
        if (!config.tasksTable || !config.projectsTable || !config.projectTasksLink) return;

        try {
            const canCreate = config.tasksTable.hasPermissionToCreateRecords();
            if (!canCreate) return;

            const fields = {
                [config.tasksTable.primaryField.id]: name,
            };

            const newRecordId = await config.tasksTable.createRecordAsync(fields);

            if (addItem.parentRecord && config.projectTasksLink) {
                const existingLinks = addItem.parentRecord.getCellValue(config.projectTasksLink) || [];
                const updatedLinks = [...existingLinks, {id: newRecordId}];
                await config.projectsTable.updateRecordAsync(addItem.parentRecord, {
                    [config.projectTasksLink.id]: updatedLinks,
                });
            }
        } catch {
            // Create failed
        }
    }, [config.tasksTable, config.projectsTable, config.projectTasksLink]);

    const left = (
        <TaskList
            ref={taskListRef}
            items={items}
            onToggle={toggleExpand}
            onDoubleClick={handleDoubleClick}
            onScroll={handleTaskListScroll}
            onAddSubtask={handleAddSubtask}
            onAddTask={handleAddTask}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            frozenField={config.frozenField}
            sidebarFields={config.sidebarFields}
            selectedRowId={selectedRowId}
            setSelectedRowId={setSelectedRowId}
            selectedRowIds={selectedRowIds}
            onSelect={toggleSelection}
            searchHighlights={searchHighlights}
            rowHeight={rowHeight}
            headerHeight={headerHeight}
        />
    );

    const right = (
        <div ref={rightPanelRef} className="flex flex-col h-full relative">
            <TimelineHeader
                ref={timelineHeaderRef}
                timelineStart={effectiveTimelineStart}
                timelineEnd={effectiveTimelineEnd}
                pxPerDay={pxPerDay}
                timeScale={timeScale}
                headerHeight={headerHeight}
                dayDiff={dayDiff}
            />
            <TimelineGrid
                ref={timelineGridRef}
                items={items}
                timelineStart={effectiveTimelineStart}
                timelineEnd={effectiveTimelineEnd}
                pxPerDay={pxPerDay}
                timeScale={timeScale}
                criticalSet={criticalSet}
                showDependencies={showDeps}
                onScroll={handleTimelineScroll}
                config={config}
                selectedRowId={selectedRowId}
                onBarDoubleClick={handleDoubleClick}
                rowHeight={rowHeight}
                dayDiff={dayDiff}
            />
            {/* Floating controls */}
            <div className="absolute z-30 flex items-center" style={{top: 6, right: 12, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.95)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'}}>
                <button
                    onClick={() => handleScrollByUnit(-1)}
                    className="aero-transition flex items-center justify-center"
                    style={{width: 28, height: 28, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer'}}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Scroll back"
                    aria-label="Scroll timeline back"
                >
                    <CaretLeft size={14} weight="bold" />
                </button>
                <div style={{width: 1, height: 16, background: 'var(--border-subtle)'}} />
                <button
                    onClick={handleScrollToToday}
                    className="aero-transition flex items-center justify-center gap-1"
                    style={{height: 28, padding: '0 10px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500}}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Scroll to today"
                    aria-label="Scroll to today"
                >
                    <Crosshair size={13} />
                    Today
                </button>
                <div style={{width: 1, height: 16, background: 'var(--border-subtle)'}} />
                <button
                    onClick={() => handleScrollByUnit(1)}
                    className="aero-transition flex items-center justify-center"
                    style={{width: 28, height: 28, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer'}}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Scroll forward"
                    aria-label="Scroll timeline forward"
                >
                    <CaretRight size={14} weight="bold" />
                </button>
            </div>
        </div>
    );

    return (
        <div ref={rootRef} className="flex flex-col h-full overflow-hidden bg-white" tabIndex={0} role="application" aria-label="Gantt chart" style={{outline: 'none'}}>
            <div aria-live="polite" aria-atomic="true" className="sr-only" style={{position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap'}}>
                {announcement}
            </div>
            {showSearch && (
                <SearchBar
                    items={items}
                    onHighlight={handleSearchHighlight}
                    onClose={() => { setShowSearch(false); setSearchHighlights({cursorId: null, highlightIds: new Set()}); }}
                />
            )}
            {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}
            <Toolbar
                timeScale={timeScale}
                onTimeScaleChange={setTimeScale}
                zoomMultiplier={zoomMultiplier}
                onZoomChange={setZoomMultiplier}
                showDependencies={showDeps}
                onToggleDependencies={() => setShowDeps(d => !d)}
                isCompact={isCompact}
                onToggleCompact={() => setIsCompact(c => !c)}
                onFitToScreen={handleFitToScreen}
            />
            <div className="flex-1 overflow-hidden">
                <SplitPane left={left} right={right} />
            </div>
        </div>
    );
}
