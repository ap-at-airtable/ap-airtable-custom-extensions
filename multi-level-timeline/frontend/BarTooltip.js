import {useState, useCallback, useRef} from 'react';
import {diffDays} from './dateUtils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(date) {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function BarTooltip({item, children}) {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({x: 0, y: 0});
    const timeoutRef = useRef(null);

    const handleMouseEnter = useCallback((e) => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setVisible(true);
        }, 200);
        setPos({x: e.clientX, y: e.clientY});
    }, []);

    const handleMouseMove = useCallback((e) => {
        setPos({x: e.clientX, y: e.clientY});
    }, []);

    const handleMouseLeave = useCallback(() => {
        clearTimeout(timeoutRef.current);
        setVisible(false);
    }, []);

    if (!item.startDate || !item.endDate) return children;

    const duration = diffDays(item.startDate, item.endDate);
    const startStr = fmtDate(item.startDate);
    const endStr = fmtDate(item.endDate);

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="contents"
        >
            {children}
            {visible && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{left: pos.x + 12, top: pos.y - 60}}
                >
                    <div
                        className="bar-tooltip text-white rounded-[6px]"
                        style={{
                            backgroundColor: 'rgba(32, 35, 42, 0.95)',
                            padding: '6px 10px',
                            maxWidth: 240,
                            boxShadow: '0px 0px 1px rgba(0,0,0,0.24), 0px 0px 2px rgba(0,0,0,0.16), 0px 3px 4px rgba(0,0,0,0.06), 0px 6px 8px rgba(0,0,0,0.06), 0px 12px 16px rgba(0,0,0,0.08), 0px 18px 32px rgba(0,0,0,0.06)',
                        }}
                    >
                        <div className="mb-0.5 truncate" style={{fontSize: '13px', fontWeight: 500, color: '#fff', letterSpacing: '-0.01em'}}>{item.name}</div>
                        <div style={{fontSize: '12px', color: '#d0d5dd'}}>
                            {startStr} → {endStr}  {duration} day{duration !== 1 ? 's' : ''}
                        </div>
                        {item.assignee && (
                            <div style={{fontSize: '12px', color: '#d0d5dd'}}>
                                {item.assignee}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
