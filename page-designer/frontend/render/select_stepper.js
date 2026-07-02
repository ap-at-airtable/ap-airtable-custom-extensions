// Single-select rendered as an ordered stepper (Airtable's SELECT_STEPPER
// interface element): the field's choices laid out in sequence with connector
// lines, the current value highlighted and everything before it "completed".
// Two variants: 'radio' (dot) and 'number' (numbered circle). Interactive when
// onChange is given (click a step to set the value), else read-only. The accent
// (done/active) and track (pending) colors are builder-settable.

import {ChoicePill} from './select_pill.js';

export const STEPPER_ACCENT = '#2d7ff9';
export const STEPPER_TRACK = '#cfd0d3';
const QUIET = '#8a8f98';

// Dark vs light text for a numbered circle filled with the accent color.
function readableOn(hex) {
    if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return '#ffffff';
    const n = parseInt(hex.slice(1, 7), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1d1f25' : '#ffffff';
}

// The current step uses the accent color; every other step uses the track color,
// so both colors are visible at any value (including the last step).
function Circle({variant, index, active, accent, track}) {
    const border = `2px solid ${active ? accent : track}`;
    if (variant === 'number') {
        return (
            <span
                style={{
                    flex: 'none',
                    width: '1.7em',
                    height: '1.7em',
                    borderRadius: '50%',
                    border,
                    backgroundColor: active ? accent : '#ffffff',
                    color: active ? readableOn(accent) : track,
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
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {active ? (
                <span style={{width: '0.72em', height: '0.72em', borderRadius: '50%', backgroundColor: accent}} />
            ) : null}
        </span>
    );
}

export function SelectStepper({
    field,
    record,
    css,
    variant = 'radio',
    accent = STEPPER_ACCENT,
    track = STEPPER_TRACK,
    onChange,
    saving,
}) {
    const choices = (field.config && field.config.options && field.config.options.choices) || [];
    const current = record ? record.getCellValue(field) : null;
    const currentIndex = current ? choices.findIndex((c) => c.id === current.id) : -1;
    const interactive = typeof onChange === 'function';
    const last = choices.length - 1;

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
                            {/* The rail is always the track color; progress shows via the
                                circles (accent). So the track color is visible at any value. */}
                            <span
                                style={{
                                    flex: 1,
                                    height: 2,
                                    backgroundColor: i === 0 ? 'transparent' : track,
                                }}
                            />
                            <Circle variant={variant} index={i} active={active} accent={accent} track={track} />
                            <span
                                style={{
                                    flex: 1,
                                    height: 2,
                                    backgroundColor: i === last ? 'transparent' : track,
                                }}
                            />
                        </div>
                        <div style={{marginTop: '0.35em', maxWidth: '100%', textAlign: 'center'}}>
                            {active ? (
                                <ChoicePill field={field} choice={choice} css={css} />
                            ) : (
                                <span
                                    style={{
                                        color: QUIET,
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
