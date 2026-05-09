import {useState, useCallback, useEffect, useRef} from 'react';
import {MagnifyingGlass, X, ArrowUp, ArrowDown} from '@phosphor-icons/react';

export default function SearchBar({items, onHighlight, onClose}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    useEffect(() => {
        if (!query.trim()) { setResults([]); onHighlight(null, new Set()); return; }
        const q = query.toLowerCase();
        const matches = items.filter(i => i.type !== 'add' && i.name && i.name.toLowerCase().includes(q));
        setResults(matches);
        setCursor(0);
        onHighlight(matches[0]?.id || null, new Set(matches.map(m => m.id)));
    }, [query, items, onHighlight]);

    const navigate = useCallback((dir) => {
        if (results.length === 0) return;
        const next = (cursor + dir + results.length) % results.length;
        setCursor(next);
        onHighlight(results[next]?.id || null, new Set(results.map(m => m.id)));
    }, [cursor, results, onHighlight]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') { e.preventDefault(); navigate(e.shiftKey ? -1 : 1); }
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }, [navigate, onClose]);

    return (
        <div className="flex items-center gap-1.5 px-2" style={{
            height: 36, background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)',
        }}>
            <MagnifyingGlass size={14} style={{color: 'var(--text-tertiary)', flexShrink: 0}} />
            <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Find..."
                style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, color: 'var(--text-primary)',
                }}
            />
            {results.length > 0 && (
                <span style={{fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap'}}>
                    {cursor + 1} / {results.length}
                </span>
            )}
            <button onClick={() => navigate(-1)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2}}>
                <ArrowUp size={12} />
            </button>
            <button onClick={() => navigate(1)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2}}>
                <ArrowDown size={12} />
            </button>
            <button onClick={onClose} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2}}>
                <X size={12} />
            </button>
        </div>
    );
}
