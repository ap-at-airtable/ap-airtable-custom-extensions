import {useState, useCallback, useRef, useEffect} from 'react';
import {Plus} from '@phosphor-icons/react';
import {ROW_HEIGHT as DEFAULT_ROW_HEIGHT, LEVEL_COLORS} from './constants';

export default function AddRow({item, onAdd, rowHeight, isSelected, onSelect, setSelectedRowId}) {
    const ROW_HEIGHT = rowHeight || DEFAULT_ROW_HEIGHT;
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const inputRef = useRef(null);
    const indent = item.level * 20 + 8;

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editing]);

    const handleClick = useCallback((e) => {
        if (setSelectedRowId) setSelectedRowId(item.id);
        if (onSelect) onSelect(item.id, e ? (e.metaKey || e.ctrlKey) : false);
        setEditing(true);
        setName('');
    }, [item.id, setSelectedRowId, onSelect]);

    const handleSubmit = useCallback(() => {
        const trimmed = name.trim();
        if (trimmed && onAdd) {
            onAdd(item, trimmed);
        }
        setEditing(false);
        setName('');
        // Restore focus to the gantt chart root so keyboard nav continues working
        requestAnimationFrame(() => {
            const root = document.querySelector('[role="application"]');
            if (root) root.focus();
        });
    }, [name, onAdd, item]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.stopPropagation(); // don't let GanttChart clear selection
            setEditing(false);
            setName('');
            requestAnimationFrame(() => {
                const root = document.querySelector('[role="application"]');
                if (root) root.focus();
            });
        }
    }, [handleSubmit]);

    const handleBlur = useCallback(() => {
        handleSubmit();
    }, [handleSubmit]);

    if (editing) {
        return (
            <div
                style={{height: ROW_HEIGHT, minWidth: '100%', background: 'var(--surface-active)'}}
                className="flex items-center"
                role="treeitem"
                aria-level={item.level + 1}
                aria-label="Entering name"
                data-row-id={item.id}
            >
                <div className="flex items-center flex-1 min-w-0" style={{paddingLeft: indent}}>
                    <span className="flex-shrink-0" style={{width: 20}} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        aria-label={item.addType === 'task' ? 'New task name' : 'New subtask name'}
                        placeholder={item.addType === 'task' ? 'Enter task name...' : 'Enter subtask name...'}
                        style={{
                            flex: 1,
                            height: 26,
                            borderRadius: 'var(--radius-md)',
                            padding: '4px 8px',
                            fontSize: 13,
                            color: 'var(--text-primary)',
                            background: 'var(--surface)',
                            border: 'none',
                            outline: 'none',
                            boxShadow: '0 0 0 2px var(--accent), var(--shadow-sm)',
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex items-center cursor-pointer group"
            style={{
                height: ROW_HEIGHT,
                minWidth: '100%',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                background: isSelected ? 'var(--surface-active)' : (LEVEL_COLORS[Math.min(item.level, 3)].bg || undefined),
            }}
            role="treeitem"
            aria-level={item.level + 1}
            aria-label={item.addType === 'task' ? 'Add task' : 'Add subtask'}
            aria-selected={isSelected || false}
            tabIndex={-1}
            data-row-id={item.id}
            onClick={handleClick}
        >
            <div
                className={`flex items-center flex-1 min-w-0 aero-transition ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{paddingLeft: indent}}
            >
                <Plus size={10} weight="bold" style={{color: 'var(--text-tertiary)', marginRight: 4, flexShrink: 0}} />
                <span style={{fontSize: 12, color: 'var(--text-tertiary)'}}>
                    {item.addType === 'task' ? 'Add task' : 'Add subtask'}
                </span>
            </div>
        </div>
    );
}
