// Tailwind UI primitives that replace the (unavailable) @airtable/blocks/ui
// component library. Refined, consistent sizing; dependency-free; dark-mode aware.

import {useId, useState, useEffect, cloneElement, isValidElement} from 'react';
import {CloseIcon} from './icons.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');

// Shared field styling: 32px tall, soft border, light-blue focus ring.
const FIELD =
    'w-full h-8 rounded-md border border-gray-gray200 bg-white px-2.5 text-sm text-gray-gray700 ' +
    'placeholder:text-gray-gray500 transition-colors ' +
    'focus:outline-none focus:border-blue-blue focus:ring-2 focus:ring-blue-blueLight1 ' +
    'dark:border-gray-gray600 dark:bg-gray-gray800 dark:text-gray-gray100 dark:focus:ring-blue-blueDark1';

function ChevronDown({className}) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export function Button({variant = 'default', size = 'md', icon: Icon, children, className, ...rest}) {
    const base =
        'inline-flex select-none items-center justify-center gap-1.5 rounded-md font-medium transition-all ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-blueLight1 ' +
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none';
    const sizes = {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
    };
    const variants = {
        default:
            'border border-gray-gray200 bg-white text-gray-gray700 shadow-xs hover:bg-gray-gray50 hover:border-gray-gray300 active:bg-gray-gray100 ' +
            'dark:border-gray-gray600 dark:bg-gray-gray700 dark:text-gray-gray100 dark:hover:bg-gray-gray600',
        primary: 'bg-blue-blue text-white shadow-sm hover:bg-blue-blueDark1 active:bg-blue-blueDark1',
        danger: 'bg-red-red text-white shadow-sm hover:opacity-90',
        ghost: 'text-gray-gray600 hover:bg-gray-gray100 dark:text-gray-gray300 dark:hover:bg-gray-gray700',
    };
    return (
        <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest}>
            {Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
            {children}
        </button>
    );
}

export function IconButton({icon: Icon, label, active, size = 16, className, ...rest}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={cx(
                'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-blueLight1 disabled:opacity-40 disabled:cursor-not-allowed',
                active
                    ? 'bg-blue-blueLight2 text-blue-blueDark1 dark:bg-blue-blueDark1 dark:text-white'
                    : 'text-gray-gray500 hover:bg-gray-gray100 hover:text-gray-gray700 dark:text-gray-gray300 dark:hover:bg-gray-gray700',
                className,
            )}
            {...rest}
        >
            <Icon size={size} />
        </button>
    );
}

export function TextInput({value, onChange, className, ...rest}) {
    return (
        <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cx(FIELD, className)}
            {...rest}
        />
    );
}

export function TextArea({value, onChange, rows = 3, className, ...rest}) {
    return (
        <textarea
            value={value ?? ''}
            rows={rows}
            onChange={(e) => onChange(e.target.value)}
            className={cx(
                FIELD.replace('h-8', 'min-h-[64px] py-1.5'),
                'resize-y leading-snug',
                className,
            )}
            {...rest}
        />
    );
}

function Caret({up}) {
    return (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
        </svg>
    );
}

export function NumberInput({id, value, onChange, min, max, step = 1, suffix, className}) {
    const clamp = (n) => {
        let v = n;
        if (typeof min === 'number') v = Math.max(min, v);
        if (typeof max === 'number') v = Math.min(max, v);
        return v;
    };
    // Keep a local draft while typing so intermediate keystrokes aren't clamped —
    // e.g. typing "20" when min is 6 would otherwise snap "2" to 6. Commit (parse +
    // clamp) on blur/Enter; resync from the prop whenever we're not being edited.
    const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : '');
    const [focused, setFocused] = useState(false);
    useEffect(() => {
        if (!focused) setDraft(Number.isFinite(value) ? String(value) : '');
    }, [value, focused]);
    const commit = () => {
        const n = parseFloat(draft);
        if (!Number.isNaN(n)) onChange(clamp(n));
        setFocused(false); // resyncs the draft to the committed (clamped) value
    };
    const stepBy = (dir) => onChange(clamp((Number.isFinite(value) ? value : 0) + dir * step));
    const stepBtn =
        'flex h-[13px] w-4 items-center justify-center text-gray-gray400 hover:text-gray-gray700 dark:hover:text-gray-gray100';
    return (
        <div className={cx('relative flex items-center', className)}>
            <input
                id={id}
                type="number"
                value={draft}
                min={min}
                max={max}
                step={step}
                onFocus={() => setFocused(true)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        commit();
                        e.currentTarget.blur();
                    }
                }}
                className={cx(
                    FIELD,
                    suffix ? 'pr-12' : 'pr-7',
                    'tabular-nums',
                    // Hide the native spinners; a custom always-visible stepper replaces
                    // them (below) so it can sit clear of the suffix.
                    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                )}
            />
            {suffix ? (
                <span className="pointer-events-none absolute right-7 text-xs text-gray-gray500 dark:text-gray-gray400">
                    {suffix}
                </span>
            ) : null}
            <div className="absolute right-1 flex flex-col">
                <button type="button" tabIndex={-1} aria-label="Increase" onClick={() => stepBy(1)} className={stepBtn}>
                    <Caret up />
                </button>
                <button type="button" tabIndex={-1} aria-label="Decrease" onClick={() => stepBy(-1)} className={stepBtn}>
                    <Caret />
                </button>
            </div>
        </div>
    );
}

