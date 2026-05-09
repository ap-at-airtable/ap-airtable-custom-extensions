import {useMemo, useState, useCallback, useRef} from 'react';
import {diffDays} from './dateUtils';
import {ROW_HEIGHT as DEFAULT_ROW_HEIGHT, ROW_HEIGHT_COMPACT, BAR_HEIGHT as DEFAULT_BAR_HEIGHT, BAR_HEIGHT_COMPACT, MIN_BAR_WIDTH} from './constants';

const RADIUS = 3;
const HOVER_DELAY_MS = 50;
const HIT_STROKE_WIDTH = 8;

function getBarGeometry(item, idx, timelineStart, pxPerDay, ROW_HEIGHT, dd) {
    const left = dd(timelineStart, item.startDate) * pxPerDay;
    const width = Math.max(dd(item.startDate, item.endDate) * pxPerDay, MIN_BAR_WIDTH);
    const barHeight = ROW_HEIGHT <= ROW_HEIGHT_COMPACT ? BAR_HEIGHT_COMPACT : DEFAULT_BAR_HEIGHT;
    const barYOffset = Math.floor((ROW_HEIGHT - barHeight) / 2);
    const topY = idx * ROW_HEIGHT + barYOffset;
    const centerY = topY + barHeight / 2;
    const bottomY = topY + barHeight;
    return {left, right: left + width, centerY, topY, bottomY};
}

const INSET = 6;  // how far inward from bar edge the arrow departs
const GAP = 12;   // clearance for wrap-around routing

// L-path: vertical from (fromX, fromY) then horizontal to (toX, toY)
//     │
//     └──>
function buildLPath(fromX, fromY, toX, toY) {
    const r = RADIUS;
    if (Math.abs(fromY - toY) < r * 2) {
        return `M ${fromX} ${fromY} V ${toY} H ${toX}`;
    }
    const goingDown = toY > fromY;
    const goingRight = toX > fromX;
    // sweep: 0 = CCW, 1 = CW
    const sweep = (goingDown && goingRight) || (!goingDown && !goingRight) ? 0 : 1;
    const dx = goingRight ? r : -r;
    const dy = goingDown ? r : -r;
    return [
        `M ${fromX} ${fromY}`,
        `V ${toY - dy}`,
        `a ${r} ${r} 0 0 ${sweep} ${dx} ${dy}`,
        `H ${toX}`,
    ].join(' ');
}

// Z-path for backward deps: down, horizontal, down, horizontal
//     │
//  ┌──┘
//  │
//  └──>
function buildZPath(fromX, fromY, midX, midY, toX, toY) {
    const r = RADIUS;
    const d = toY > fromY; // going down
    const dy = d ? r : -r;

    const r1 = midX > fromX; // first horizontal direction
    const sweep1 = (d && r1) || (!d && !r1) ? 0 : 1;
    const dx1 = r1 ? r : -r;

    const r2 = toX > midX; // second horizontal direction
    const sweep2 = (d && !r2) || (!d && r2) ? 0 : 1;
    const dx2 = r2 ? r : -r;

    const sweep3 = (d && r2) || (!d && !r2) ? 0 : 1;

    return [
        `M ${fromX} ${fromY}`,
        `V ${midY - dy}`,
        `a ${r} ${r} 0 0 ${sweep1} ${dx1} ${dy}`,
        `H ${midX - dx2}`,
        `a ${r} ${r} 0 0 ${sweep2} ${dx2} ${dy}`,
        `V ${toY - dy}`,
        `a ${r} ${r} 0 0 ${sweep3} ${dx2} ${dy}`,
        `H ${toX}`,
    ].join(' ');
}

function buildFSPath(pred, succ) {
    // FS: depart bottom of pred, inset from right edge. Arrive at succ left edge, centerY.
    const fromX = pred.right - INSET;
    if (succ.left >= pred.right) {
        return buildLPath(fromX, pred.bottomY, succ.left, succ.centerY);
    }
    const midY = (pred.bottomY + succ.topY) / 2;
    const midX = succ.left - GAP;
    return buildZPath(fromX, pred.bottomY, midX, midY, succ.left, succ.centerY);
}

