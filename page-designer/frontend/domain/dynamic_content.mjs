// Pure helpers for dynamic content: merge-field templating, value formatting, and
// conditional rule evaluation. No SDK/React, so they're unit-testable and shared
// by the render layer and the inspector.

// --- Merge-field templating -------------------------------------------------

// Replace {Field Name} tokens using resolve(name) -> string | null. An unknown
// field returns null and the literal token is kept, so a typo is visible rather
// than silently blank.
export function renderTemplate(text, resolve) {
    if (typeof text !== 'string') {
        return '';
    }
    return text.replace(/\{([^{}]+)\}/g, (match, rawName) => {
        const value = resolve(rawName.trim());
        return value == null ? match : value;
    });
}

// True if the text contains at least one {token}.
export function hasTemplateTokens(text) {
    return typeof text === 'string' && /\{[^{}]+\}/.test(text);
}

// --- Value formatting -------------------------------------------------------

export const NumberFormat = {
    AUTO: 'auto', // use the field's own formatted string
    NUMBER: 'number',
    CURRENCY: 'currency',
    PERCENT: 'percent', // expects a fraction (0.5 -> "50%"), matching percent fields
};

// Percent style multiplies by 100 (0.5 -> "50%"), so it only makes sense on a
// percent field. If a non-percent field carries a stale 'percent' setting (e.g. the
// builder rebound the element to a Number field after choosing Percent), treat it as
// AUTO so the render and the inspector control agree instead of printing "5,000%".
export function effectiveNumberFormat(numberFormat, isPercentField) {
    if (numberFormat === NumberFormat.PERCENT && !isPercentField) {
        return NumberFormat.AUTO;
    }
    return numberFormat || NumberFormat.AUTO;
}

// A designed layout is one artifact viewed/printed by many people in different
// locales; pin re-derived numbers to one locale so every viewer sees identical
// output. (AUTO keeps the base's own formatting via getCellValueAsString.)
const FORMAT_LOCALE = 'en-US';

// Formats a field value. `autoString` is the field's native getCellValueAsString
// (already respects the field's own formatting); NUMBER/CURRENCY/PERCENT re-derive
// from the numeric value. Prefix/suffix always wrap the result.
export function formatValue(raw, format, autoString) {
    const {numberFormat = NumberFormat.AUTO, decimals = null, prefix = '', suffix = '', currencyCode = 'USD'} =
        format || {};
    const base = autoString == null ? '' : String(autoString);
    let core = base;
    if (numberFormat !== NumberFormat.AUTO) {
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^0-9.eE+-]/g, ''));
        if (Number.isFinite(n)) {
            const opts = {};
            if (Number.isFinite(decimals)) {
                opts.minimumFractionDigits = decimals;
                opts.maximumFractionDigits = decimals;
            }
            if (numberFormat === NumberFormat.CURRENCY) {
                opts.style = 'currency';
                opts.currency = currencyCode || 'USD';
            } else if (numberFormat === NumberFormat.PERCENT) {
                opts.style = 'percent';
            }
            core = new Intl.NumberFormat(FORMAT_LOCALE, opts).format(n);
        }
    }
    return `${prefix}${core}${suffix}`;
}

// --- Conditional rules ------------------------------------------------------

export const ConditionOp = {
    NOT_EMPTY: 'notEmpty',
    EMPTY: 'empty',
    EQUALS: 'equals',
    NOT_EQUALS: 'notEquals',
    CONTAINS: 'contains',
    GT: 'gt',
    LT: 'lt',
};

// Ops that don't need a comparison value.
export const VALUELESS_OPS = new Set([ConditionOp.NOT_EMPTY, ConditionOp.EMPTY]);

export const CONDITION_OP_LABELS = {
    [ConditionOp.NOT_EMPTY]: 'is not empty',
    [ConditionOp.EMPTY]: 'is empty',
    [ConditionOp.EQUALS]: 'equals',
    [ConditionOp.NOT_EQUALS]: 'does not equal',
    [ConditionOp.CONTAINS]: 'contains',
    [ConditionOp.GT]: 'greater than',
    [ConditionOp.LT]: 'less than',
};

// Field values arrive as their DISPLAY string (e.g. a currency field is
// "$1,200.00"), so parse a clean number out of common formatting before numeric
// comparisons. Returns null if the whole (stripped) string isn't numeric, so text
// like "5 of 10" isn't mistaken for a number.
function toNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const cleaned = value.replace(/[\s,$€£¥%]/g, '');
    return /^-?\d*\.?\d+$/.test(cleaned) ? parseFloat(cleaned) : null;
}

// Evaluates a condition against a field's value string. A condition with no field
// is treated as "no condition" (passes), so a half-configured rule never hides
// content unexpectedly. equals/greater/less are numeric-aware so they work on
// formatted number/currency/percent fields.
export function evaluateCondition(condition, valueString) {
    if (!condition || !condition.fieldId) {
        return true;
    }
    const v = valueString == null ? '' : String(valueString);
    const target = condition.value == null ? '' : String(condition.value);
    const vNum = toNumber(v);
    const targetNum = toNumber(target);
    const bothNumeric = vNum !== null && targetNum !== null;
    switch (condition.op) {
        case ConditionOp.EMPTY:
            return v.trim() === '';
        case ConditionOp.NOT_EMPTY:
            return v.trim() !== '';
        case ConditionOp.EQUALS:
            return bothNumeric ? vNum === targetNum : v === target;
        case ConditionOp.NOT_EQUALS:
            return bothNumeric ? vNum !== targetNum : v !== target;
        case ConditionOp.CONTAINS:
            return v.toLowerCase().includes(target.toLowerCase());
        case ConditionOp.GT:
            return bothNumeric && vNum > targetNum;
        case ConditionOp.LT:
            return bothNumeric && vNum < targetNum;
        default:
            return true;
    }
}
