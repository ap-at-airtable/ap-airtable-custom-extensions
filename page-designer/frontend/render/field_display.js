// Static (non-editable) renderers for field types that show a glyph rather than
// text: rating stars and checkbox. Used in view/print/present and the editor
// preview so they match Airtable's display (and the inline editor's own glyphs).

import {colorUtils} from '@airtable/blocks/interface/ui';

export const RATING_GLYPH = {star: '★', heart: '♥', thumbsUp: '👍', flag: '⚑'};

const RATING_EMPTY = 'rgba(15,23,42,0.18)';

// These renderers are flex containers, so the element's textAlign can't position
// their content — map it to justify-content instead (honor Horizontal align).
const JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};
const justifyFor = (css) => JUSTIFY[css && css.textAlign] || 'flex-start';

export function RatingDisplay({field, record, css}) {
    const opts = (field.config && field.config.options) || {};
    const max = opts.max || 5;
    const glyph = RATING_GLYPH[opts.icon] || '★';
    const value = record ? Number(record.getCellValue(field)) || 0 : 0;
    const color = opts.color ? colorUtils.getHexForColor(opts.color) : '#fcb400';
    return (
        <div
            style={{...css, display: 'flex', gap: '0.1em', justifyContent: justifyFor(css)}}
            role="img"
            aria-label={`${value} of ${max}`}
        >
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
        <div style={{...css, display: 'flex', alignItems: 'center', justifyContent: justifyFor(css)}}>
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

// Airtable's default avatars are colored by the person; mirror that with a hashed
// palette so a collaborator with no profile pic still gets a stable color.
const AVATAR_COLORS = ['#2d7ff9', '#18bfff', '#20c933', '#fcb400', '#f82b60', '#8b46ff', '#ff6f2c', '#20d9d2'];
function avatarColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Profile-pic circle (or a colored initial when there's no pic), matching how
// Airtable shows collaborators. Size is a CSS length so it scales with the font.
export function CollaboratorAvatar({person, size = '1.35em'}) {
    const label = (person && (person.name || person.email)) || '';
    const common = {
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    };
    if (person && person.profilePicUrl) {
        return <img src={person.profilePicUrl} alt="" style={{...common, objectFit: 'cover'}} />;
    }
    return (
        <span
            style={{
                ...common,
                backgroundColor: avatarColor(label),
                color: '#ffffff',
                fontSize: '0.62em',
                fontWeight: 600,
            }}
        >
            {label.trim().charAt(0).toUpperCase() || '?'}
        </span>
    );
}

// Read-only collaborator display: avatar + name chips (single or multiple),
// matching Airtable's people cell.
export function CollaboratorDisplay({field, record, css}) {
    const raw = record ? record.getCellValue(field) : null;
    const people = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    if (!people.length) return <div style={css}>{record ? '' : field.name}</div>;
    return (
        <div
            style={{
                ...css,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5em',
                justifyContent: justifyFor(css),
            }}
        >
            {people.map((p, i) => (
                <span key={p.id || i} style={{display: 'inline-flex', alignItems: 'center', gap: '0.35em', maxWidth: '100%'}}>
                    <CollaboratorAvatar person={p} />
                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {p.name || p.email}
                    </span>
                </span>
            ))}
        </div>
    );
}