function buildSSPath(pred, succ) {
    // SS: depart bottom of pred, inset from left edge. Arrive at succ left edge, centerY.
    const fromX = pred.left + INSET;
    if (succ.left <= pred.left) {
        return buildLPath(fromX, pred.bottomY, succ.left, succ.centerY);
    }
    const midY = (pred.bottomY + succ.topY) / 2;
    const midX = Math.min(succ.left, fromX) - GAP;
    return buildZPath(fromX, pred.bottomY, midX, midY, succ.left, succ.centerY);
}

function buildFFPath(pred, succ) {
    // FF: depart bottom of pred, inset from right edge. Arrive at succ right edge, centerY.
    const fromX = pred.right - INSET;
    if (succ.right >= pred.right) {
        return buildLPath(fromX, pred.bottomY, succ.right, succ.centerY);
    }
    const midY = (pred.bottomY + succ.topY) / 2;
    const midX = Math.max(succ.right, fromX) + GAP;
    return buildZPath(fromX, pred.bottomY, midX, midY, succ.right, succ.centerY);
}

function buildSFPath(pred, succ) {
    // SF: depart bottom of pred, inset from left edge. Arrive at succ right edge, centerY.
    const fromX = pred.left + INSET;
    if (succ.right <= pred.left) {
        return buildLPath(fromX, pred.bottomY, succ.right, succ.centerY);
    }
    const midY = (pred.bottomY + succ.topY) / 2;
    const midX = Math.max(succ.right, fromX) + GAP;
    return buildZPath(fromX, pred.bottomY, midX, midY, succ.right, succ.centerY);
}

function detectCycles(items) {
    const barItems = items.filter(i => i.type === 'bar' && i.startDate && i.endDate);
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    const cycleEdges = new Set();

    for (const item of barItems) color.set(item.id, WHITE);

    function dfs(id) {
        color.set(id, GRAY);
        const item = barItems.find(i => i.id === id);
        if (!item) { color.set(id, BLACK); return; }
        const succs = barItems.filter(i => i.predecessorIds.includes(id));
        for (const succ of succs) {
            if (color.get(succ.id) === GRAY) {
                cycleEdges.add(`${id}-${succ.id}`);
            } else if (color.get(succ.id) === WHITE) {
                dfs(succ.id);
            }
        }
        color.set(id, BLACK);
    }

    for (const item of barItems) {
        if (color.get(item.id) === WHITE) dfs(item.id);
    }
    return cycleEdges;
}