export function Select({id, value, options, onChange, placeholder, className}) {
    return (
        <div className={cx('relative', className)}>
            <select
                id={id}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className={cx(FIELD, 'cursor-pointer appearance-none pr-8')}
            >
                {placeholder ? (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                ) : null}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-gray400" />
        </div>
    );
}

export function Toggle({checked, onChange, label}) {
    return (
        <label className="flex cursor-pointer select-none items-center justify-between gap-2 text-sm text-gray-gray700 dark:text-gray-gray200">
            {label ? <span>{label}</span> : null}
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={cx(
                    'relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-blueLight1',
                    checked ? 'bg-blue-blue' : 'bg-gray-gray300 dark:bg-gray-gray600',
                )}
            >
                <span
                    // Pin left explicitly; without it the knob inherits the button's
                    // centered static position and translate pushes it past the track.
                    className={cx(
                        'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                        checked ? 'translate-x-4' : 'translate-x-0',
                    )}
                />
            </button>
        </label>
    );
}

// Segmented control: options = [{value, label?, icon?, title?}]. Extra props
// (e.g. aria-labelledby from Field) are spread onto the radiogroup for naming.
export function Segmented({value, options, onChange, className, label, ...rest}) {
    return (
        <div
            {...rest}
            role="radiogroup"
            aria-label={label}
            className={cx(
                'inline-flex rounded-full bg-gray-gray100 p-0.5 dark:bg-gray-gray700',
                className,
            )}
        >
            {options.map((opt) => {
                const active = opt.value === value;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        // Icon-only options need a title/aria-label for their name; a
                        // labeled option already shows its text, so a title there just
                        // pops a redundant native tooltip echoing the visible label.
                        title={opt.label ? undefined : opt.title}
                        aria-label={opt.label ? undefined : opt.title}
                        onClick={() => onChange(opt.value)}
                        className={cx(
                            'flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-all',
                            active
                                ? 'bg-white text-gray-gray700 shadow-xs dark:bg-gray-gray900 dark:text-white'
                                : 'text-gray-gray500 hover:text-gray-gray700 dark:text-gray-gray400 dark:hover:text-gray-gray200',
                        )}
                    >
                        {Icon ? <Icon size={14} /> : null}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

export function ColorInput({value, onChange, className, ...rest}) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    // The native picker only holds hex; it opens at black for non-hex values.
    const safe = trimmed.startsWith('#') ? trimmed : '#000000';
    // Show the real color (hex or named) as an overlay; when there's no color
    // ("transparent"/empty) the checkerboard shows through instead of a fake-black
    // swatch that made transparent look like a black background.
    const hasColor = trimmed !== '' && trimmed !== 'transparent';
    return (
        <div className={cx('flex items-center gap-2', className)}>
            <div
                className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-gray-gray200 dark:border-gray-gray600"
                style={{
                    background:
                        'repeating-conic-gradient(#c4c7cd 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px',
                }}
            >
                {hasColor ? (
                    <div className="absolute inset-0" style={{backgroundColor: trimmed}} />
                ) : null}
                <input
                    type="color"
                    value={safe}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label="Pick color"
                    className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-0 bg-transparent p-0 opacity-0"
                />
            </div>
            <input
                {...rest}
                type="text"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className={cx(FIELD, 'flex-1 font-mono text-xs')}
            />
            {hasColor ? (
                <button
                    type="button"
                    onClick={() => onChange('transparent')}
                    title="Reset to transparent"
                    aria-label="Reset to transparent"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-gray500 hover:bg-gray-gray100 hover:text-gray-gray700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-blueLight1 dark:text-gray-gray400 dark:hover:bg-gray-gray700"
                >
                    <CloseIcon size={14} />
                </button>
            ) : null}
        </div>
    );
}

export function Field({label, children, hint}) {
    // Associate the label with the control so screen readers announce it. Simple
    // inputs consume `id` (label htmlFor matches); composite controls (Segmented,
    // ColorInput) consume `aria-labelledby`. Only emit htmlFor when we actually
    // injected an id, so it never dangles (e.g. multi-child fields).
    const id = useId();
    const labelId = `${id}-label`;
    const injected = isValidElement(children) && !!label;
    const child = injected
        ? cloneElement(children, {id, 'aria-labelledby': labelId})
        : children;
    return (
        <div className="space-y-1.5">
            {label ? (
                <label
                    id={labelId}
                    htmlFor={injected ? id : undefined}
                    className="block text-xs font-medium text-gray-gray500 dark:text-gray-gray400"
                >
                    {label}
                </label>
            ) : null}
            {child}
            {hint ? (
                <div className="text-[11px] leading-snug text-gray-gray500 dark:text-gray-gray400">
                    {hint}
                </div>
            ) : null}
        </div>
    );
}

export function Row({children, className}) {
    return <div className={cx('flex items-center gap-2', className)}>{children}</div>;
}

export function SectionHeader({children}) {
    return (
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-gray500 dark:text-gray-gray400">
            {children}
        </div>
    );
}

// Collapsible accordion section. Keeps the inspector short as capability grows:
// only the sections a user opens take vertical space.
export function Section({title, defaultOpen = false, children}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-t border-gray-gray100 first:border-t-0 dark:border-gray-gray700">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-blueLight1"
            >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-gray500 dark:text-gray-gray400">
                    {title}
                </span>
                <ChevronDown
                    className={cx('text-gray-gray400 transition-transform', open ? '' : '-rotate-90')}
                />
            </button>
            {open ? <div className="space-y-2 pb-3">{children}</div> : null}
        </div>
    );
}
