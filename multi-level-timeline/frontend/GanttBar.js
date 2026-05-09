import {useCallback, useMemo} from 'react';
import {useDraggable} from '@dnd-kit/core';
import BarTooltip from './BarTooltip';
import {addDays} from './dateUtils';
import {MIN_BAR_WIDTH, ROW_HEIGHT as DEFAULT_ROW_HEIGHT} from './constants';

const BAR_HEIGHT = 28;
const BAR_HEIGHT_COMPACT = 26;
const DEP_HANDLE_SIZE = 8;
const DEP_HANDLE_HOVER_SIZE = 12;

const DEFAULT_BAR_COLORS = {
    2: {bar: '#2d7ff9', fill: '#1a6be0'},
    3: {bar: '#74aafc', fill: '#5b99f5'},
};

// Airtable select color names → bar fill colors
// Light2 variants map to their lighter bar shade, Dark1 to a rich saturated shade
const AIRTABLE_BAR_COLORS = {
    blueLight2:    {bar: '#D1E2FF', fill: '#A0C6FF', text: '#1A3F6B'},
    cyanLight2:    {bar: '#C4ECFF', fill: '#88DBFF', text: '#0A4D6B'},
    tealLight2:    {bar: '#C1F5F0', fill: '#74EBE1', text: '#0A5C56'},
    greenLight2:   {bar: '#CFF5C9', fill: '#9AE095', text: '#1B5A1B'},
    yellowLight2:  {bar: '#FFEAB6', fill: '#FFD66B', text: '#6B4704'},
    orangeLight2:  {bar: '#FEE2D5', fill: '#FFB68E', text: '#7A3204'},
    redLight2:     {bar: '#FFDCE5', fill: '#FFA6BE', text: '#7A1230'},
    pinkLight2:    {bar: '#FFDAF6', fill: '#F09BE8', text: '#6B1158'},
    purpleLight2:  {bar: '#EDE2FE', fill: '#BFAEF2', text: '#4A1578'},
    grayLight2:    {bar: '#E5E5E5', fill: '#C4C4C4', text: '#444444'},
    blueDark1:     {bar: '#2D7FF9', fill: '#1A6BE0', text: '#FFFFFF'},
    cyanDark1:     {bar: '#18BFFF', fill: '#0FA5DE', text: '#FFFFFF'},
    tealDark1:     {bar: '#20D9D2', fill: '#17B2AC', text: '#FFFFFF'},
    greenDark1:    {bar: '#20C933', fill: '#169B25', text: '#FFFFFF'},
    yellowDark1:   {bar: '#FCB400', fill: '#D99B00', text: '#FFFFFF'},
    orangeDark1:   {bar: '#FF6F2C', fill: '#E05A1B', text: '#FFFFFF'},
    redDark1:      {bar: '#F82B60', fill: '#D41E50', text: '#FFFFFF'},
    pinkDark1:     {bar: '#FF08C2', fill: '#D406A0', text: '#FFFFFF'},
    purpleDark1:   {bar: '#8B46FF', fill: '#7034D4', text: '#FFFFFF'},
    grayDark1:     {bar: '#666666', fill: '#4D4D4D', text: '#FFFFFF'},
};

