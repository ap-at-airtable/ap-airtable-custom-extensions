import {forwardRef, useMemo, useCallback, useRef, useState, useEffect} from 'react';
import {expandRecord} from '@airtable/blocks/interface/ui';
import {DndContext} from '@dnd-kit/core';
import GanttBar from './GanttBar';
import MilestoneMarker from './MilestoneMarker';
import DependencyLines from './DependencyLines';
import DepMetadataPopup from './DepMetadataPopup';
import ScrollArrows from './ScrollArrows';
import {diffDays, addDays, today as getToday, getWeekStart, getMonthStart} from './dateUtils';
import {ROW_HEIGHT as DEFAULT_ROW_HEIGHT, LEVEL_COLORS} from './constants';

const TimelineGrid = forwardRef(function TimelineGrid({
    items, timelineStart, timelineEnd, pxPerDay, timeScale,
    criticalSet, showDependencies, onScroll, config, onBarDoubleClick,
    selectedRowId, rowHeight: rowHeightProp, dayDiff: dayDiffProp,
}, ref) {
    const ROW_HEIGHT = rowHeightProp || DEFAULT_ROW_HEIGHT;
    const dd = dayDiffProp || diffDays;
    const totalDays = dd(timelineStart, timelineEnd);
    const totalWidth = Math.max(totalDays * pxPerDay, 100);

    const totalHeight = items.length * ROW_HEIGHT;
    const containerRef = useRef(null);
    const [hoveredBarId, setHoveredBarId] = useState(null);
    const [dragCreate, setDragCreate] = useState(null);
    const [depDragSource, setDepDragSource] = useState(null);
    const [depDragPos, setDepDragPos] = useState(null);
    const [barContextMenu, setBarContextMenu] = useState(null);
    const [depPopup, setDepPopup] = useState(null);
    const autoScrollRef = useRef(null);

    // Clean up auto-scroll interval on unmount
    useEffect(() => {
        return () => clearInterval(autoScrollRef.current);
    }, []);

    // Close bar context menu on outside click or escape
    useEffect(() => {
        if (!barContextMenu) return;
        const handleClick = () => setBarContextMenu(null);
        const handleKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setBarContextMenu(null); } };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKey);
        };
    }, [barContextMenu]);

    // Auto-scroll during drag
    const handleDragMove = useCallback((event) => {
        const container = ref?.current || containerRef.current?.parentElement;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = event.activatorEvent?.clientX + (event.delta?.x || 0);
        if (!mouseX) return;

        const edgeThreshold = 60;
        const scrollSpeed = 8;

        clearInterval(autoScrollRef.current);

        if (mouseX < rect.left + edgeThreshold) {
            autoScrollRef.current = setInterval(() => {
                container.scrollLeft -= scrollSpeed;
            }, 16);
        } else if (mouseX > rect.right - edgeThreshold) {
            autoScrollRef.current = setInterval(() => {
                container.scrollLeft += scrollSpeed;
            }, 16);
        }
    }, [ref]);

    const handleBarContextMenu = useCallback((e, item) => {
        setBarContextMenu({x: e.clientX, y: e.clientY, item});
    }, []);

    const todayPos = useMemo(() => {
        const t = getToday();
        if (t < timelineStart || t > timelineEnd) return null;
        return dd(timelineStart, t) * pxPerDay;
    }, [timelineStart, timelineEnd, pxPerDay, dd]);

    const canEdit = useMemo(() => {
        if (!config.subtasksTable) return false;
        try {
            return config.subtasksTable.hasPermissionToUpdateRecords();
        } catch {
            return false;
        }
    }, [config.subtasksTable]);

    // Build successor map for auto-scheduling
    const successorMap = useMemo(() => {
        const map = new Map();
        for (const item of items) {
            if (item.type !== 'bar' || !item.predecessorIds) continue;
            for (const predId of item.predecessorIds) {
                if (!map.has(predId)) map.set(predId, []);
                map.get(predId).push(item);
            }
        }
        return map;
    }, [items]);

    const propagateToSuccessors = useCallback(async (movedItem, newEnd) => {
        if (!config.subtaskStartDate || !config.subtaskEndDate) return;

        const successors = successorMap.get(movedItem.id);
        if (!successors) return;

        const updates = [];
        for (const succ of successors) {
            if (!succ.record || !succ.table || !succ.startDate || !succ.endDate) continue;
            const depType = succ.dependencyType || 'FS';
            if (depType !== 'FS') continue;

            const requiredStart = addDays(newEnd, 1);
            if (succ.startDate < requiredStart) {
                const duration = dd(succ.startDate, succ.endDate);
                const newSuccEnd = addDays(requiredStart, duration);
                updates.push({
                    record: succ.record,
                    table: succ.table,
                    fields: {
                        [config.subtaskStartDate.id]: requiredStart,
                        [config.subtaskEndDate.id]: newSuccEnd,
                    },
                });
            }
        }

        for (const update of updates) {
            try {
                await update.table.updateRecordAsync(update.record, update.fields);
            } catch {
                // Update failed
            }
        }
    }, [successorMap, config.subtaskStartDate, config.subtaskEndDate, dd]);

    const handleDragEnd = useCallback((event) => {
        clearInterval(autoScrollRef.current);
        const {active, delta} = event;
        if (!active.data.current || !delta.x) return;

        const {item, type} = active.data.current;
        const daysDelta = Math.round(delta.x / pxPerDay);
        if (daysDelta === 0) return;

        if (!item.record || !item.table || !item.startDate || !item.endDate) return;
        if (!config.subtaskStartDate || !config.subtaskEndDate) return;

        try {
            if (type === 'move') {
                const newStart = addDays(item.startDate, daysDelta);
                const newEnd = addDays(item.endDate, daysDelta);
                item.table.updateRecordAsync(item.record, {
                    [config.subtaskStartDate.id]: newStart,
                    [config.subtaskEndDate.id]: newEnd,
                });
                propagateToSuccessors(item, newEnd);
            } else if (type === 'resize') {
                const newEnd = addDays(item.endDate, daysDelta);
                if (newEnd >= item.startDate) {
                    item.table.updateRecordAsync(item.record, {
                        [config.subtaskEndDate.id]: newEnd,
                    });
                    propagateToSuccessors(item, newEnd);
                }
            } else if (type === 'resize-start') {
                const newStart = addDays(item.startDate, daysDelta);
                if (newStart <= item.endDate) {
                    item.table.updateRecordAsync(item.record, {
                        [config.subtaskStartDate.id]: newStart,
                    });
                }
            }
        } catch {
            // Update failed
        }
    }, [pxPerDay, config.subtaskStartDate, config.subtaskEndDate, propagateToSuccessors]);

    // Click-drag to create records on empty canvas
    const handleMouseDown = useCallback((e) => {
        if (!canEdit || !config.subtaskStartDate || !config.subtaskEndDate) return;
        if (e.button !== 0) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Find row
        let rowIdx = Math.floor(y / ROW_HEIGHT);
        if (rowIdx < 0 || rowIdx >= items.length) rowIdx = -1;
        if (rowIdx < 0 || rowIdx >= items.length) return;

        const item = items[rowIdx];
        if (item.type !== 'bar' || (item.startDate && item.endDate)) return;

        const dayOffset = Math.floor(x / pxPerDay);
        setDragCreate({item, startDay: dayOffset, endDay: dayOffset, rowIdx});
    }, [canEdit, config.subtaskStartDate, config.subtaskEndDate, items, pxPerDay, ROW_HEIGHT]);

    const handleMouseMove = useCallback((e) => {
        // Dependency drag tracking
        if (depDragSource) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setDepDragPos({x: e.clientX - rect.left, y: e.clientY - rect.top});
            }
            return;
        }
        if (!dragCreate) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const dayOffset = Math.floor(x / pxPerDay);
        setDragCreate(prev => prev ? {...prev, endDay: dayOffset} : null);
    }, [dragCreate, depDragSource, pxPerDay]);

    const handleMouseUp = useCallback(() => {
        // Dependency drag end
        if (depDragSource && depDragPos) {
            let rowIdx = Math.floor(depDragPos.y / ROW_HEIGHT);
            if (rowIdx < 0 || rowIdx >= items.length) rowIdx = -1;
            if (rowIdx >= 0 && rowIdx < items.length) {
                const targetItem = items[rowIdx];
                if (targetItem.type === 'bar' && targetItem.id !== depDragSource.id &&
                    targetItem.record && config.subtaskPredecessor) {
                    try {
                        const existingPreds = targetItem.record.getCellValue(config.subtaskPredecessor) || [];
                        const alreadyLinked = existingPreds.some(p => p.id === depDragSource.record?.id);
                        if (!alreadyLinked && depDragSource.record) {
                            const updatedPreds = [...existingPreds, {id: depDragSource.record.id}];
                            targetItem.table.updateRecordAsync(targetItem.record, {
                                [config.subtaskPredecessor.id]: updatedPreds,
                            });
                        }
                    } catch {
                        // Dependency creation failed
                    }
                }
            }
            setDepDragSource(null);
            setDepDragPos(null);
            return;
        }

        if (!dragCreate) return;
        const {item, startDay, endDay} = dragCreate;
        const s = Math.min(startDay, endDay);
        const e = Math.max(startDay, endDay);
        if (e - s < 1) {
            // Too small — treat as click
            const clickedDate = addDays(timelineStart, startDay);
            const endDate = addDays(clickedDate, 7);
            try {
                item.table.updateRecordAsync(item.record, {
                    [config.subtaskStartDate.id]: clickedDate,
                    [config.subtaskEndDate.id]: endDate,
                });
            } catch { /* */ }
        } else {
            const startDate = addDays(timelineStart, s);
            const endDate = addDays(timelineStart, e);
            try {
                item.table.updateRecordAsync(item.record, {
                    [config.subtaskStartDate.id]: startDate,
                    [config.subtaskEndDate.id]: endDate,
                });
            } catch { /* */ }
        }
        setDragCreate(null);
    }, [dragCreate, depDragSource, depDragPos, timelineStart, config, items, ROW_HEIGHT]);

    const handleDepDragStart = useCallback((item) => {
        if (!config.subtaskPredecessor) return;
        setDepDragSource(item);
    }, [config.subtaskPredecessor]);

    const handleArrowClick = useCallback((info) => {
        const predItem = items.find(i => i.id === info.predId);
        const succItem = items.find(i => i.id === info.succId);
        if (!predItem || !succItem) return;
        setDepPopup({
            predId: info.predId,
            succId: info.succId,
            predName: predItem.name,
            succName: succItem.name,
            depType: succItem.dependencyType || 'FS',
            x: info.x,
            y: info.y,
        });
    }, [items]);

    // Compute vertical grid lines
    const gridLines = useMemo(() => {
        if (!timelineStart || !timelineEnd) return [];
        const lines = [];
        let current;
        let step;

        if (timeScale === 'day') {
            current = new Date(timelineStart);
            step = 1;
        } else if (timeScale === 'week') {
            current = getWeekStart(timelineStart);
            step = 7;
        } else if (timeScale === 'quarter') {
            // Quarter grid: show month boundaries
            current = getMonthStart(timelineStart);
        } else {
            current = getMonthStart(timelineStart);
        }

        const hideWknd = config.hideWeekends;
        while (current <= timelineEnd) {
            const isWeekend = current.getDay() === 0 || current.getDay() === 6;
            if (hideWknd && isWeekend && timeScale === 'day') {
                current = addDays(current, step);
                continue;
            }
            const x = dd(timelineStart, current) * pxPerDay;
            if (x > 0) {
                lines.push({key: current.getTime(), x, isWeekend: !hideWknd && timeScale === 'day' && isWeekend});
            }
            if (timeScale === 'month' || timeScale === 'quarter') {
                current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
            } else {
                current = addDays(current, step);
            }
        }
        return lines;
    }, [timelineStart, timelineEnd, pxPerDay, timeScale, dd, config.hideWeekends]);

    // Determine which bar is the dep drop target during dep drag
    const depDropTargetId = useMemo(() => {
        if (!depDragSource || !depDragPos) return null;
        const rowIdx = Math.floor(depDragPos.y / ROW_HEIGHT);
        if (rowIdx >= 0 && rowIdx < items.length) {
            const item = items[rowIdx];
            if (item.type === 'bar' && item.id !== depDragSource.id && item.startDate && item.endDate) {
                return item.id;
            }
        }
        return null;
    }, [depDragSource, depDragPos, items, ROW_HEIGHT]);

    const hasAnyBars = items.some(i => i.type === 'bar' && i.startDate && i.endDate);

    return (
        <DndContext onDragEnd={handleDragEnd} onDragMove={handleDragMove}>
            <div
                ref={ref}
                className="flex-1 overflow-auto relative"
                style={{scrollBehavior: 'auto', background: 'var(--surface)'}}
                onScroll={onScroll}
            >
                <div
                    ref={containerRef}
                    style={{width: totalWidth, height: Math.max(totalHeight, 200), minWidth: '100%'}}
                    className="relative"
                    onMouseDown={(e) => {
                        handleMouseDown(e);
                        // Ensure the gantt root has focus for keyboard navigation
                        const root = e.currentTarget.closest('[role="application"]');
                        if (root && document.activeElement !== root && !root.contains(e.target.closest('button, input, select, textarea'))) {
                            requestAnimationFrame(() => root.focus());
                        }
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {/* Vertical grid lines */}
                    {gridLines.map(line => (
                        <div
                            key={line.key}
                            className="absolute top-0 pointer-events-none"
                            style={{
                                left: line.x,
                                height: Math.max(totalHeight, 200),
                                width: line.isWeekend ? pxPerDay : undefined,
                                background: line.isWeekend ? 'rgba(0,0,0,0.02)' : undefined,
                                borderLeft: line.isWeekend ? undefined : '1px solid rgba(0,0,0,0.06)',
                            }}
                        />
                    ))}

                    {/* Row stripes */}
                    {items.map((item, idx) => {
                        const rowTop = idx * ROW_HEIGHT;
                        const levelStyle = LEVEL_COLORS[Math.min(item.level ?? 0, 3)];
                        const isSelected = item.id === selectedRowId;
                        const isDateless = item.type === 'bar' && (!item.startDate || !item.endDate);
                        const bg = isSelected ? 'rgba(45,127,249,0.08)' : levelStyle.bg;
                        return (
                            <div
                                key={`bg-${item.id}`}
                                className={`absolute left-0 ${
                                    isDateless && canEdit ? 'cursor-crosshair' : ''
                                }`}
                                style={{
                                    top: rowTop,
                                    height: ROW_HEIGHT,
                                    minWidth: '100%',
                                    background: bg || undefined,
                                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                                    borderTop: item.level === 0 ? '1px solid rgba(0,0,0,0.08)' : undefined,
                                }}
                            >
                                {isDateless && canEdit && (
                                    <div className="h-full flex items-center px-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                        <span className="text-xs text-gray-gray300 italic">
                                            Drag to set dates
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Today line */}
                    {todayPos !== null && (
                        <div
                            className="absolute top-0 z-20 pointer-events-none"
                            style={{left: todayPos, height: totalHeight}}
                        >
                            <div className="h-full" style={{width: 2, backgroundColor: '#2D7FF9'}} />
                            <div
                                className="absolute top-0 -translate-x-1/2"
                                style={{
                                    left: 1,
                                    width: 0,
                                    height: 0,
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderTop: '6px solid #2D7FF9',
                                }}
                            />
                        </div>
                    )}

                    {/* Milestone vertical lines */}
                    {items.map((item) => {
                        if (item.type !== 'bar' || !item.isMilestone || !item.startDate) return null;
                        const x = dd(timelineStart, item.startDate) * pxPerDay;
                        return (
                            <div
                                key={`ml-${item.id}`}
                                className="absolute top-0 pointer-events-none z-0"
                                style={{
                                    left: x,
                                    height: totalHeight,
                                    borderLeft: '1px solid',
                                    borderColor: 'rgba(234, 179, 8, 0.3)',
                                }}
                            />
                        );
                    })}

                    {/* Summary rollup bars for group rows */}
                    {items.map((item, idx) => {
                        if (item.type !== 'group' || !item.rollupStartDate || !item.rollupEndDate) return null;
                        const summaryLeft = dd(timelineStart, item.rollupStartDate) * pxPerDay;
                        const summaryWidth = Math.max(dd(item.rollupStartDate, item.rollupEndDate) * pxPerDay, 4);
                        const summaryTop = idx * ROW_HEIGHT;
                        const barHeight = 4;
                        const barY = summaryTop + (ROW_HEIGHT - barHeight) / 2;
                        const bgColor = '#c8cacd';
                        const capSize = 3;

                        return (
                            <div key={`summary-${item.id}`} className="absolute pointer-events-none" style={{left: summaryLeft, top: barY, width: summaryWidth, height: barHeight, zIndex: 5}}>
                                {/* Bar background */}
                                <div className="absolute inset-0 rounded-sm" style={{backgroundColor: bgColor}} />
                                {/* Left end cap (downward triangle) */}
                                <div className="absolute" style={{left: -1, top: barHeight, width: 0, height: 0, borderLeft: `${capSize}px solid transparent`, borderRight: `${capSize}px solid transparent`, borderTop: `${capSize}px solid ${bgColor}`}} />
                                {/* Right end cap (downward triangle) */}
                                <div className="absolute" style={{right: -1, top: barHeight, width: 0, height: 0, borderLeft: `${capSize}px solid transparent`, borderRight: `${capSize}px solid transparent`, borderTop: `${capSize}px solid ${bgColor}`}} />
                            </div>
                        );
                    })}

                    {/* Bars and milestones */}
                    {items.map((item, idx) => {
                        if (item.type !== 'bar' || !item.startDate || !item.endDate) return null;

                        const left = dd(timelineStart, item.startDate) * pxPerDay;
                        const width = dd(item.startDate, item.endDate) * pxPerDay;
                        const top = idx * ROW_HEIGHT;
                        const isCritical = criticalSet.has(item.id);

                        if (item.isMilestone) {
                            return (
                                <MilestoneMarker
                                    key={item.id}
                                    left={left}
                                    top={top}
                                    isCritical={isCritical}
                                    name={item.name}
                                    rowHeight={ROW_HEIGHT}
                                />
                            );
                        }

                        return (
                            <GanttBar
                                key={item.id}
                                item={item}
                                left={left}
                                width={width}
                                top={top}
                                isCritical={isCritical}
                                canEdit={canEdit}
                                onHover={setHoveredBarId}
                                onDepDragStart={handleDepDragStart}
                                onDoubleClick={onBarDoubleClick}
                                onContextMenu={handleBarContextMenu}
                                rowHeight={ROW_HEIGHT}
                                isDepDropTarget={depDropTargetId === item.id}
                                compact={ROW_HEIGHT <= 28}
                                pxPerDay={pxPerDay}
                            />
                        );
                    })}

                    {/* Click-drag create preview */}
                    {dragCreate && Math.abs(dragCreate.endDay - dragCreate.startDay) >= 1 && (
                        <div
                            className="absolute rounded-md z-20 pointer-events-none"
                            style={{
                                left: Math.min(dragCreate.startDay, dragCreate.endDay) * pxPerDay,
                                top: dragCreate.rowIdx * ROW_HEIGHT + 6,
                                width: Math.abs(dragCreate.endDay - dragCreate.startDay) * pxPerDay,
                                height: ROW_HEIGHT - 12,
                                border: '2px dashed rgba(22,110,225,0.6)',
                                background: 'rgba(22,110,225,0.08)',
                            }}
                        />
                    )}

                    {/* Dependency drag ghost line */}
                    {depDragSource && depDragPos && (() => {
                        const srcIdx = items.findIndex(i => i.id === depDragSource.id);
                        if (srcIdx < 0 || !depDragSource.startDate || !depDragSource.endDate) return null;
                        const pos = {
                            right: dd(timelineStart, depDragSource.endDate) * pxPerDay,
                            y: srcIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
                        };
                        return (
                            <svg
                                className="absolute top-0 left-0 pointer-events-none z-40"
                                width={totalWidth}
                                height={Math.max(totalHeight, 200)}
                            >
                                <line
                                    x1={pos.right}
                                    y1={pos.y}
                                    x2={depDragPos.x}
                                    y2={depDragPos.y}
                                    stroke="#166EE1"
                                    strokeWidth="2"
                                    strokeDasharray="4 3"
                                />
                                <circle
                                    cx={depDragPos.x}
                                    cy={depDragPos.y}
                                    r="4"
                                    fill="#166EE1"
                                />
                            </svg>
                        );
                    })()}

                    {/* Dependency arrows */}
                    {showDependencies && (
                        <DependencyLines
                            items={items}
                            timelineStart={timelineStart}
                            pxPerDay={pxPerDay}
                            dayDiff={dd}
                            totalHeight={totalHeight}
                            totalWidth={totalWidth}
                            criticalSet={criticalSet}
                            hoveredBarId={hoveredBarId}
                            rowHeight={ROW_HEIGHT}
                            onArrowClick={handleArrowClick}
                        />
                    )}

                    {/* Scroll arrows for off-screen records */}
                    <ScrollArrows
                        items={items}
                        timelineStart={timelineStart}
                        pxPerDay={pxPerDay}
                        dayDiff={dd}
                        scrollRef={ref}
                        containerWidth={totalWidth}
                        rowHeight={ROW_HEIGHT}
                    />

                    {/* Empty state hint */}
                    {!hasAnyBars && items.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div style={{textAlign: 'center', padding: '16px 24px', background: 'rgba(255,255,255,0.9)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)'}}>
                                <p style={{fontSize: 13, color: 'var(--text-tertiary)'}}>
                                    {canEdit
                                        ? 'Click on a subtask row to assign dates, or map date fields in settings.'
                                        : <>Map the <span style={{fontWeight: 500, color: 'var(--text-secondary)'}}>Start date</span> and <span style={{fontWeight: 500, color: 'var(--text-secondary)'}}>End date</span> fields in settings.</>
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Dependency metadata popup */}
                {depPopup && (
                    <DepMetadataPopup
                        predName={depPopup.predName}
                        succName={depPopup.succName}
                        position={{x: depPopup.x, y: depPopup.y}}
                        canEdit={canEdit}
                        onClose={() => setDepPopup(null)}
                        onDelete={() => {
                            const succItem = items.find(i => i.id === depPopup.succId);
                            if (succItem && succItem.record && config.subtaskPredecessor) {
                                try {
                                    const existingPreds = succItem.record.getCellValue(config.subtaskPredecessor) || [];
                                    const updated = existingPreds.filter(p => p.id !== depPopup.predId);
                                    succItem.table.updateRecordAsync(succItem.record, {
                                        [config.subtaskPredecessor.id]: updated,
                                    });
                                } catch { /* */ }
                            }
                            setDepPopup(null);
                        }}
                    />
                )}

                {/* Bar context menu */}
                {barContextMenu && (
                    <div
                        className="context-menu fixed z-50"
                        style={{left: barContextMenu.x, top: barContextMenu.y}}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {barContextMenu.item.record && (
                            <button
                                className="context-menu-item"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    try { expandRecord(barContextMenu.item.record); } catch { /* */ }
                                    setBarContextMenu(null);
                                }}
                            >
                                <span>Open record</span>
                                <span style={{fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 16}}>Space</span>
                            </button>
                        )}
                        <div className="context-menu-separator" />
                        {canEdit && barContextMenu.item.record && (barContextMenu.item.startDate || barContextMenu.item.endDate) && (
                            <button
                                className="context-menu-item"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const menuItem = barContextMenu.item;
                                    try {
                                        const fields = {};
                                        if (config.subtaskStartDate) fields[config.subtaskStartDate.id] = null;
                                        if (config.subtaskEndDate) fields[config.subtaskEndDate.id] = null;
                                        menuItem.table.updateRecordAsync(menuItem.record, fields);
                                    } catch { /* */ }
                                    setBarContextMenu(null);
                                }}
                            >
                                Remove dates
                            </button>
                        )}
                        {barContextMenu.item.predecessorIds && barContextMenu.item.predecessorIds.length > 0 && (
                            <>
                                <div className="context-menu-separator" />
                                <div style={{padding: '6px 12px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                                    Dependencies
                                </div>
                                {barContextMenu.item.predecessorIds.map(predId => {
                                    const predItem = items.find(i => i.id === predId);
                                    return predItem ? (
                                        <div key={predId} style={{padding: '4px 12px', fontSize: 12, color: 'var(--text-secondary)'}} className="truncate">
                                            {predItem.name}
                                        </div>
                                    ) : null;
                                })}
                            </>
                        )}
                    </div>
                )}
            </div>
        </DndContext>
    );
});

export default TimelineGrid;
