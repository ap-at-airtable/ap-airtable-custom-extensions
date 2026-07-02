// Colored select/choice pill (chip), shared by the read-only renderer and the
// inline editor. Matches Airtable's record-detail choice token: pill shape, the
// choice color as background, contrast text from the SDK's own
// shouldUseLightTextOnColor. (Ref: hyperbase choice_token.tsx — border-radius
// 9999px, ~10px/4px padding at 13px, line-height ~1.5, auto light/dark text.)

import {colorUtils} from '@airtable/blocks/interface/ui';

// The choice's stored color name — from the cell value, else the field's config.
export function choiceColorName(field, choice) {
    if (choice.color) return choice.color;
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    const match = choices.find((c) => c.id === choice.id) || choices.find((c) => c.name === choice.name);
    return (match && match.color) || null;
}

export function ChoicePill({field, choice, css}) {
    const colorName = choiceColorName(field, choice);
    const bg = (colorName && colorUtils.getHexForColor(colorName)) || '#eceef1';
    const light = colorName ? colorUtils.shouldUseLightTextOnColor(colorName) : false;
    return (
        <span
            style={{
                display: 'inline-block',
                backgroundColor: bg,
                color: light ? '#ffffff' : '#1d1f25',
                borderRadius: 9999,
                // Airtable's token proportions (10px/4px at 13px), in em so it scales
                // with the element's font size.
                padding: '0.3em 0.72em',
                fontSize: css.fontSize,
                fontFamily: css.fontFamily,
                fontWeight: 400,
                lineHeight: 1.45,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
        >
            {choice.name}
        </span>
    );
}