function formatDragDate(date) {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

export default function GanttBar({item, left, width, top, isCritical, canEdit, onHover, onDepDragStart, onDoubleClick, onContextMenu, rowHeight, isDepDropTarget, compact, pxPerDay}) {
    const ROW_HEIGHT = rowHeight || DEFAULT_ROW_HEIGHT;
    const barHeight = compact ? BAR_HEIGHT_COMPACT : BAR_HEIGHT;
    const BAR_Y_OFFSET = Math.floor((ROW_HEIGHT - barHeight) / 2);
    const colors = (item.colorName && AIRTABLE_BAR_COLORS[item.colorName])
        || DEFAULT_BAR_COLORS[Math.min(item.level, 3)]
        || DEFAULT_BAR_COLORS[2];
    const barWidth = Math.max(width, MIN_BAR_WIDTH);

    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
        id: `bar-${item.id}`,
        data: {item, type: 'move'},
        disabled: !canEdit,
    });

    const {attributes: resizeEndAttrs, listeners: resizeEndListeners, setNodeRef: setResizeEndRef, transform: resizeEndTransform} = useDraggable({
        id: `resize-${item.id}`,
        data: {item, type: 'resize'},
        disabled: !canEdit,
    });

    const {attributes: resizeStartAttrs, listeners: resizeStartListeners, setNodeRef: setResizeStartRef, transform: resizeStartTransform} = useDraggable({
        id: `resize-start-${item.id}`,
        data: {item, type: 'resize-start'},
        disabled: !canEdit,
    });

    const dragOffset = transform ? transform.x : 0;
    const resizeEndOffset = resizeEndTransform ? resizeEndTransform.x : 0;
    const resizeStartOffset = resizeStartTransform ? resizeStartTransform.x : 0;

    const finalLeft = left + dragOffset + (isDragging ? 0 : resizeStartOffset);
    const finalWidth = barWidth + (isDragging ? 0 : resizeEndOffset - resizeStartOffset);

    // Compute preview dates during drag/resize
    const isResizingEnd = resizeEndOffset !== 0;
    const isResizingStart = resizeStartOffset !== 0;
    const isAnyDrag = isDragging || isResizingEnd || isResizingStart;

    const dragDates = useMemo(() => {
        if (!isAnyDrag || !item.startDate || !item.endDate || !pxPerDay) return null;
        if (isDragging) {
            const daysDelta = Math.round(dragOffset / pxPerDay);
            return {
                start: addDays(item.startDate, daysDelta),
                end: addDays(item.endDate, daysDelta),
            };
        }
        if (isResizingEnd) {
            const daysDelta = Math.round(resizeEndOffset / pxPerDay);
            return {
                start: item.startDate,
                end: addDays(item.endDate, daysDelta),
            };
        }
        if (isResizingStart) {
            const daysDelta = Math.round(resizeStartOffset / pxPerDay);
            return {
                start: addDays(item.startDate, daysDelta),
                end: item.endDate,
            };
        }
        return null;
    }, [isAnyDrag, isDragging, isResizingEnd, isResizingStart, dragOffset, resizeEndOffset, resizeStartOffset, pxPerDay, item.startDate, item.endDate]);

    const handleMouseEnter = useCallback(() => {
        if (onHover) onHover(item.id);
    }, [item.id, onHover]);

    const handleMouseLeave = useCallback(() => {
        if (onHover) onHover(null);
    }, [onHover]);

    const handleDepMouseDown = useCallback((e) => {
        e.stopPropagation();
        if (onDepDragStart) onDepDragStart(item);
    }, [item, onDepDragStart]);

    const handleDoubleClick = useCallback((e) => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick(item);
    }, [item, onDoubleClick]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) onContextMenu(e, item);
    }, [item, onContextMenu]);

    return (
        <BarTooltip item={item}>
            {/* Ghost bar at original position during drag */}
            {isDragging && (
                <div
                    className="absolute z-5"
                    style={{
                        left,
                        top: top + BAR_Y_OFFSET,
                        width: barWidth,
                        height: barHeight,
                        borderRadius: '4px',
                        border: '1px dashed rgba(0,0,0,0.12)',
                        opacity: 0.4,
                    }}
                />
            )}
            <div
                ref={setNodeRef}
                className={`gantt-bar absolute flex items-center overflow-hidden group ${
                    canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                } ${
                    isCritical ? 'ring-critical' : ''
                } ${isDragging ? 'opacity-70 z-20' : 'z-10'}`}
                style={{
                    left: finalLeft,
                    top: top + BAR_Y_OFFSET,
                    width: Math.max(finalWidth, MIN_BAR_WIDTH),
                    height: barHeight,
                    background: colors.bar,
                    borderRadius: '4px',
                    boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,0.15)' : undefined,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                {...attributes}
                {...listeners}
            >
                {/* Label */}
                {finalWidth > 40 && (
                    <span
                        className="relative z-10 px-1.5 overflow-hidden whitespace-nowrap pointer-events-none"
                        style={{
                            fontSize: '13px',
                            fontWeight: 400,
                            letterSpacing: '0.01em',
                            color: colors.text || '#FFFFFF',
                        }}
                    >
                        {item.name}
                    </span>
                )}
                {/* Left resize handle */}
                {canEdit && (
                    <div
                        ref={setResizeStartRef}
                        className="absolute left-0 top-0 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{width: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px 0 0 4px'}}
                        {...resizeStartAttrs}
                        {...resizeStartListeners}
                    />
                )}
                {/* Right resize handle */}
                {canEdit && (
                    <div
                        ref={setResizeEndRef}
                        className="absolute right-0 top-0 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{width: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '0 4px 4px 0'}}
                        {...resizeEndAttrs}
                        {...resizeEndListeners}
                    />
                )}
                {/* Dependency drag handle (blue circle at bottom-right) */}
                {canEdit && barWidth > 20 && (
                    <div
                        className="absolute opacity-0 group-hover:opacity-100 transition-all cursor-crosshair z-20"
                        style={{
                            right: -DEP_HANDLE_SIZE / 2,
                            bottom: -DEP_HANDLE_SIZE / 2,
                            width: DEP_HANDLE_SIZE,
                            height: DEP_HANDLE_SIZE,
                            borderRadius: '50%',
                            background: '#166EE1',
                            border: '1.5px solid white',
                            transition: 'width 150ms cubic-bezier(0.2, 0.1, 0.2, 1), height 150ms cubic-bezier(0.2, 0.1, 0.2, 1)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.width = `${DEP_HANDLE_HOVER_SIZE}px`;
                            e.currentTarget.style.height = `${DEP_HANDLE_HOVER_SIZE}px`;
                            e.currentTarget.style.right = `-${DEP_HANDLE_HOVER_SIZE / 2}px`;
                            e.currentTarget.style.bottom = `-${DEP_HANDLE_HOVER_SIZE / 2}px`;
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,127,249,0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.width = `${DEP_HANDLE_SIZE}px`;
                            e.currentTarget.style.height = `${DEP_HANDLE_SIZE}px`;
                            e.currentTarget.style.right = `-${DEP_HANDLE_SIZE / 2}px`;
                            e.currentTarget.style.bottom = `-${DEP_HANDLE_SIZE / 2}px`;
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                        onMouseDown={handleDepMouseDown}
                    />
                )}
                {/* Dependency drop target indicator */}
                {isDepDropTarget && (
                    <div
                        style={{
                            position: 'absolute',
                            left: -6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#2D7FF9',
                            border: '2px solid white',
                            zIndex: 30,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </div>
            {/* Drag date labels — rendered outside the overflow-hidden bar */}
            {dragDates && (
                <>
                    <div
                        className="absolute pointer-events-none z-30"
                        style={{
                            left: finalLeft,
                            top: top + BAR_Y_OFFSET - 20,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            background: 'var(--surface)',
                            padding: '2px 5px',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.12)',
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {formatDragDate(dragDates.start)}
                        </span>
                    </div>
                    <div
                        className="absolute pointer-events-none z-30"
                        style={{
                            left: finalLeft + Math.max(finalWidth, MIN_BAR_WIDTH),
                            top: top + BAR_Y_OFFSET - 20,
                            whiteSpace: 'nowrap',
                            transform: 'translateX(-100%)',
                        }}
                    >
                        <span style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            background: 'var(--surface)',
                            padding: '2px 5px',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.12)',
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {formatDragDate(dragDates.end)}
                        </span>
                    </div>
                </>
            )}
        </BarTooltip>
    );
}
