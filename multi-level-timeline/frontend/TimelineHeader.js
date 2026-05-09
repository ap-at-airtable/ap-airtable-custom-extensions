import {forwardRef, useMemo} from 'react';
import {diffDays, addDays, getWeekStart, getMonthStart, getMonthEnd, today as getToday} from './dateUtils';
import {HEADER_HEIGHT} from './constants';

// Two-row layout for most views; three-row only for day view
const PRIMARY_HEIGHT = 24;
const TERTIARY_HEIGHT = 18;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TimelineHeader = forwardRef(function TimelineHeader({timelineStart, timelineEnd, pxPerDay, timeScale, headerHeight, dayDiff: dayDiffProp}, ref) {
    const HEIGHT = headerHeight || HEADER_HEIGHT;
    const dd = dayDiffProp || diffDays;
    const totalDays = dd(timelineStart, timelineEnd);
    const totalWidth = Math.max(totalDays * pxPerDay, 100);

    const columns = useMemo(() => {
        if (!timelineStart || !timelineEnd) return {primary: [], secondary: [], tertiary: []};

        const primary = [];
        const secondary = [];
        const tertiary = [];

        if (timeScale === 'day') {
            // Primary: "Month Year" (sticky), Secondary: day-of-week abbrev, Tertiary: day number
            let monthStart = getMonthStart(timelineStart);
            while (monthStart <= timelineEnd) {
                const monthEnd = getMonthEnd(monthStart);
                const start = monthStart < timelineStart ? timelineStart : monthStart;
                const end = monthEnd > timelineEnd ? timelineEnd : monthEnd;
                const left = dd(timelineStart, start) * pxPerDay;
                const width = (dd(start, end) + 1) * pxPerDay;
                const label = `${MONTHS_FULL[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
                primary.push({key: `p-${monthStart.getTime()}`, label, left, width});
                monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
            }
            const hideWknd = dd !== diffDays;
            const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            let current = new Date(timelineStart);
            while (current <= timelineEnd) {
                const isWeekend = current.getDay() === 0 || current.getDay() === 6;
                if (hideWknd && isWeekend) {
                    current = addDays(current, 1);
                    continue;
                }
                const left = dd(timelineStart, current) * pxPerDay;
                secondary.push({key: `s-${current.getTime()}`, label: dayNames[current.getDay()], left, width: pxPerDay, isWeekend: false});
                tertiary.push({key: `t-${current.getTime()}`, label: String(current.getDate()), left, width: pxPerDay, isWeekend: false});
                current = addDays(current, 1);
            }
        } else if (timeScale === 'week') {
            // Primary: "Month Year", Secondary: week start dates (no tertiary)
            let monthStart = getMonthStart(timelineStart);
            while (monthStart <= timelineEnd) {
                const monthEnd = getMonthEnd(monthStart);
                const start = monthStart < timelineStart ? timelineStart : monthStart;
                const end = monthEnd > timelineEnd ? timelineEnd : monthEnd;
                const left = dd(timelineStart, start) * pxPerDay;
                const width = (dd(start, end) + 1) * pxPerDay;
                const label = width > 60
                    ? `${MONTHS_FULL[monthStart.getMonth()]} ${monthStart.getFullYear()}`
                    : `${MONTHS_SHORT[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
                primary.push({key: `p-${monthStart.getTime()}`, label, left, width});
                monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
            }
            // Secondary: week start dates
            let weekStart = getWeekStart(timelineStart);
            while (weekStart <= timelineEnd) {
                const clampedStart = weekStart < timelineStart ? timelineStart : weekStart;
                const left = dd(timelineStart, clampedStart) * pxPerDay;
                const width = 7 * pxPerDay;
                const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
                secondary.push({key: `s-${weekStart.getTime()}`, label, left, width});
                weekStart = addDays(weekStart, 7);
            }
        } else if (timeScale === 'quarter') {
            // Primary: "Q1 2026", Secondary: months (no tertiary)
            let year = timelineStart.getFullYear();
            while (year <= timelineEnd.getFullYear() + 1) {
                for (let q = 0; q < 4; q++) {
                    const qStart = new Date(year, q * 3, 1);
                    const qEnd = new Date(year, q * 3 + 3, 0);
                    if (qEnd < timelineStart) continue;
                    if (qStart > timelineEnd) break;
                    const start = qStart < timelineStart ? timelineStart : qStart;
                    const end = qEnd > timelineEnd ? timelineEnd : qEnd;
                    const left = dd(timelineStart, start) * pxPerDay;
                    const width = (dd(start, end) + 1) * pxPerDay;
                    primary.push({key: `p-${year}-q${q}`, label: `Q${q + 1} ${year}`, left, width});
                }
                year++;
            }
            // Secondary: months
            let monthStart = getMonthStart(timelineStart);
            while (monthStart <= timelineEnd) {
                const monthEnd = getMonthEnd(monthStart);
                const start = monthStart < timelineStart ? timelineStart : monthStart;
                const end = monthEnd > timelineEnd ? timelineEnd : monthEnd;
                const left = dd(timelineStart, start) * pxPerDay;
                const width = (dd(start, end) + 1) * pxPerDay;
                secondary.push({key: `s-${monthStart.getTime()}`, label: MONTHS_SHORT[monthStart.getMonth()], left, width});
                monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
            }
        } else {
            // Month scale: Primary: "Year", Secondary: month abbrev (no tertiary)
            let year = timelineStart.getFullYear();
            while (year <= timelineEnd.getFullYear()) {
                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31);
                const start = yearStart < timelineStart ? timelineStart : yearStart;
                const end = yearEnd > timelineEnd ? timelineEnd : yearEnd;
                const left = dd(timelineStart, start) * pxPerDay;
                const width = (dd(start, end) + 1) * pxPerDay;
                primary.push({key: `p-${year}`, label: String(year), left, width});
                year++;
            }
            let monthStart = getMonthStart(timelineStart);
            while (monthStart <= timelineEnd) {
                const monthEnd = getMonthEnd(monthStart);
                const start = monthStart < timelineStart ? timelineStart : monthStart;
                const end = monthEnd > timelineEnd ? timelineEnd : monthEnd;
                const left = dd(timelineStart, start) * pxPerDay;
                const width = (dd(start, end) + 1) * pxPerDay;
                const label = width < 20 ? MONTHS_SHORT[monthStart.getMonth()].charAt(0) : MONTHS_SHORT[monthStart.getMonth()];
                secondary.push({key: `s-${monthStart.getTime()}`, label, left, width});
                monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
            }
        }

        return {primary, secondary, tertiary};
    }, [timelineStart, timelineEnd, pxPerDay, timeScale, dd]);

    const todayPos = useMemo(() => {
        const t = getToday();
        if (!timelineStart || !timelineEnd || t < timelineStart || t > timelineEnd) return null;
        return dd(timelineStart, t) * pxPerDay;
    }, [timelineStart, timelineEnd, pxPerDay, dd]);

    return (
        <div
            ref={ref}
            className="flex-shrink-0 bg-white hide-scrollbar overflow-hidden"
            style={{height: HEIGHT, borderBottom: '1px solid var(--border-subtle)'}}
        >
            <div style={{width: totalWidth, minWidth: '100%'}} className="relative h-full">
                {/* Primary axis — large time unit (sticky feel) */}
                <div className="absolute top-0 left-0 right-0" style={{height: PRIMARY_HEIGHT, borderBottom: '1px solid var(--border-subtle)'}}>
                    {columns.primary.map(col => (
                        <div
                            key={col.key}
                            className="absolute top-0 h-full flex items-end pb-1 px-2 overflow-hidden whitespace-nowrap"
                            style={{left: col.left, width: col.width}}
                        >
                            {col.width > 40 && (
                                <span style={{fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '-0.01em'}}>{col.label}</span>
                            )}
                        </div>
                    ))}
                </div>
                {/* Secondary axis */}
                <div className="absolute left-0 right-0" style={{top: PRIMARY_HEIGHT, height: columns.tertiary.length > 0 ? (HEIGHT - PRIMARY_HEIGHT - TERTIARY_HEIGHT) : (HEIGHT - PRIMARY_HEIGHT)}}>
                    {columns.secondary.map(col => (
                        <div
                            key={col.key}
                            className="absolute top-0 h-full flex items-center justify-center overflow-hidden whitespace-nowrap"
                            style={{left: col.left, width: col.width, borderRight: '1px solid rgba(0,0,0,0.08)', background: col.isWeekend ? 'rgba(0,0,0,0.015)' : undefined}}
                        >
                            {col.width > 14 && (
                                <span style={{fontSize: 11, color: 'var(--text-tertiary)'}}>{col.label}</span>
                            )}
                        </div>
                    ))}
                </div>
                {/* Tertiary axis — only for day view */}
                {columns.tertiary.length > 0 && (
                <div className="absolute left-0 right-0" style={{top: HEIGHT - TERTIARY_HEIGHT, height: TERTIARY_HEIGHT, borderTop: '1px solid var(--border-subtle)'}}>
                    {columns.tertiary.map(col => (
                        <div
                            key={col.key}
                            className="absolute top-0 h-full flex items-center justify-center overflow-hidden whitespace-nowrap"
                            style={{left: col.left, width: col.width, borderRight: '1px solid rgba(0,0,0,0.06)', background: col.isWeekend ? 'rgba(0,0,0,0.015)' : undefined}}
                        >
                            {col.width > 14 && (
                                <span style={{fontSize: 11, color: 'var(--text-tertiary)'}}>{col.label}</span>
                            )}
                        </div>
                    ))}
                </div>
                )}
                {/* Today marker */}
                {todayPos !== null && (
                    <div
                        className="absolute pointer-events-none z-10"
                        style={{left: todayPos - 2.5, bottom: 2}}
                    >
                        <div className="rounded-full" style={{width: 5, height: 5, background: '#2D7FF9'}} />
                    </div>
                )}
            </div>
        </div>
    );
});

export default TimelineHeader;
