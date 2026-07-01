import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    renderTemplate,
    hasTemplateTokens,
    formatValue,
    NumberFormat,
    ConditionOp,
    evaluateCondition,
    effectiveNumberFormat,
} from './dynamic_content.mjs';

test('renderTemplate substitutes known tokens and keeps unknown ones', () => {
    const values = {Client: 'Acme', 'Invoice ID': '1007'};
    const resolve = (name) => (name in values ? values[name] : null);
    assert.equal(renderTemplate('Hi {Client} — #{Invoice ID}', resolve), 'Hi Acme — #1007');
    // Unknown field stays literal so a typo is visible.
    assert.equal(renderTemplate('{Nope}', resolve), '{Nope}');
    assert.equal(renderTemplate('', resolve), '');
});

test('hasTemplateTokens detects braces', () => {
    assert.equal(hasTemplateTokens('a {b} c'), true);
    assert.equal(hasTemplateTokens('plain'), false);
    assert.equal(hasTemplateTokens(null), false);
});

test('formatValue: auto passes the field string through', () => {
    assert.equal(formatValue(1234.5, {numberFormat: NumberFormat.AUTO}, '$1,234.50'), '$1,234.50');
});

test('formatValue: number + decimals + prefix/suffix', () => {
    assert.equal(
        formatValue(1234.5, {numberFormat: NumberFormat.NUMBER, decimals: 0, suffix: ' kg'}, 'ignored'),
        '1,235 kg',
    );
});

test('formatValue: currency', () => {
    assert.equal(
        formatValue(1234.5, {numberFormat: NumberFormat.CURRENCY, decimals: 2, currencyCode: 'USD'}, ''),
        '$1,234.50',
    );
});

test('formatValue: percent renders a stored fraction as a percentage', () => {
    // Percent fields store 0.5 for 50%; the percent style handles the *100.
    assert.equal(formatValue(0.5, {numberFormat: NumberFormat.PERCENT}, '50%'), '50%');
    assert.equal(formatValue(0.1234, {numberFormat: NumberFormat.PERCENT, decimals: 1}, ''), '12.3%');
});

test('formatValue: non-numeric falls back to the auto string', () => {
    assert.equal(formatValue('n/a', {numberFormat: NumberFormat.NUMBER}, 'n/a'), 'n/a');
});

test('formatValue: re-derived numbers use a fixed locale (viewer-independent)', () => {
    // Pinned to en-US so every viewer prints identical grouping/decimals.
    assert.equal(formatValue(1234567.5, {numberFormat: NumberFormat.NUMBER, decimals: 2}, ''), '1,234,567.50');
});

test('effectiveNumberFormat degrades a stale percent on a non-percent field', () => {
    assert.equal(effectiveNumberFormat(NumberFormat.PERCENT, false), NumberFormat.AUTO);
    assert.equal(effectiveNumberFormat(NumberFormat.PERCENT, true), NumberFormat.PERCENT);
    assert.equal(effectiveNumberFormat(NumberFormat.CURRENCY, false), NumberFormat.CURRENCY);
    assert.equal(effectiveNumberFormat(undefined, false), NumberFormat.AUTO);
});

test('evaluateCondition operators', () => {
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.EQUALS, value: 'Paid'}, 'Paid'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.NOT_EQUALS, value: 'Paid'}, 'Due'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.CONTAINS, value: 'ov'}, 'Overdue'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.EMPTY}, ''), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.NOT_EMPTY}, 'x'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.GT, value: '10'}, '20'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.LT, value: '10'}, '20'), false);
});

test('evaluateCondition with no field passes (half-configured rule is inert)', () => {
    assert.equal(evaluateCondition(null, 'x'), true);
    assert.equal(evaluateCondition({op: ConditionOp.EQUALS, value: 'a'}, 'b'), true);
});

test('evaluateCondition is numeric-aware on formatted number/currency/percent fields', () => {
    // The field arrives formatted; the typed value is a plain number.
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.GT, value: '1000'}, '$1,200.00'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.LT, value: '1000'}, '$1,200.00'), false);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.EQUALS, value: '1200'}, '$1,200.00'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.EQUALS, value: '50'}, '50%'), true);
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.NOT_EQUALS, value: '1200'}, '$1,200.00'), false);
    // gt/lt on non-numeric text is false, not a NaN surprise.
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.GT, value: '5'}, 'hello'), false);
    // "5 of 10" is not treated as a number.
    assert.equal(evaluateCondition({fieldId: 'f', op: ConditionOp.EQUALS, value: '510'}, '5 of 10'), false);
});
