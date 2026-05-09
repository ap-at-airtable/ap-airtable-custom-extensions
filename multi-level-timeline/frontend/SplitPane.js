import {useCallback, useRef, useEffect} from 'react';
import {DEFAULT_LEFT_WIDTH, MIN_LEFT_WIDTH} from './constants';
import {useLocalStorage} from './useLocalStorage';

export default function SplitPane({left, right}) {
    const [leftWidth, setLeftWidth] = useLocalStorage('splitWidth', Math.max(DEFAULT_LEFT_WIDTH, Math.round(window.innerWidth / 3)));
    const dragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = leftWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [leftWidth]);

    useEffect(() => {
        function onMouseMove(e) {
            if (!dragging.current) return;
            const delta = e.clientX - startX.current;
            const newWidth = Math.min(
                Math.max(MIN_LEFT_WIDTH, startWidth.current + delta),
                window.innerWidth * 0.5,
            );
            setLeftWidth(newWidth);
        }
        function onMouseUp() {
            if (dragging.current) {
                dragging.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        }
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [setLeftWidth]);

    return (
        <div className="flex h-full overflow-hidden">
            <div style={{width: leftWidth, minWidth: MIN_LEFT_WIDTH}} className="flex-shrink-0 h-full overflow-hidden">
                {left}
            </div>
            <div
                className="split-divider flex-shrink-0 cursor-col-resize"
                style={{width: 5, background: 'var(--border-subtle)'}}
                onMouseDown={onMouseDown}
            />
            <div className="flex-1 h-full overflow-hidden">
                {right}
            </div>
        </div>
    );
}
