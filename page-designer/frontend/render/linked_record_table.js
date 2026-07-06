// Renders a linked-record field as a table: one row per linked record, columns =
// the linked table's chosen fields. Loads the linked table via useRecords, so it
// is its own component (hooks run unconditionally here; ElementContent decides
// whether to mount it).

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useBase, useRecords} from '@airtable/blocks/interface/ui';
import {extractLinkedRecords} from '../domain/cell_value_helpers.mjs';
import {columnFractions} from '../domain/layout_model.mjs';
import {editableInputKind} from '../domain/editable_fields.mjs';
import {textStyle} from './geometry_style.js';
import {EditableField} from './editable_field.js';
import {TrashIcon} from '../ui/icons.js';
import {isTextEntryTarget} from '../ui/dom.js';

// Hard cap on rendered rows so a record linked to thousands of others can't hang
// the render / blow up the DOM. Overflow is surfaced as a "+N more" row.
const MAX_TABLE_ROWS = 100;

export function LinkedRecordTable({element, field, record, table, editable}) {
    const base = useBase();
    const linkedTableId = field.config && field.config.options ? field.config.options.linkedTableId : null;
    const linkedTable = linkedTableId ? base.getTableByIdIfExists(linkedTableId) : null;
    // Hooks must be unconditional — always pass a valid table (fall back to the
    // primary table; its records are ignored when there's no linked table).
    const linkedRecords = useRecords(linkedTable || table) || [];
    const [creating, setCreating] = useState(false);
    const [addError, setAddError] = useState(false);
    const [menu, setMenu] = useState(null); // {x, y, id} right-click / long-press delete menu
    const pressTimer = useRef(null);

    // Close the row menu on scroll / resize / Escape (outside click is handled by
    // the portal's backdrop).
    useEffect(() => {
        if (!menu) return undefined;
        const close = () => setMenu(null);
        const onKey = (e) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', onKey);
        };
    }, [menu]);
    useEffect(() => () => clearTimeout(pressTimer.current), []);

    const ts = textStyle(element.style);

    const columnIds =
        element.linkedColumns && element.linkedColumns.length
            ? element.linkedColumns
            : linkedTable
              ? [linkedTable.primaryField.id]
              : [];
    const columns = linkedTable
        ? columnIds.map((id) => linkedTable.getFieldByIdIfExists(id)).filter(Boolean)
        : [];

    // Fallback to comma names if the linked table or columns can't be resolved.
    if (!linkedTable || columns.length === 0) {
        const names = record
            ? extractLinkedRecords(record.getCellValue(field)).map((r) => r.name).join(', ')
            : field.name;
        return <div style={ts}>{names}</div>;
    }

    const recordById = new Map(linkedRecords.map((r) => [r.id, r]));
    const allRefs = record ? extractLinkedRecords(record.getCellValue(field)) : [];
    const refs = allRefs.slice(0, MAX_TABLE_ROWS);
    const hiddenRows = allRefs.length - refs.length;
    const fractions = columnFractions(columns.map((c) => c.id), element.linkedColumnWidths);

    const cellStyle = {
        ...ts, // ts carries the element's textAlign (Horizontal align) so cells honor it
        border: `1px solid ${element.style.tableBorderColor || 'rgba(0,0,0,0.15)'}`,
        padding: '2px 5px',
        verticalAlign: 'top',
        overflowWrap: 'break-word',
    };
    const headerTextColor = element.style.tableHeaderTextColor;
    const headStyle = {
        ...cellStyle,
        fontWeight: 'bold',
        backgroundColor: element.style.tableHeaderColor,
        ...(headerTextColor ? {color: headerTextColor} : {}),
    };
    const stripeRows = !!element.style.tableStripeRows;
    const stripeColor = element.style.tableStripeColor || 'rgba(0,0,0,0.04)';
    const rowStyle = (i) => (stripeRows && i % 2 === 1 ? {backgroundColor: stripeColor} : undefined);

    const canModifyLinks =
        editable && record && table.hasPermissionToUpdateRecord(record, {[field.id]: undefined});
    const canCreate =
        canModifyLinks &&
        typeof linkedTable.createRecordAsync === 'function' &&
        linkedTable.hasPermissionToCreateRecord();
    const canDeleteRows =
        editable &&
        record &&
        typeof linkedTable.deleteRecordAsync === 'function' &&
        typeof linkedTable.hasPermissionToDeleteRecord === 'function' &&
        linkedTable.hasPermissionToDeleteRecord();

    // Right-click (or long-press on touch) a row → a small menu to delete it.
    const openMenu = (id, x, y) => {
        if (!canDeleteRows) return;
        const w = 220;
        const h = 90;
        setMenu({
            id,
            x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
            y: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
        });
    };
    const rowMenuProps = (id) =>
        canDeleteRows
            ? {
                  onContextMenu: (e) => {
                      // Inside a focused input/select: let the browser's own menu show.
                      if (isTextEntryTarget(e.target)) return;
                      e.preventDefault();
                      openMenu(id, e.clientX, e.clientY);
                  },
                  onTouchStart: (e) => {
                      if (isTextEntryTarget(e.target)) return; // don't hijack a focused field
                      const t = e.touches[0];
                      const x = t.clientX;
                      const y = t.clientY;
                      clearTimeout(pressTimer.current);
                      pressTimer.current = setTimeout(() => openMenu(id, x, y), 500);
                  },
                  onTouchEnd: () => clearTimeout(pressTimer.current),
                  onTouchMove: () => clearTimeout(pressTimer.current),
              }
            : {};

    // "Delete row" removes the linked record itself (Airtable also drops it from
    // this cell). Destructive — it deletes the record, not just the link.
    const deleteRow = async (id) => {
        if (!linkedTable.hasPermissionToDeleteRecord(id)) return;
        try {
            await linkedTable.deleteRecordAsync(id);
        } catch (e) {
            console.warn('Page Designer: could not delete linked record', e);
        }
    };
    const addRow = async () => {
        if (creating) return;
        setCreating(true);
        setAddError(false);
        let newId = null;
        try {
            newId = await linkedTable.createRecordAsync({});
            // Re-read the freshest link value (not the render snapshot) so a concurrent
            // change isn't clobbered by this whole-array write.
            const cur = extractLinkedRecords(record.getCellValue(field)).map((r) => ({id: r.id}));
            await table.updateRecordAsync(record, {[field.id]: [...cur, {id: newId}]});
        } catch (e) {
            console.warn('Page Designer: could not add linked record', e);
            setAddError(true);
            // Roll back the created-but-unlinked record so it isn't left orphaned.
            if (
                newId &&
                typeof linkedTable.deleteRecordAsync === 'function' &&
                linkedTable.hasPermissionToDeleteRecord?.(newId)
            ) {
                try {
                    await linkedTable.deleteRecordAsync(newId);
                } catch (delErr) {
                    console.warn('Page Designer: could not roll back linked record', delErr);
                }
            }
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            {/* Per-column widths go on the first-row <th>, not a <colgroup>: a <col>
                width updated after the initial layout isn't honored here, but the
                first-row cells reliably drive the fixed layout. */}
            <table style={{...ts, borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed'}}>
                <thead>
                    <tr>
                        {columns.map((col, i) => (
                            <th key={col.id} style={{...headStyle, width: `${fractions[i] * 100}%`}}>
                                {col.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {record ? (
                        refs.map((ref, rowIndex) => {
                            const linkedRecord = recordById.get(ref.id);
                            return (
                                <tr key={ref.id} style={rowStyle(rowIndex)} {...rowMenuProps(ref.id)}>
                                    {columns.map((col, colIndex) => (
                                        <td key={col.id} style={cellStyle}>
                                            {linkedRecord && editable && linkedTable && editableInputKind(col.type) ? (
                                                <EditableField field={col} record={linkedRecord} table={linkedTable} css={ts} />
                                            ) : linkedRecord ? (
                                                linkedRecord.getCellValueAsString(col)
                                            ) : colIndex === 0 ? (
                                                ref.name
                                            ) : (
                                                ''
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    ) : (
                        // Editor preview without a record: show one placeholder row.
                        <tr>
                            {columns.map((col) => (
                                <td key={col.id} style={cellStyle}>
                                    {col.name}
                                </td>
                            ))}
                        </tr>
                    )}
                    {hiddenRows > 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                style={{...cellStyle, textAlign: 'center', opacity: 0.6}}
                            >
                                +{hiddenRows} more
                            </td>
                        </tr>
                    ) : null}
                    {canCreate ? (
                        <tr>
                            <td colSpan={columns.length} style={{...cellStyle, padding: 0}}>
                                <button
                                    type="button"
                                    onClick={addRow}
                                    disabled={creating}
                                    title={addError ? 'Could not add a row — check your permissions or connection.' : undefined}
                                    style={{
                                        width: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        font: 'inherit',
                                        padding: '4px 5px',
                                        textAlign: 'center',
                                        cursor: creating ? 'default' : 'pointer',
                                        color: addError ? '#e5484d' : `rgba(22,110,225,${creating ? 0.4 : 0.9})`,
                                    }}
                                >
                                    {addError ? 'Add failed — retry' : '+ Add row'}
                                </button>
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
            {menu
                ? createPortal(
                      <div
                          // pointerdown, not mousedown: compatibility mouse events can be
                          // suppressed by pointer handling elsewhere (same fix as the
                          // editor's element context menu).
                          onPointerDown={() => setMenu(null)}
                          onContextMenu={(e) => {
                              e.preventDefault();
                              setMenu(null);
                          }}
                          style={{position: 'fixed', inset: 0, zIndex: 10000}}
                      >
                          <div
                              onPointerDown={(e) => e.stopPropagation()}
                              style={{
                                  position: 'fixed',
                                  left: menu.x,
                                  top: menu.y,
                                  zIndex: 10001,
                                  background: '#fff',
                                  borderRadius: 8,
                                  boxShadow: '0 8px 28px rgba(15,23,42,0.22), 0 2px 6px rgba(15,23,42,0.08)',
                                  padding: 4,
                                  width: 220,
                                  fontFamily: 'Inter, sans-serif',
                                  fontSize: 13,
                                  color: '#1d1f25',
                              }}
                          >
                              <div style={{display: 'flex', gap: 8, padding: '8px 8px 6px'}}>
                                  <span style={{color: '#b42318', flex: 'none', paddingTop: 1}}>
                                      <TrashIcon size={16} />
                                  </span>
                                  <span style={{fontSize: 12, lineHeight: 1.35, color: '#475467'}}>
                                      Delete this record? This removes it from the base, not just this
                                      list.
                                  </span>
                              </div>
                              <div style={{display: 'flex', gap: 6, padding: '0 6px 6px', justifyContent: 'flex-end'}}>
                                  <button
                                      type="button"
                                      onClick={() => setMenu(null)}
                                      style={{
                                          padding: '5px 10px',
                                          border: '1px solid rgba(0,0,0,0.15)',
                                          background: '#fff',
                                          cursor: 'pointer',
                                          font: 'inherit',
                                          borderRadius: 6,
                                      }}
                                  >
                                      Cancel
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          const id = menu.id;
                                          setMenu(null);
                                          deleteRow(id);
                                      }}
                                      style={{
                                          padding: '5px 10px',
                                          border: 'none',
                                          background: '#b42318',
                                          color: '#fff',
                                          cursor: 'pointer',
                                          font: 'inherit',
                                          borderRadius: 6,
                                      }}
                                  >
                                      Delete
                                  </button>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}
