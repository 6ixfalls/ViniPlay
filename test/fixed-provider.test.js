const test = require('node:test');
const assert = require('node:assert/strict');
const { loadProvider, clientSettings } = require('../fixed-provider');
const env = { M3U_URL: 'http://private.test/list?token=secret', EPG_URL: 'https://private.test/guide.xml' };

test('startup requires HTTP(S) feeds and a bounded refresh interval', () => {
    for (const key of ['M3U_URL', 'EPG_URL']) {
        for (const value of [undefined, '', '/local/file', 'file:///etc/passwd', 'ftp://example.test/list']) assert.throws(() => loadProvider({ ...env, [key]: value }), new RegExp(key));
    }
    for (const value of ['0', '-1', 'NaN', 'Infinity', '597']) assert.throws(() => loadProvider({ ...env, SOURCE_REFRESH_HOURS: value }), /SOURCE_REFRESH_HOURS/);
    assert.equal(loadProvider(env).refreshHours, 24);
    assert.equal(loadProvider({ ...env, SOURCE_REFRESH_HOURS: '0.5' }).refreshHours, 0.5);
});
test('client configuration exposes fixed proxy profiles without provider URLs or persistence settings', () => {
    const settings = clientSettings('2026-11-19T00:00:00Z');
    assert.equal(settings.activeStreamProfileId, 'proxy-default');
    assert.equal(settings.castProfiles[0].command, 'server-mp4');
    assert.ok(settings.streamProfiles.every(profile => profile.command !== 'redirect'));
    for (const key of ['forceProxy', 'directPlayEnabled', 'vodDirectPlayEnabled', 'dvr', 'generatedSessionSecret']) assert.ok(!(key in settings));
    assert.ok(!JSON.stringify(settings).includes('private.test'));
    assert.equal(settings.sourcesLastUpdated, '2026-11-19T00:00:00Z');
});
