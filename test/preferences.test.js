const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const preferences = import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../public/js/modules/preferences.js')).toString('base64'));
function storage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }

test('browser preferences survive reloads and cannot override provider or proxy configuration', async () => {
    const { readPreferences, writePreference } = await preferences;
    const browser = storage();
    writePreference('favorites', ['news'], browser);
    writePreference('multiviewLayouts', [{ id: 'layout', name: 'News', layout_data: [] }], browser);
    assert.deepEqual(readPreferences(browser).favorites, ['news']);
    assert.equal(readPreferences(browser).multiviewLayouts[0].id, 'layout');
    assert.throws(() => writePreference('streamProfiles', [], browser));
    assert.throws(() => writePreference('forceProxy', false, browser));
    browser.setItem('viniplay_preferences', '{"favorites":["news"],"activeStreamProfileId":"redirect"}');
    assert.deepEqual(readPreferences(browser), { favorites: ['news'] });
});
test('unavailable or malformed browser storage does not prevent live playback', async () => {
    const { readPreferences } = await preferences;
    assert.deepEqual(readPreferences({ getItem() { throw new Error('Denied'); } }), {});
    assert.deepEqual(readPreferences({ getItem: () => '{broken' }), {});
});
