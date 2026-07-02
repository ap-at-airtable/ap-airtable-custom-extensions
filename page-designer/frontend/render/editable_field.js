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
import {COARSE} from '../ui/pointer.js';
import {ChoicePill} from './select_pill.js';
import {SelectStepper} from './select_stepper.js';
import {RATING_GLYPH, RatingDisplay, CheckboxDisplay} from './field_display.js';

const ACCENT = 'rgba(22,110,225';
const ACCENT_SOLID = '#166ee1';
const SAVED = '#2ea043';
const EDIT_TEXT = '#1d1f25'; // readable input text regardless of the element's own color
const MAX_OPTION_ROWS = 100; // cap rendered picker rows (rosters can be huge)
const SAVE_ERROR = "Couldn't save — you may not have edit access, or the change was rejected.";

export function EditableField({
    field,
    record,
    table,
    css,
    selectDisplay = 'text',
    stepperVariant = 'radio',
    stepperColor,
    stepperTrackColor,
}) {
    const isPill = selectDisplay === 'pill';
    const base = useBase();
    const kind = editableInputKind(field.type);
    // Percent cells are stored as decimals (0.0875) but shown as "8.75%". Edit in
    // percent units to match the display and Airtable's own grid.
    const isPercent = field.type === 'percent';
    const frameRef = useRef(null);
    const panelRef = useRef(null);
    const restRef = useRef(null); // resting display, for focus restoration
    const savedTimer = useRef(null);
    const wasActive = useRef(false);
    const [hover, setHover] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [saved, setSaved] = useState(false);
    const [anchor, setAnchor] = useState(null);
    const [panelIn, setPanelIn] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    // Close the picker on outside click / scroll / resize (fixed panel can't follow
    // the canvas) — but not when scrolling within the picker itself.
    useEffect(() => {
        if (!anchor || COARSE) return undefined; // touch uses a backdrop, not these listeners
        const close = () => {
            setAnchor(null);
            setEditing(false);
        };
        const onDown = (e) => {
            if (frameRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
            close();
        };
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

    // Animate the popover in.
    useEffect(() => {
        if (!anchor) {
            setPanelIn(false);
            return undefined;
        }
        const id = setTimeout(() => setPanelIn(true), 0);
        return () => clearTimeout(id);
    }, [anchor]);

    // Restore focus to the resting field when an edit/picker session ends, so
    // keyboard users keep their place and can Tab onward.
    useEffect(() => {
        const activeNow = editing || !!anchor;
        if (!activeNow && wasActive.current) restRef.current?.focus?.();
        wasActive.current = activeNow;
    }, [editing, anchor]);

    // Clear any pending saved-pulse timer on unmount (cells unmount often in tables).
    useEffect(() => () => clearTimeout(savedTimer.current), []);

    // No inline-edit permission (or unsupported kind): render read-only. Glyph field
    // types keep their visual (stars / checkbox) instead of falling back to raw text.
    if (!kind || !table.hasPermissionToUpdateRecord(record, {[field.id]: undefined})) {
        if (kind === 'rating') return <RatingDisplay field={field} record={record} css={css} />;
        if (kind === 'checkbox') return <CheckboxDisplay field={field} record={record} css={css} />;
        return <div style={css}>{record.getCellValueAsString(field)}</div>;
    }

    const label = field.name;

    const flashSaved = () => {
        setSaved(true);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 400);
    };
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
            flashSaved();
        } catch (e) {
            console.warn('Page Designer: could not save field edit', e);
            setError(true);
        } finally {
            setSaving(false);
            if (!keepOpen) setEditing(false);
        }
    };

    // On touch there's no hover, so surface the affordance whenever the field is on
    // screen (standing, subtle) rather than hover-gated.
    const showRest = hover || COARSE;
    const active = error || editing || showRest || !!anchor || saved;
    const ringColor = error
        ? '#e5484d'
        : saved
          ? SAVED
          : editing || anchor
            ? `${ACCENT},0.65)`
            : `${ACCENT},0.4)`;
    const ringWidth = editing || anchor || error || saved ? 1.5 : 1;
    const frame = (children) => (
        <div
            ref={frameRef}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)} // keep a failed-save error ring visible
            title={error ? SAVE_ERROR : undefined}
            style={{
                position: 'relative',
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 6,
                padding: active ? '0.25em 0.5em' : 0,
                boxShadow: editing
                    ? `inset 0 0 0 ${ringWidth}px ${ringColor}, 0 2px 12px rgba(15,23,42,0.10)`
                    : active
                      ? `inset 0 0 0 ${ringWidth}px ${ringColor}`
                      : 'none',
                backgroundColor: editing ? '#ffffff' : showRest ? `${ACCENT},0.06)` : 'transparent',
                opacity: saving ? 0.9 : 1,
                transition: 'box-shadow 0.1s ease, background-color 0.1s ease, opacity 0.1s ease',
            }}
        >
            {children}
        </div>
    );

    // A chip behind the pencil so it reads on any page background: the light fill
    // pops on dark pages, the border + shadow define it on light ones.
    const pencil = showRest ? (
        <span
            style={{
                position: 'absolute',
                top: '50%',
                right: COARSE ? 4 : 3,
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: COARSE ? 22 : 18,
                height: COARSE ? 22 : 18,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.18)',
                color: ACCENT_SOLID,
                pointerEvents: 'none',
            }}
        >
            <EditIcon size={COARSE ? 13 : 11} />
        </span>
    ) : null;

    // Resting value is keyboard-focusable so viewers can Tab between fields; Enter/
    // Space activates (edit inline or open the picker). touch-action avoids the
    // browser's double-tap-zoom stealing a tap-to-edit.
    const focusableRest = (activate) => ({
        ref: restRef,
        tabIndex: 0,
        role: 'button',
        'aria-label': label,
        onFocus: () => setHover(true),
        onBlur: () => setHover(false),
        onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        },
    });
    const restStyle = (cursor) => ({
        ...css,
        cursor,
        minHeight: '1em',
        outline: 'none',
        touchAction: 'manipulation',
        // Reserve room for the hover pencil chip so it never sits over the value
        // (e.g. a right-aligned field). Only while the affordance shows, so nothing
        // shifts at rest on desktop.
        paddingRight: showRest ? (COARSE ? 30 : 24) : undefined,
    });
    const openPanel = () => {
        const r = frameRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const panelW = Math.min(360, Math.max(200, r.width));
        const estH = 300;
        let left = r.left;
        if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8);
        let top = r.bottom + 4;
        if (top + estH > vh - 8 && r.top - estH > 8) top = r.top - estH - 4; // flip above
        setAnchor({left, top, width: r.width});
        setQuery('');
        setActiveIndex(0);
        setError(false);
        setEditing(true);
    };
    const optionLabel = (o) => o.name || o.email || '';
    const clickToOpen = (content) => (
        <div onClick={openPanel} {...focusableRest(openPanel)} aria-haspopup="listbox" aria-expanded={!!anchor} style={restStyle('pointer')}>
            {content ?? (record.getCellValueAsString(field) || ' ')}
            {pencil}
        </div>
    );
    const popover = (options, {multi, selectedIds, onPick}) => {
        if (!anchor) return null;
        const q = query.trim().toLowerCase();
        const all = q ? options.filter((o) => optionLabel(o).toLowerCase().includes(q)) : options;
        const shown = all.slice(0, MAX_OPTION_ROWS);
        const pickActive = () => {
            if (shown[activeIndex]) onPick(shown[activeIndex].id);
        };
        const closePanel = () => {
            setAnchor(null);
            setEditing(false);
        };
        const panelStyle = COARSE
            ? {
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  maxHeight: '78vh',
                  background: '#fff',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  boxShadow: '0 -6px 28px rgba(15,23,42,0.28)',
                  zIndex: 10000,
                  overflow: 'hidden',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  color: EDIT_TEXT,
                  transform: panelIn ? 'none' : 'translateY(100%)',
                  transition: 'transform 0.18s ease',
              }
            : {
                  position: 'fixed',
                  left: anchor.left,
                  top: anchor.top,
                  minWidth: Math.max(200, anchor.width),
                  maxWidth: 360,
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 10px 34px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
                  zIndex: 10000,
                  overflow: 'hidden',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  color: EDIT_TEXT,
                  opacity: panelIn ? 1 : 0,
                  transform: panelIn ? 'none' : 'translateY(-4px) scale(0.985)',
                  transformOrigin: 'top center',
                  transition: 'opacity 0.13s ease, transform 0.13s ease',
              };
        return createPortal(
            <>
                {COARSE ? (
                    <div
                        onClick={closePanel}
                        style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9999}}
                    />
                ) : null}
                <div ref={panelRef} style={panelStyle}>
                    <div style={{position: 'relative', padding: COARSE ? 12 : 8, borderBottom: '1px solid rgba(0,0,0,0.07)'}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(15,23,42,0.4)" strokeWidth="2.2" strokeLinecap="round" style={{position: 'absolute', left: COARSE ? 22 : 16, top: '50%', transform: 'translateY(-50%)'}}>
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3-3" />
                        </svg>
                        <input
                            autoFocus={!COARSE}
                            value={query}
                            aria-label={`Search ${label}`}
                            role="combobox"
                            aria-expanded="true"
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setActiveIndex(0);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    closePanel();
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setActiveIndex((i) => Math.min(i + 1, shown.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setActiveIndex((i) => Math.max(i - 1, 0));
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    pickActive();
                                }
                            }}
                            placeholder="Search…"
                            style={{width: '100%', boxSizing: 'border-box', padding: COARSE ? '10px 10px 10px 34px' : '6px 8px 6px 28px', border: 'none', borderRadius: 6, background: 'rgba(15,23,42,0.05)', outline: 'none', fontFamily: 'inherit', fontSize: COARSE ? 15 : 13, color: EDIT_TEXT}}
                        />
                    </div>
                    <div role="listbox" aria-label={label} style={{maxHeight: COARSE ? '62vh' : 240, overflowY: 'auto', padding: 4}}>
                    {!multi
                        ? row({id: '__none__', label: '—', selected: !selectedIds || selectedIds.size === 0, multi, active: false, onClick: () => onPick(null)})
                        : null}
                    {shown.length === 0 ? (
                        <div style={{padding: '8px', color: '#6b7280'}}>No matches</div>
                    ) : (
                        shown.map((o, i) =>
                            row({
                                id: o.id,
                                label: optionLabel(o),
                                selected: selectedIds?.has(o.id),
                                active: i === activeIndex,
                                multi,
                                onClick: () => onPick(o.id),
                                onHover: () => setActiveIndex(i),
                            }),
                        )
                    )}
                    {all.length > shown.length ? (
                        <div style={{padding: '6px 8px', color: '#6b7280', fontSize: 12}}>
                            Showing first {MAX_OPTION_ROWS} — refine your search.
                        </div>
                    ) : null}
                    </div>
                </div>
            </>,
            document.body,
        );
    };
    const row = ({id, label: text, selected, active: isActive, multi, onClick, onHover}) => (
        <div
            key={id}
            role="option"
            aria-selected={!!selected}
            onClick={onClick}
            onMouseEnter={onHover}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: COARSE ? '12px 12px' : '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                background: isActive ? 'rgba(15,23,42,0.06)' : 'transparent',
            }}
        >
            {multi ? <input type="checkbox" readOnly checked={!!selected} style={{accentColor: ACCENT_SOLID}} /> : null}
            <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{text}</span>
            {!multi && selected ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT_SOLID} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            ) : null}
        </div>
    );

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
                    style={{cursor: 'pointer', accentColor: ACCENT_SOLID, width: '1em', height: '1em'}}
                />
            </div>,
        );
    }

    if (kind === 'rating') {
        const opts = (field.config && field.config.options) || {};
        const max = opts.max || 5;
        const glyph = RATING_GLYPH[opts.icon] || '★';
        const value = Number(record.getCellValue(field)) || 0;
        const setRating = (n) => commit(n === value ? null : n);
        return frame(
            <div role="group" aria-label={label} style={{...css, display: 'flex', gap: '0.1em'}}>
                {Array.from({length: max}, (_, i) => i + 1).map((n) => (
                    <span
                        key={n}
                        role="button"
                        tabIndex={0}
                        aria-label={`${n} of ${max}`}
                        aria-pressed={n <= value}
                        onClick={() => setRating(n)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setRating(n);
                            }
                        }}
                        style={{cursor: 'pointer', color: n <= value ? '#fcb400' : 'rgba(15,23,42,0.18)'}}
                    >
                        {glyph}
                    </span>
                ))}
            </div>,
        );
    }

    // --- Single select: native dropdown (small list, overlay escapes clipping) ---

    if (kind === 'select') {
        // Stepper is its own control (click a step to set the value) — no popover.
        if (selectDisplay === 'stepper') {
            return frame(
                <SelectStepper
                    field={field}
                    record={record}
                    css={css}
                    variant={stepperVariant}
                    accent={stepperColor}
                    track={stepperTrackColor}
                    saving={saving}
                    onChange={(id) => commit(id ? {id} : null)}
                />,
            );
        }
        const choices = (field.config && field.config.options && field.config.options.choices) || [];
        const current = record.getCellValue(field);
        // Keep the pill at rest (respecting choice color); the picker opens on
        // click. Falls back to plain text when display is Text.
        const resting = isPill && current ? <ChoicePill field={field} choice={current} css={css} /> : undefined;
        return frame(
            <>
                {clickToOpen(resting)}
                {popover(choices, {
                    multi: false,
                    selectedIds: current ? new Set([current.id]) : new Set(),
                    onPick: (id) => {
                        commit(id ? {id} : null);
                        setAnchor(null);
                    },
                })}
            </>,
        );
    }

    // --- Single collaborator: searchable popover (rosters can be huge) -----------

    if (kind === 'collaborator') {
        const people = base.activeCollaborators || [];
        const current = record.getCellValue(field);
        const options = current && !people.some((p) => p.id === current.id) ? [current, ...people] : people;
        return frame(
            <>
                {clickToOpen()}
                {popover(options, {
                    multi: false,
                    selectedIds: current ? new Set([current.id]) : new Set(),
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
            const start = () => {
                setDraft(isoToInputValue(kind, record.getCellValue(field)));
                setError(false);
                setEditing(true);
            };
            return frame(
                <div onClick={start} {...focusableRest(start)} style={restStyle('pointer')}>
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
                style={{...css, color: EDIT_TEXT, width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', padding: 0}}
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
        const options = [...baseOptions, ...current.filter((c) => !optionIds.has(c.id))];
        const currentIds = new Set(current.map((x) => x.id));
        const toggle = (id) => {
            const cur = record.getCellValue(field) || [];
            const next = cur.some((x) => x.id === id) ? cur.filter((x) => x.id !== id) : [...cur, {id}];
            commit(next.map((x) => ({id: x.id})), true);
        };
        // Pill display applies to multi-SELECT choices (colored), not collaborators.
        const resting =
            kind === 'multiselect' && isPill && current.length ? (
                <span style={{display: 'inline-flex', flexWrap: 'wrap', gap: '0.3em', maxWidth: '100%'}}>
                    {current.map((c, i) => (
                        <ChoicePill key={i} field={field} choice={c} css={css} />
                    ))}
                </span>
            ) : undefined;
        return frame(
            <>
                {clickToOpen(resting)}
                {popover(options, {multi: true, selectedIds: currentIds, onPick: toggle})}
            </>,
        );
    }

    // --- Text / multiline / number: click the value to edit it in place ---------

    if (!editing) {
        const start = () => {
            const v = record.getCellValue(field);
            setDraft(v == null ? '' : String(isPercent ? +(v * 100).toFixed(8) : v));
            setError(false);
            setEditing(true);
        };
        return frame(
            <div onClick={start} {...focusableRest(start)} style={restStyle('text')}>
                {record.getCellValueAsString(field) || ' '}
                {pencil}
            </div>,
        );
    }

    const commitText = () => {
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
        color: EDIT_TEXT,
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
            <textarea aria-label={label} autoFocus rows={3} value={draft} disabled={saving} onChange={(e) => setDraft(e.target.value)} onBlur={commitText} onKeyDown={onKeyDown} style={inputStyle} />
        ) : (
            <input aria-label={label} autoFocus type={kind === 'number' ? 'number' : 'text'} value={draft} disabled={saving} onChange={(e) => setDraft(e.target.value)} onBlur={commitText} onKeyDown={onKeyDown} style={inputStyle} />
        ),
    );
}