export default function DependencyLines({items, timelineStart, pxPerDay, totalHeight, totalWidth, criticalSet, hoveredBarId, rowHeight, onArrowClick, dayDiff: dayDiffProp}) {
    const ROW_HEIGHT = rowHeight || DEFAULT_ROW_HEIGHT;
    const dd = dayDiffProp || diffDays;
    const [hoveredArrowKey, setHoveredArrowKey] = useState(null);
    const hoverTimerRef = useRef(null);

    const handleArrowEnter = useCallback((key) => {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHoveredArrowKey(key), HOVER_DELAY_MS);
    }, []);

    const handleArrowLeave = useCallback(() => {
        clearTimeout(hoverTimerRef.current);
        setHoveredArrowKey(null);
    }, []);

    const handleArrowClick = useCallback((line, e) => {
        if (onArrowClick) {
            onArrowClick({
                predId: line.predId,
                succId: line.succId,
                key: line.key,
                x: e.clientX,
                y: e.clientY,
            });
        }
    }, [onArrowClick]);

    const lines = useMemo(() => {
        const itemIndex = new Map();
        items.forEach((item, idx) => itemIndex.set(item.id, idx));

        const cycleEdges = detectCycles(items);

        const result = [];
        for (const item of items) {
            if (item.type !== 'bar' || !item.startDate || !item.endDate) continue;
            for (const predId of item.predecessorIds) {
                const predItem = items.find(i => i.id === predId);
                if (!predItem || !predItem.startDate || !predItem.endDate) continue;
                const predIdx = itemIndex.get(predId);
                const succIdx = itemIndex.get(item.id);
                if (predIdx === undefined || succIdx === undefined) continue;

                const pred = getBarGeometry(predItem, predIdx, timelineStart, pxPerDay, ROW_HEIGHT, dd);
                const succ = getBarGeometry(item, succIdx, timelineStart, pxPerDay, ROW_HEIGHT, dd);

                const depType = item.dependencyType || 'FS';
                let path;
                switch (depType) {
                    case 'SS': path = buildSSPath(pred, succ); break;
                    case 'FF': path = buildFFPath(pred, succ); break;
                    case 'SF': path = buildSFPath(pred, succ); break;
                    case 'FS':
                    default: path = buildFSPath(pred, succ); break;
                }

                const isCritical = criticalSet && criticalSet.has(predId) && criticalSet.has(item.id);
                const isCycle = cycleEdges.has(`${predId}-${item.id}`);
                result.push({
                    key: `${predId}-${item.id}`,
                    path, isCritical, isCycle,
                    predId, succId: item.id,
                });
            }
        }
        return result;
    }, [items, timelineStart, pxPerDay, criticalSet, ROW_HEIGHT, dd]);

    if (lines.length === 0) return null;

    // Sort: normal first, then highlighted (from hoveredBarId), then directly hovered arrow on top
    const sortedLines = [...lines].sort((a, b) => {
        const aHighlight = hoveredBarId && (a.predId === hoveredBarId || a.succId === hoveredBarId);
        const bHighlight = hoveredBarId && (b.predId === hoveredBarId || b.succId === hoveredBarId);
        const aHovered = a.key === hoveredArrowKey;
        const bHovered = b.key === hoveredArrowKey;
        const aWeight = aHovered ? 2 : aHighlight ? 1 : 0;
        const bWeight = bHovered ? 2 : bHighlight ? 1 : 0;
        return aWeight - bWeight;
    });

    return (
        <svg
            className="absolute top-0 left-0 z-30"
            width={totalWidth}
            height={totalHeight}
            style={{pointerEvents: 'none'}}
        >
            <defs>
                <marker id="arrow-default" markerWidth="5" markerHeight="6" refX="4" refY="3" orient="auto">
                    <polygon points="0 0, 5 3, 0 6" fill="#c0c0c0" />
                </marker>
                <marker id="arrow-critical" markerWidth="5" markerHeight="6" refX="4" refY="3" orient="auto">
                    <polygon points="0 0, 5 3, 0 6" fill="#ffc000" />
                </marker>
                <marker id="arrow-highlight" markerWidth="5" markerHeight="6" refX="4" refY="3" orient="auto">
                    <polygon points="0 0, 5 3, 0 6" fill="#888888" />
                </marker>
                <marker id="arrow-cycle" markerWidth="5" markerHeight="6" refX="4" refY="3" orient="auto">
                    <polygon points="0 0, 5 3, 0 6" fill="#dc043b" />
                </marker>
                <marker id="arrow-delete" markerWidth="5" markerHeight="6" refX="4" refY="3" orient="auto">
                    <polygon points="0 0, 5 3, 0 6" fill="#dc043b" />
                </marker>
            </defs>
            {sortedLines.map(line => {
                const isHighlighted = hoveredBarId && (line.predId === hoveredBarId || line.succId === hoveredBarId);
                const isArrowHovered = line.key === hoveredArrowKey;
                const isFaded = hoveredBarId && !isHighlighted && !line.isCritical && !line.isCycle;
                const color = line.isCycle ? '#dc043b'
                    : line.isCritical ? (isArrowHovered ? '#ffb300' : '#ffc000')
                    : (isHighlighted || isArrowHovered) ? '#888888'
                    : '#c0c0c0';
                const marker = line.isCycle ? 'url(#arrow-cycle)'
                    : line.isCritical ? 'url(#arrow-critical)'
                    : (isHighlighted || isArrowHovered) ? 'url(#arrow-highlight)'
                    : 'url(#arrow-default)';
                const strokeWidth = (isHighlighted || isArrowHovered) ? 1.25 : 0.75;
                return (
                    <g key={line.key}>
                        {/* Invisible wider hit target for clicking/hovering */}
                        <path
                            d={line.path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={HIT_STROKE_WIDTH}
                            style={{pointerEvents: 'stroke', cursor: 'pointer'}}
                            onMouseEnter={() => handleArrowEnter(line.key)}
                            onMouseLeave={handleArrowLeave}
                            onClick={(e) => handleArrowClick(line, e)}
                        />
                        {/* Visible arrow path */}
                        <path
                            d={line.path}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={line.isCycle ? '4 2' : undefined}
                            markerEnd={marker}
                            opacity={isFaded ? 0.3 : 1}
                            style={{pointerEvents: 'none', transition: 'stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease'}}
                        />
                    </g>
                );
            })}
        </svg>
    );
}
