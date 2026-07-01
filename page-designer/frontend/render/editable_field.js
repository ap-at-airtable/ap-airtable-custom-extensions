// View-mode inline editor for a field bound to an element. Renders the right
// control for the field type and writes through table.updateRecordAsync, gated by
// the viewer's own edit permission. No permission (or an unsupported type) falls
// back to the plain value, so a read-only viewer just sees the data.

import {useState} from 'react';
import {editableInputKind, coerceEditableValue} from '../domain/editable_fields.mjs';
import {EditIcon} from '../ui/icons.js';

const ACCENT = 'rgba(22,110,225';

export function EditableField({field, record, table, css}) {
    const kind = editableInputKind(field.type);
    const [hover, setHover] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    if (!kind || !table.hasPermissionToUpdateRecord(record, {[field.id]: undefined})) {
        return <div style={css}>{record.getCellValueAsString(field)}</div>;
    }

    const commit = async (cellValue) => {
        if (!table.hasPermissionToUpdateRecord(record, {[field.id]: cellValue})) {
            setError(true);
            setEditing(false);
            return;
        }
        setSaving(true);
        setError(false);
        try {
            await table.updateRecordAsync(record, {[field.id]: cellValue});
        } catch {
            setError(true);
        } finally {
            setSaving(false);
            setEditing(false);
        }
    };

    // No treatment at rest — the field looks exactly like a static value until you
    // hover (soft tint + ring) or edit (crisp ring on white). Inset box-shadow (not
    // outline) so the ring hugs the rounded corners and never shifts layout.
    const active = error || editing || hover;
    const ringColor = error ? '#e5484d' : editing ? `${ACCENT},0.6)` : `${ACCENT},0.4)`;
    const ringWidth = editing || error ? 1.5 : 1;
    const frame = (children) => (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
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

    if (kind === 'checkbox') {
        const checked = !!record.getCellValue(field);
        return frame(
            <div style={{...css, display: 'flex', alignItems: 'center'}}>
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving}
                    onChange={(e) => commit(e.target.checked ? true : null)}
                    style={{cursor: 'pointer'}}
                />
            </div>,
        );
    }

    if (kind === 'select') {
        const choices = (field.config && field.config.options && field.config.options.choices) || [];
        const current = record.getCellValue(field);
        return frame(
            <select
                value={current ? current.id : ''}
                disabled={saving}
                onChange={(e) => commit(e.target.value ? {id: e.target.value} : null)}
                style={{...css, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer'}}
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

    // Text / multiline / number: click the value to edit it in place.
    if (!editing) {
        const value = record.getCellValueAsString(field);
        return frame(
            <div
                onClick={() => {
                    const v = record.getCellValue(field);
                    setDraft(v == null ? '' : String(v));
                    setError(false);
                    setEditing(true);
                }}
                style={{...css, cursor: 'text', minHeight: '1em'}}
            >
                {value || ' '}
                {hover ? (
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
                ) : null}
            </div>,
        );
    }

    const commitText = () => commit(coerceEditableValue(kind, draft));
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
