import {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import {FieldType} from '@airtable/blocks/interface/models';
import {useBase, useRecords} from '@airtable/blocks/interface/ui';

// Airtable select color name -> {bg, text} for pill display
const SELECT_COLORS = {
    blueLight2:    {bg: '#D0F0FD', text: '#04618C'},
    cyanLight2:    {bg: '#C2F5E9', text: '#06665C'},
    tealLight2:    {bg: '#C2F5E9', text: '#06665C'},
    greenLight2:   {bg: '#D1F7C4', text: '#1B6B1F'},
    yellowLight2:  {bg: '#FFEAB6', text: '#885B04'},
    orangeLight2:  {bg: '#FEE2D5', text: '#B74504'},
    redLight2:     {bg: '#FFDCE5', text: '#B61D45'},
    pinkLight2:    {bg: '#FFDAF6', text: '#9B1B78'},
    purpleLight2:  {bg: '#EDE2FE', text: '#6B1FA8'},
    grayLight2:    {bg: '#EAEAEA', text: '#444444'},
    blueDark1:     {bg: '#2D7FF9', text: '#FFFFFF'},
    cyanDark1:     {bg: '#18BFFF', text: '#FFFFFF'},
    tealDark1:     {bg: '#20D9D2', text: '#FFFFFF'},
    greenDark1:    {bg: '#20C933', text: '#FFFFFF'},
    yellowDark1:   {bg: '#FCB400', text: '#FFFFFF'},
    orangeDark1:   {bg: '#FF6F2C', text: '#FFFFFF'},
    redDark1:      {bg: '#F82B60', text: '#FFFFFF'},
    pinkDark1:     {bg: '#FF08C2', text: '#FFFFFF'},
    purpleDark1:   {bg: '#8B46FF', text: '#FFFFFF'},
    grayDark1:     {bg: '#666666', text: '#FFFFFF'},
};

function getSelectColor(colorName) {
    if (!colorName) return {bg: '#EAEAEA', text: '#444444'};
    return SELECT_COLORS[colorName] || {bg: '#EAEAEA', text: '#444444'};
}

function formatCellValue(record, field) {
    if (!record || !field) return '';
    try {
        return record.getCellValueAsString(field) || '';
    } catch {
        return '';
    }
}

function parseInputValue(value, field) {
    if (!field || value === '') return null;
    switch (field.type) {
        case FieldType.NUMBER:
            return Number(value) || 0;
        case FieldType.PERCENT:
            return (Number(value) || 0) / 100;
        default:
            return value;
    }
}

function LinkedRecordCell({record, field, table, width}) {
    const base = useBase();
    const linkedTableId = field?.options?.linkedTableId;
    const linkedTable = linkedTableId ? base.getTableByIdIfExists(linkedTableId) : null;
    const allRecords = useRecords(linkedTable);

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const cellRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState(null);

    // Current linked records — extract dependency metadata from cell value
    const currentLinks = useMemo(() => {
        if (!record || !field) return [];
        try {
            const val = record.getCellValue(field);
            if (!val || !Array.isArray(val)) return [];
            // Also get the string representation — Airtable may format it as "F → S 0d Name"
            let asString = '';
            try { asString = record.getCellValueAsString(field) || ''; } catch { /* */ }
            return val.map(v => {
                // Try all known property names for dependency metadata
                const depType = v.dependencyType || v.dependency_type || v.depType || v.type || null;
                const lag = v.lagDays ?? v.lag ?? v.lagInDays ?? v.duration ?? null;
                // If no metadata on the object, try to parse from the string representation
                // Airtable formats as "F → S  0d  Record Name" or "F→S 0d Record Name"
                let parsedType = null;
                let parsedLag = null;
                if (!depType && asString) {
                    const pattern = new RegExp(`([FS])\\s*[→>]\\s*([FS])\\s+(-?\\d+)d\\s+${v.name?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
                    const m = asString.match(pattern);
                    if (m) {
                        parsedType = `${m[1]}S` === `${m[1]}${m[2]}` ? `${m[1]}${m[2]}` : `${m[1]}${m[2]}`;
                        parsedLag = parseInt(m[3], 10);
                    }
                }
                return {
                    id: v.id,
                    name: v.name || v.id,
                    dependencyType: depType || parsedType,
                    lagDays: lag ?? parsedLag,
                };
            });
        } catch {
            return [];
        }
    }, [record, field]);

    const currentIds = useMemo(() => new Set(currentLinks.map(l => l.id)), [currentLinks]);

    // All records for dropdown — linked ones first (checked), then available
    const dropdownItems = useMemo(() => {
        if (!allRecords) return [];
        const q = search.toLowerCase();
        // Exclude the record itself
        const selfId = record?.id;
        const linked = [];
        const available = [];
        for (const r of allRecords) {
            if (r.id === selfId) continue;
            if (q && !(r.name || '').toLowerCase().includes(q)) continue;
            if (currentIds.has(r.id)) {
                linked.push({id: r.id, name: r.name || 'Untitled', isLinked: true});
            } else {
                available.push({id: r.id, name: r.name || 'Untitled', isLinked: false});
            }
        }
        return [...linked, ...available].slice(0, 60);
    }, [allRecords, currentIds, search, record?.id]);

    // Position dropdown
    useEffect(() => {
        if (open && cellRef.current) {
            const rect = cellRef.current.getBoundingClientRect();
            const dropdownW = Math.max(rect.width, 240);
            const spaceBelow = window.innerHeight - rect.bottom;
            const above = spaceBelow < 200;
            setDropdownPos({
                left: rect.left,
                top: above ? undefined : rect.bottom + 2,
                bottom: above ? (window.innerHeight - rect.top + 2) : undefined,
                width: dropdownW,
            });
        }
        if (!open) setDropdownPos(null);
    }, [open]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    // Close on outside click or escape
    useEffect(() => {
        if (!open) return;
        const handleMouseDown = (e) => {
            if (cellRef.current?.contains(e.target)) return;
            if (dropdownRef.current?.contains(e.target)) return;
            setOpen(false);
            setSearch('');
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setSearch(''); }
        };
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('keydown', handleKey, true);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('keydown', handleKey, true);
        };
    }, [open]);

    const handleToggle = useCallback(async (toggleId, isCurrentlyLinked) => {
        if (!record || !field || !table) return;
        try {
            const existing = record.getCellValue(field) || [];
            const updated = isCurrentlyLinked
                ? existing.filter(v => v.id !== toggleId)
                : [...existing, {id: toggleId}];
            await table.updateRecordAsync(record, {[field.id]: updated});
        } catch { /* */ }
    }, [record, field, table]);

    // Display: Airtable-native dependency chips (muted gray with type + lag + name)
    return (
        <div
            ref={cellRef}
            className="flex items-center px-1.5 flex-shrink-0 overflow-hidden cursor-pointer hover:bg-black/[0.03] aero-transition"
            style={{width, userSelect: 'auto'}}
            onClick={(e) => { e.stopPropagation(); setOpen(true); setSearch(''); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {currentLinks.length === 0 && (
                <span className="text-[13px] text-gray-gray400 truncate">{'\u00A0'}</span>
            )}
            {currentLinks.length > 0 && (
                <div className="flex items-center gap-1 overflow-hidden w-full">
                    {currentLinks.map(link => {
                        const depType = link.dependencyType;
                        const lag = link.lagDays;
                        const hasDepInfo = depType || lag !== null;
                        const typeLabel = depType
                            ? `${depType[0]} → ${depType[1]}`
                            : null;
                        const lagLabel = lag !== null ? `${lag}d` : null;
                        return (
                            <span
                                key={link.id}
                                className="inline-flex items-center text-[12px] max-w-full flex-shrink-0"
                                style={{
                                    backgroundColor: 'rgba(0,0,0,0.04)',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    borderRadius: 4,
                                    lineHeight: '22px',
                                    height: 22,
                                }}
                            >
                                {hasDepInfo && typeLabel && (
                                    <span style={{
                                        padding: '0 6px',
                                        color: 'var(--text-secondary)',
                                        fontSize: 11,
                                        borderRight: '1px solid rgba(0,0,0,0.1)',
                                        flexShrink: 0,
                                    }}>{typeLabel}</span>
                                )}
                                {hasDepInfo && lagLabel && (
                                    <span style={{
                                        padding: '0 6px',
                                        color: 'var(--text-tertiary)',
                                        fontSize: 11,
                                        borderRight: '1px solid rgba(0,0,0,0.1)',
                                        flexShrink: 0,
                                    }}>{lagLabel}</span>
                                )}
                                <span className="truncate" style={{
                                    padding: '0 6px',
                                    color: 'var(--text-primary)',
                                }}>{link.name}</span>
                            </span>
                        );
                    })}
                </div>
            )}
            {open && dropdownPos && (
                <div
                    ref={dropdownRef}
                    className="fixed z-50 bg-white rounded-lg overflow-hidden"
                    style={{
                        left: dropdownPos.left,
                        top: dropdownPos.top,
                        bottom: dropdownPos.bottom,
                        width: dropdownPos.width,
                        maxHeight: 320,
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.12)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Search */}
                    <div style={{padding: '8px 8px 4px'}}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Find a record..."
                            className="w-full text-[13px] outline-none"
                            style={{
                                height: 28,
                                borderRadius: 4,
                                padding: '0 8px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                background: 'var(--surface)',
                                color: 'var(--text-primary)',
                            }}
                        />
                    </div>
                    {/* Record list with checkboxes */}
                    <div className="overflow-y-auto" style={{maxHeight: 260}}>
                        {dropdownItems.map(item => (
                            <button
                                key={item.id}
                                className="w-full text-left flex items-center gap-2 hover:bg-black/[0.03]"
                                style={{
                                    padding: '6px 12px',
                                    fontSize: 13,
                                    color: 'var(--text-primary)',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                }}
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleToggle(item.id, item.isLinked); }}
                            >
                                {/* Checkbox indicator */}
                                <span
                                    className="flex-shrink-0 flex items-center justify-center"
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 3,
                                        border: item.isLinked ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
                                        background: item.isLinked ? '#166EE1' : 'transparent',
                                        color: '#fff',
                                        fontSize: 10,
                                    }}
                                >
                                    {item.isLinked && '✓'}
                                </span>
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))}
                        {dropdownItems.length === 0 && (
                            <div style={{padding: '12px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center'}}>
                                {search ? 'No matching records' : 'No records'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function InlineCell({record, field, table, width}) {
    if (field?.type === FieldType.MULTIPLE_RECORD_LINKS) {
        return <LinkedRecordCell record={record} field={field} table={table} width={width} />;
    }
    return <InlineCellInner record={record} field={field} table={table} width={width} />;
}

function InlineCellInner({record, field, table, width}) {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef(null);

    const displayValue = formatCellValue(record, field);
    const isSelect = field?.type === FieldType.SINGLE_SELECT;
    const choices = isSelect ? (field.options?.choices || []) : [];

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            if (!isSelect && inputRef.current.select) {
                inputRef.current.select();
            }
        }
    }, [editing, isSelect]);

    const handleClick = useCallback((e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!table || !record || !field) return;

        // For checkbox, toggle immediately
        if (field.type === FieldType.CHECKBOX) {
            try {
                const currentVal = record.getCellValue(field);
                table.updateRecordAsync(record, {
                    [field.id]: !currentVal,
                }).catch(() => {});
            } catch {
                // ignore
            }
            return;
        }

        if (isSelect) {
            // For select fields, get current choice name
            try {
                const raw = record.getCellValue(field);
                setEditValue(raw?.name || '');
            } catch {
                setEditValue('');
            }
            setEditing(true);
            return;
        }

        let initial = displayValue;
        if (field.type === FieldType.PERCENT) {
            try {
                const raw = record.getCellValue(field);
                initial = raw !== null && raw !== undefined ? String(Math.round(raw * 100)) : '';
            } catch {
                initial = '';
            }
        }
        setEditValue(initial);
        setEditing(true);
    }, [table, field, record, displayValue, isSelect]);

    const handleSelectChange = useCallback(async (e) => {
        const choiceName = e.target.value;
        setEditing(false);
        if (!record || !field || !table) return;
        try {
            await table.updateRecordAsync(record, {
                [field.id]: choiceName ? {name: choiceName} : null,
            });
        } catch {
            // Update failed
        }
    }, [record, field, table]);

    const handleSave = useCallback(async () => {
        setEditing(false);
        if (!record || !field || !table) return;

        const parsed = parseInputValue(editValue, field);
        try {
            await table.updateRecordAsync(record, {
                [field.id]: parsed,
            });
        } catch {
            // Update failed
        }
    }, [editValue, record, field, table]);

    const handleKeyDown = useCallback((e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setEditing(false);
        }
    }, [handleSave]);

    const selectAnchorRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState(null);

    // Position the dropdown when editing a select
    useEffect(() => {
        if (editing && isSelect && selectAnchorRef.current) {
            const rect = selectAnchorRef.current.getBoundingClientRect();
            setDropdownPos({left: rect.left, top: rect.bottom + 2, width: Math.max(rect.width, 160)});
        }
        if (!editing) setDropdownPos(null);
    }, [editing, isSelect]);

    // Close dropdown on outside click
    useEffect(() => {
        if (!editing || !isSelect) return;
        const handleClick = (e) => {
            if (selectAnchorRef.current && !selectAnchorRef.current.contains(e.target)) {
                setEditing(false);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [editing, isSelect]);

    const handleSelectKeyDown = useCallback((e) => {
        e.stopPropagation();
        if (e.key === 'Escape') setEditing(false);
    }, []);

    if (editing && isSelect) {
        return (
            <div
                ref={selectAnchorRef}
                className="flex items-center px-1 flex-shrink-0 overflow-visible relative"
                style={{width, userSelect: 'text'}}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={handleSelectKeyDown}
            >
                {/* Anchor pill showing current value */}
                <div
                    className="w-full rounded ring-1 ring-blue-blue cursor-pointer flex items-center px-1.5"
                    style={{
                        height: 24,
                        borderRadius: 4,
                        boxShadow: '0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)',
                    }}
                >
                    {editValue ? (() => {
                        const c = choices.find(ch => ch.name === editValue);
                        const colors = getSelectColor(c?.color);
                        return (
                            <span className="text-[11px] font-medium truncate rounded-full px-2 py-0.5" style={{backgroundColor: colors.bg, color: colors.text}}>
                                {editValue}
                            </span>
                        );
                    })() : <span className="text-[13px] text-gray-gray400">—</span>}
                </div>
                {/* Dropdown */}
                {dropdownPos && (
                    <div
                        className="fixed z-50 bg-white rounded-lg py-1 overflow-y-auto"
                        style={{
                            left: dropdownPos.left,
                            top: dropdownPos.top,
                            width: dropdownPos.width,
                            maxHeight: 240,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
                        }}
                    >
                        {/* Clear option */}
                        <button
                            className="w-full text-left px-2 py-1 text-[13px] text-gray-gray400 hover:bg-black/[0.04]"
                            onMouseDown={(e) => { e.preventDefault(); handleSelectChange({target: {value: ''}}); }}
                        >
                            —
                        </button>
                        {choices.map(choice => {
                            const colors = getSelectColor(choice.color);
                            return (
                                <button
                                    key={choice.id}
                                    className="w-full text-left px-2 py-1 hover:bg-black/[0.04] flex items-center"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelectChange({target: {value: choice.name}}); }}
                                >
                                    <span
                                        className="text-[11px] font-medium truncate rounded-full px-2 py-0.5"
                                        style={{backgroundColor: colors.bg, color: colors.text}}
                                    >
                                        {choice.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (editing) {
        const inputType = field.type === FieldType.NUMBER || field.type === FieldType.PERCENT
            ? 'number' : 'text';

        return (
            <div
                className="flex items-center px-1 flex-shrink-0 overflow-hidden"
                style={{width, userSelect: 'text'}}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <input
                    ref={inputRef}
                    type={inputType}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    className="w-full text-[13px] bg-white outline-none text-gray-gray800 ring-1 ring-blue-blue"
                    style={{
                        userSelect: 'text',
                        height: 24,
                        borderRadius: 4,
                        padding: '2px 6px',
                        boxShadow: '0px 0px 1px rgba(0,0,0,0.32), 0px 0px 2px rgba(0,0,0,0.08), 0px 1px 3px rgba(0,0,0,0.08)',
                    }}
                />
            </div>
        );
    }

    // For select fields, show colored pill
    if (isSelect && displayValue) {
        let currentChoice = null;
        try {
            const raw = record.getCellValue(field);
            if (raw) currentChoice = choices.find(c => c.name === raw.name);
        } catch { /* ignore */ }
        const colors = getSelectColor(currentChoice?.color);

        return (
            <div
                className="flex items-center px-1.5 flex-shrink-0 overflow-hidden cursor-pointer hover:bg-black/[0.03] aero-transition"
                style={{width, userSelect: 'auto'}}
                onClick={handleClick}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <span
                    className="text-[11px] font-medium truncate leading-none rounded-full px-2 py-0.5 max-w-full pointer-events-none"
                    style={{backgroundColor: colors.bg, color: colors.text}}
                >
                    {displayValue}
                </span>
            </div>
        );
    }

    return (
        <div
            className="flex items-center px-1.5 flex-shrink-0 overflow-hidden cursor-text hover:bg-black/[0.03] aero-transition"
            style={{width, userSelect: 'auto'}}
            onClick={handleClick}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <span className="text-[13px] text-gray-gray500 truncate leading-snug pointer-events-none">
                {displayValue || '\u00A0'}
            </span>
        </div>
    );
}
