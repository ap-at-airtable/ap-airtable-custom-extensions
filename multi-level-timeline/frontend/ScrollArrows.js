import {useState, useEffect, useCallback, useMemo} from 'react';
import {CaretLeft, CaretRight} from '@phosphor-icons/react';
import {diffDays} from './dateUtils';
import {ROW_HEIGHT as DEFAULT_ROW_HEIGHT} from './constants';

export default function ScrollArrows({items, timelineStart, pxPerDay, scrollRef, containerWidth, rowHeight, dayDiff: dayDiffProp}) {
    const ROW_HEIGHT = rowHeight || DEFAULT_ROW_HEIGHT;
    const dd = dayDiffProp || diffDays;
    const [scrollLeft, setScrollLeft] = useState(0);

    useEffect(() => {
        const el = scrollRef?.current;
        if (!el) return;
        const handleScroll = () => setScrollLeft(el.scrollLeft);
        el.addEventListener('scroll', handleScroll, {passive: true});
        return () => el.removeEventListener('scroll', handleScroll);
    }, [scrollRef]);

    const barItems = useMemo(() =>
        items.map((item, idx) => {
            if (item.type !== 'bar' || !item.startDate || !item.endDate) return null;
            return {
                id: item.id,
                name: item.name,
                left: dd(timelineStart, item.startDate) * pxPerDay,
                right: dd(timelineStart, item.endDate) * pxPerDay,
                y: idx * ROW_HEIGHT,
            };
        }).filter(Boolean),
    [items, timelineStart, pxPerDay, ROW_HEIGHT, dd]);

    const viewLeft = scrollLeft;
    const viewRight = scrollLeft + (containerWidth || 600);

    // Find arrows per visible row range
    const arrows = useMemo(() => {
        const result = [];
        for (const bar of barItems) {
            if (bar.right < viewLeft - 20) {
                result.push({id: bar.id, side: 'left', y: bar.y, name: bar.name, scrollTo: bar.left - 50});
            } else if (bar.left > viewRight + 20) {
                result.push({id: bar.id, side: 'right', y: bar.y, name: bar.name, scrollTo: bar.left - 50});
            }
        }
        return result;
    }, [barItems, viewLeft, viewRight]);

    const handleClick = useCallback((scrollTo) => {
        const el = scrollRef?.current;
        if (!el) return;
        el.scrollTo({left: Math.max(0, scrollTo), behavior: 'smooth'});
    }, [scrollRef]);

    if (arrows.length === 0) return null;

    // Group by row — show at most one per side per row
    const leftArrows = [];
    const rightArrows = [];
    const seenLeftRows = new Set();
    const seenRightRows = new Set();
    for (const arrow of arrows) {
        const rowBucket = Math.floor(arrow.y / ROW_HEIGHT);
        if (arrow.side === 'left' && !seenLeftRows.has(rowBucket)) {
            seenLeftRows.add(rowBucket);
            leftArrows.push(arrow);
        } else if (arrow.side === 'right' && !seenRightRows.has(rowBucket)) {
            seenRightRows.add(rowBucket);
            rightArrows.push(arrow);
        }
    }

    return (
        <>
            {leftArrows.map(arrow => (
                <div
                    key={`la-${arrow.id}`}
                    className="absolute z-30 cursor-pointer flex items-center"
                    style={{left: scrollLeft + 4, top: arrow.y + 2, height: ROW_HEIGHT - 4}}
                    onClick={() => handleClick(arrow.scrollTo)}
                    title={arrow.name}
                >
                    <div
                        className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-white border border-black/[0.06]"
                        style={{boxShadow: '0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)'}}
                    >
                        <CaretLeft size={10} weight="bold" className="text-gray-gray500" />
                        <span className="text-[11px] text-gray-gray500 max-w-[50px] truncate">{arrow.name}</span>
                    </div>
                </div>
            ))}
            {rightArrows.map(arrow => (
                <div
                    key={`ra-${arrow.id}`}
                    className="absolute z-30 cursor-pointer flex items-center justify-end"
                    style={{left: viewRight - 80, top: arrow.y + 2, height: ROW_HEIGHT - 4, width: 76}}
                    onClick={() => handleClick(arrow.scrollTo)}
                    title={arrow.name}
                >
                    <div
                        className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-white border border-black/[0.06]"
                        style={{boxShadow: '0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)'}}
                    >
                        <span className="text-[11px] text-gray-gray500 max-w-[50px] truncate">{arrow.name}</span>
                        <CaretRight size={10} weight="bold" className="text-gray-gray500" />
                    </div>
                </div>
            ))}
        </>
    );
}
