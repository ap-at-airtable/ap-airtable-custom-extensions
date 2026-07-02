// Single-select rendered as an ordered stepper (Airtable's SELECT_STEPPER
// interface element): the field's choices laid out with connector lines. The
// selected step is drawn in that choice's own color (matching its label token);
// everything else is a neutral gray. Two variants: 'radio' (dot) and 'number'
// (numbered circle). Interactive when onChange is given (click to set the value).

import {colorUtils} from '@airtable/blocks/interface/ui';
import {ChoicePill, choiceColorName} from './select_pill.js';

const RAIL = '#dfe1e5'; // connectors + inactive outlines
const SOFT = '#f2f4f8'; // inactive circle fill (a hint of gray, not stark white)
const TEXT = '#8a8f98'; // non-selected labels + numbers

// Dark vs light text for a circle filled with the selected choice color.
function readableOn(hex) {
    if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return '#ffffff';
    const n = parseInt(hex.slice(1, 7), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1d1f25' : '#ffffff';
}

function Circle({variant, index, active, color}) {
    const border = `2px solid ${active ? color : RAIL}`;
    if (variant === 'number') {
        return (
            <span
                style={{
                    flex: 'none',
                    width: '1.7em',
                    height: '1.7em',
                    borderRadius: '50%',
                    border,
                    backgroundColor: active ? color : SOFT,
                    color: active ? readableOn(color) : TEXT,
                    fontSize: '0.8em',
                    fontWeight: active ? 600 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                }}
            >
                {index + 1}
            </span>
        );
    }
    return (
        <span
            style={{
                flex: 'none',
                width: '1.5em',
                height: '1.5em',
                borderRadius: '50%',
                border,
                backgroundColor: SOFT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {active ? (
                <span style={{width: '0.72em', height: '0.72em', borderRadius: '50%', backgroundColor: color}} />
            ) : null}
        </span>
    );
}

export function SelectStepper({field, record, css, variant = 'radio', onChange, saving}) {
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    const current = record ? record.getCellValue(field) : null;
    const currentIndex = current ? choices.findIndex((c) => c.id === current.id) : -1;
    const interactive = typeof onChange === 'function';
    const last = choices.length - 1;

    // The selected step's color is the selected choice's own color (matches its pill).
    const selectedName = current ? choiceColorName(field, current) : null;
    const activeColor = (selectedName && colorUtils.getHexForColor(selectedName)) || '#2d7ff9';

    return (
        <div
            style={{
                ...css,
                display: 'flex',
                alignItems: 'flex-start',
                width: '100%',
                opacity: saving ? 0.7 : 1,
            }}
        >
            {choices.map((choice, i) => {
                const active = i === currentIndex;
                const step = (
                    <>
                        <div style={{display: 'flex', alignItems: 'center', width: '100%'}}>
                            <span style={{flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : RAIL}} />
                            <Circle variant={variant} index={i} active={active} color={activeColor} />
                            <span style={{flex: 1, height: 2, backgroundColor: i === last ? 'transparent' : RAIL}} />
                        </div>
                        <div style={{marginTop: '0.35em', maxWidth: '100%', textAlign: 'center'}}>
                            {active ? (
                                <ChoicePill field={field} choice={choice} css={css} />
                            ) : (
                                <span
                                    style={{
                                        color: TEXT,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'block',
                                    }}
                                >
                                    {choice.name}
                                </span>
                            )}
                        </div>
                    </>
                );
                const col = {
                    flex: '1 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                };
                return interactive ? (
                    <div
                        key={choice.id}
                        role="button"
                        tabIndex={0}
                        aria-label={choice.name}
                        aria-current={active ? 'step' : undefined}
                        onClick={() => onChange(choice.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onChange(choice.id);
                            }
                        }}
                        style={{...col, cursor: 'pointer'}}
                    >
                        {step}
                    </div>
                ) : (
                    <div key={choice.id} style={col}>
                        {step}
                    </div>
                );
            })}
        </div>
    );
}
