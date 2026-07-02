// Static (non-editable) renderers for field types that show a glyph rather than
// text: rating stars and checkbox. Used in view/print/present and the editor
// preview so they match Airtable's display (and the inline editor's own glyphs).

import {colorUtils} from '@airtable/blocks/interface/ui';

export const RATING_GLYPH = {star: '★', heart: '♥', thumbsUp: '👍', flag: '⚑'};

const RATING_EMPTY = 'rgba(15,23,42,0.18)';

export function RatingDisplay({field, record, css}) {
    const opts = (field.config && field.config.options) || {};
    const max = opts.max || 5;
    const glyph = RATING_GLYPH[opts.icon] || '★';
    const value = record ? Number(record.getCellValue(field)) || 0 : 0;
    const color = opts.color ? colorUtils.getHexForColor(opts.color) : '#fcb400';
    return (
        <div style={{...css, display: 'flex', gap: '0.1em'}} role="img" aria-label={`${value} of ${max}`}>
            {Array.from({length: max}, (_, i) => i + 1).map((n) => (
                <span key={n} style={{color: n <= value ? color : RATING_EMPTY}}>
                    {glyph}
                </span>
            ))}
        </div>
    );
}

export function CheckboxDisplay({field, record, css}) {
    const opts = (field.config && field.config.options) || {};
    const checked = record ? !!record.getCellValue(field) : false;
    const color = opts.color ? colorUtils.getHexForColor(opts.color) : '#2d7ff9';
    return (
        <div style={{...css, display: 'flex', alignItems: 'center'}}>
            <input
                type="checkbox"
                checked={checked}
                readOnly
                aria-label={field.name}
                style={{width: '1em', height: '1em', accentColor: color, pointerEvents: 'none'}}
            />
        </div>
    );
}
