import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderTemplate} from './dynamic_content.mjs';

test('renderTemplate substitutes known tokens and keeps unknown ones', () => {
    const values = {Client: 'Acme', 'Invoice ID': '1007'};
    const resolve = (name) => (name in values ? values[name] : null);
    assert.equal(renderTemplate('Hi {Client} — #{Invoice ID}', resolve), 'Hi Acme — #1007');
    // Unknown field stays literal so a typo is visible.
    assert.equal(renderTemplate('{Nope}', resolve), '{Nope}');
    assert.equal(renderTemplate('', resolve), '');
});
