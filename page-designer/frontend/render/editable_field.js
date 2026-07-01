// View-mode inline editor for a field bound to an element. Renders the right
// control for the field type and writes through table.updateRecordAsync, gated by
// the viewer's own edit permission. No permission (or an unsupported type) falls
// back to the plain value, so a read-only viewer just sees the data.

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useBase} from '@airtable/blocks/interface/ui';
import {
    editableInputKind,
    coerceEditableValue,
    isoToInputValue,
    inputValueToIso,
} from '../domain/editable_fields.mjs';
import {EditIcon} from '../ui/icons.js';

const ACCENT = 'rgba(22,110,225';
const RATING_GLYPH = {star: '★', heart: '♥', thumbsUp: '👍', flag: '⚑'};
const SAVE_ERROR = "Couldn't save — you may not have edit access, or the change was rejected.";

export function EditableField({field, record, table, css}) {
    const base = useBase();
    const kind = editableInputKind(field.type);
    // Percent cells are stored as decimals (0.0875) but shown as "8.75%". Edit in
    // percent units to match the display and Airtable's own grid: show value×100,
    // write typed/100.
    const isPercent = field.type === 'percent';
    const frameRef = useRef(null);
    const panelRef = useRef(null);
    const [hover, setHover] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [anchor, setAnchor] = useState(null);
    const [query, setQuery] = useState('');

    // While the picker popover is open: close on an outside click, and also on
    // scroll/resize — it's position:fixed and can't follow the scrolling, zooming
    // canvas, so it would otherwise float detached from its field.
    useEffect(() => {
        if (!anchor) return undefined;
        const close = () => {
            setAnchor(null);
            setEditing(false);
        };
        const onDown = (e) => {
            if (frameRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
            close();
        };
        // Close when the canvas scrolls (the fixed panel can't follow it), but NOT
        // when scrolling within the picker's own list.
        const onScroll = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            close();
        };
        window.addEventListener('mousedown', onDown, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('mousedown', onDown, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', close);
        };
    }, [anchor]);

    if (!kind || !table.hasPermissionToUpdateRecord(record, {[field.id]: undefined})) {
        return <div style={css}>{record.getCellValueAsString(field)}</div>;
    }

    const label = field.name;

    const commit = async (cellValue, keepOpen = false) => {
        if (!table.hasPermissionToUpdateRecord(record, {[field.id]: cellValue})) {
            setError(true);
            if (!keepOpen) setEditing(false);
            return;
        }
        setSaving(true);
        setError(false);
        try {
            await table.updateRecordAsync(record, {[field.id]: cellValue});
        } catch (e) {
            console.warn('Page Designer: could not save field edit', e);
            setError(true);
        } finally {
            setSaving(false);
            if (!keepOpen) setEditing(false);
        }
    };

    const active = error || editing || hover || !!anchor;
    const ringColor = error ? '#e5484d' : editing || anchor ? `${ACCENT},0.6)` : `${ACCENT},0.4)`;
    const ringWidth = editing || anchor || error ? 1.5 : 1;
    const frame = (children) => (
        <div
            ref={frameRef}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => {
                setHover(false);
                if (error) setError(false); // let a stale error ring clear when they move away
            }}
            title={error ? SAVE_ERROR : undefined}
            style={{
                position: 'relative',
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 4,
                // Breathing room from the ring, only while it's showing, so the resting
                // value stays flush/aligned with non-editable fields. Em-based so it
                // scales with the field's font size (small label vs large value).
                padding: active ? '0.25em 0.5em' : 0,
                boxShadow: active ? `inset 0 0 0 ${ringWidth}px ${ringColor}` : 'none',
                backgroundColor: editing ? '#ffffff' : hover ? `${ACCENT},0.05)` : 'transparent',
                opacity: saving ? 0.6 : 1,
                transition: 'box-shadow 0.12s ease, background-color 0.12s ease',
            }}
        >
            {children}
        </div>
    );

    const pencil = hover ? (
        <span
            style={{
                position: 'absolute',
                top: '50%',
                right: 6,
                transform: 'translateY(-50%)',
                display: 'flex',
                color: `${ACCENT},0.55)`,
                pointerEvents: 'none',
            }}
        >
            <EditIcon size={11} />
        </span>
    ) : null;

    const selectStyle = {...css, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer'};

    // A searchable popover (portaled to <body> so it isn't clipped by the page's
    // overflow/scale). Used for choice and — critically — collaborator pickers,
    // which on enterprise bases can list hundreds of people.
    const openPanel = () => {
        const r = frameRef.current.getBoundingClientRect();
        setAnchor({left: r.left, top: r.bottom + 2, width: r.width});
        setQuery('');
        setError(false);
        setEditing(true);
    };
    const optionLabel = (o) => o.name || o.email || '';
    const rowStyle = (selected) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        background: selected ? `${ACCENT},0.08)` : undefined,
        whiteSpace: 'nowrap',
    });
    const clickToOpen = () => (
        <div onClick={openPanel} style={{...css, cursor: 'pointer', minHeight: '1em'}}>
            {record.getCellValueAsString(field) || ' '}
            {pencil}
        </div>
    );
    const popover = (options, {multi, selectedIds, onPick}) => {
        if (!anchor) return null;
        const q = query.trim().toLowerCase();
        const filtered = q ? options.filter((o) => optionLabel(o).toLowerCase().includes(q)) : options;
        return createPortal(
            <div
                ref={panelRef}
                style={{
                    position: 'fixed',
                    left: anchor.left,
                    top: anchor.top,
                    minWidth: Math.max(200, anchor.width),
                    maxWidth: 360,
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.15)',
                    borderRadius: 6,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                    zIndex: 10000,
                    overflow: 'hidden',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: '#1d1f25',
                }}
            >
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        border: 'none',
                        borderBottom: '1px solid rgba(0,0,0,0.1)',
                        outline: 'none',
                        fontFamily: 'inherit',
                        fontSize: 13,
                    }}
                />
                <div style={{maxHeight: 220, overflowY: 'auto', padding: 4}}>
                    {!multi ? (
                        <div onClick={() => onPick(null)} style={rowStyle(false)}>
                            —
                        </div>
                    ) : null}
                    {filtered.length === 0 ? (
                        <div style={{padding: '6px 8px', color: '#6b7280'}}>No matches</div>
                    ) : (
                        filtered.map((o) => (
                            <div key={o.id} onClick={() => onPick(o.id)} style={rowStyle(selectedIds?.has(o.id))}>
                                {multi ? (
                                    <input
                                        type="checkbox"
                                        readOnly
                                        checked={selectedIds.has(o.id)}
                                        style={{marginRight: 8}}
                                    />
                                ) : null}
                                <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{optionLabel(o)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>,
            document.body,
        );
    };

    // --- Direct-toggle controls -------------------------------------------------

    if (kind === 'checkbox') {
        const checked = !!record.getCellValue(field);
        return frame(
            <div style={{...css, display: 'flex', alignItems: 'center'}}>
                <input
                    type="checkbox"
                    aria-label={label}
                    checked={checked}
                    disabled={saving}
                    onChange={(e) => commit(e.target.checked ? true : null)}
                    style={{cursor: 'pointer'}}
                />
            </div>,
        );
    }

    if (kind === 'rating') {
        const opts = (field.config && field.config.options) || {};
        const max = opts.max || 5;
        const glyph = RATING_GLYPH[opts.icon] || '★';
        const value = Number(record.getCellValue(field)) || 0;
        const setRating = (n) => commit(n === value ? null : n); // click the current level to clear
        return frame(
            <div role="group" aria-label={label} style={{...css, display: 'flex', gap: '0.1em'}}>
                {Array.from({length: max}, (_, i) => i + 1).map((n) => (
                    <span
                        key={n}
                        role="button"
                        tabIndex={0}
                        aria-label={`${n} of ${max}`}
                        onClick={() => setRating(n)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setRating(n);
                            }
                        }}
                        style={{cursor: 'pointer', color: n <= value ? '#fcb400' : 'rgba(0,0,0,0.2)'}}
                    >
                        {glyph}
                    </span>
                ))}
            </div>,
        );
    }

    // --- Single select: native dropdown (small list, overlay escapes clipping) ---

    if (kind === 'select') {
        const choices = (field.config && field.config.options && field.config.options.choices) || [];
        const current = record.getCellValue(field);
        return frame(
            <select
                aria-label={label}
                value={current ? current.id : ''}
                disabled={saving}
                onChange={(e) => commit(e.target.value ? {id: e.target.value} : null)}
                style={selectStyle}
            >
                <option value="">—</option>
                {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                        {c.name}
                    </option>
                ))}
            </select>,
        );
    }

    // --- Single collaborator: searchable popover (rosters can be huge) -----------

    if (kind === 'collaborator') {
        const people = base.activeCollaborators || [];
        const current = record.getCellValue(field);
        // Keep the current assignee selectable even if they're not in the roster.
        const options = current && !people.some((p) => p.id === current.id) ? [current, ...people] : people;
        return frame(
            <>
                {clickToOpen()}
                {popover(options, {
                    multi: false,
                    onPick: (id) => {
                        commit(id ? {id} : null);
                        setAnchor(null);
                    },
                })}
            </>,
        );
    }

    // --- Date / date-time: click the value to reveal a native picker ------------

    if (kind === 'date' || kind === 'datetime') {
        if (!editing) {
            return frame(
                <div
                    onClick={() => {
                        setDraft(isoToInputValue(kind, record.getCellValue(field)));
                        setError(false);
                        setEditing(true);
                    }}
                    style={{...css, cursor: 'pointer', minHeight: '1em'}}
                >
                    {record.getCellValueAsString(field) || ' '}
                    {pencil}
                </div>,
            );
        }
        return frame(
            <input
                aria-label={label}
                autoFocus
                type={kind === 'date' ? 'date' : 'datetime-local'}
                value={draft}
                disabled={saving}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(inputValueToIso(kind, draft))}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditing(false);
                    else if (e.key === 'Enter') commit(inputValueToIso(kind, draft));
                }}
                style={{...css, width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', padding: 0}}
            />,
        );
    }

    // --- Multi-value: searchable checklist popover ------------------------------

    if (kind === 'multiselect' || kind === 'multicollaborator') {
        const baseOptions =
            kind === 'multiselect'
                ? (field.config && field.config.options && field.config.options.choices) || []
                : base.activeCollaborators || [];
        const current = record.getCellValue(field) || [];
        const optionIds = new Set(baseOptions.map((o) => o.id));
        // Show already-set values that aren't in the roster/choices so they stay
        // visible and de-selectable rather than silently disappearing.
        const options = [...baseOptions, ...current.filter((c) => !optionIds.has(c.id))];
        const currentIds = new Set(current.map((x) => x.id));
        const toggle = (id) => {
            // Read the freshest cell value (writes apply optimistically) so quick
            // successive toggles compose instead of racing on a stale snapshot.
            const cur = record.getCellValue(field) || [];
            const next = cur.some((x) => x.id === id) ? cur.filter((x) => x.id !== id) : [...cur, {id}];
            commit(next.map((x) => ({id: x.id})), true);
        };
        return frame(
            <>
                {clickToOpen()}
                {popover(options, {multi: true, selectedIds: currentIds, onPick: toggle})}
            </>,
        );
    }

    // --- Text / multiline / number: click the value to edit it in place ---------

    if (!editing) {
        return frame(
            <div
                onClick={() => {
                    const v = record.getCellValue(field);
                    setDraft(v == null ? '' : String(isPercent ? +(v * 100).toFixed(8) : v));
                    setError(false);
                    setEditing(true);
                }}
                style={{...css, cursor: 'text', minHeight: '1em'}}
            >
                {record.getCellValueAsString(field) || ' '}
                {pencil}
            </div>,
        );
    }

    const commitText = () => {
        // Don't clear the cell when a typed number is unparseable — revert instead.
        if (kind === 'number' && draft.trim() !== '' && !Number.isFinite(Number(draft))) {
            setEditing(false);
            return;
        }
        let value = coerceEditableValue(kind, draft);
        if (isPercent && typeof value === 'number') value = value / 100;
        commit(value);
    };
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            setEditing(false);
        } else if (e.key === 'Enter' && kind !== 'textarea') {
            e.preventDefault();
            commitText();
        }
    };
    const inputStyle = {
        ...css,
        width: '100%',
        boxSizing: 'border-box',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        padding: 0,
        resize: 'none',
    };
    return frame(
        kind === 'textarea' ? (
            <textarea
                aria-label={label}
                autoFocus
                rows={3}
                value={draft}
                disabled={saving}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitText}
                onKeyDown={onKeyDown}
                style={inputStyle}
            />
        ) : (
            <input
                aria-label={label}
                autoFocus
                type={kind === 'number' ? 'number' : 'text'}
                value={draft}
                disabled={saving}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitText}
                onKeyDown={onKeyDown}
                style={inputStyle}
            />
        ),
    );
}
