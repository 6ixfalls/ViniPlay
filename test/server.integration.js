const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('live server proxies fixed feeds and playback without persistent server state', { skip: !process.env.VINIPLAY_INTEGRATION, timeout: 30000 }, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viniplay-integration-'));
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    // A deterministic FFmpeg stand-in exercises the transport boundary without
    // requiring codecs or GPU drivers on the test host.
    fs.writeFileSync(path.join(bin, 'ffmpeg'), `#!${process.execPath}
const http = require('node:http');
const zlib = require('node:zlib');
const args = process.argv.slice(2);
http.get(args[args.indexOf('-i') + 1], response => response.pipe(process.stdout));
`, { mode: 0o755 });
    const hits = {};
    let base;
    const upstream = http.createServer((req, res) => {
        hits[req.url] = (hits[req.url] || 0) + 1;
        if (req.url === '/playlist?secret=private') return res.end(`#EXTM3U\n#EXTINF:-1 tvg-id="test" tvg-name="Test" group-title="News",Test\n${base}/live.ts\n`);
        if (req.url === '/guide?secret=private') { res.setHeader('Content-Encoding', 'gzip'); return res.end(zlib.gzipSync('<?xml version="1.0"?><tv><programme channel="test" start="20261118000000 +0000" stop="20261119000000 +0000"><title>Test show</title></programme></tv>')); }
        if (req.url === '/live.ts') return res.end('proxied-stream-payload');
        res.writeHead(404).end();
    });
    t.after(() => { upstream.closeAllConnections(); upstream.close(); });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${upstream.address().port}`;
    const child = spawn(process.execPath, [path.resolve(__dirname, '../server.js')], {
        cwd: dir,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, M3U_URL: `${base}/playlist?secret=private`, EPG_URL: `${base}/guide?secret=private` },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let logs = '';
    child.stdout.on('data', data => logs += data);
    child.stderr.on('data', data => logs += data);
    t.after(async () => {
        if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
        fs.rmSync(dir, { recursive: true, force: true });
    });
    await new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if (logs.includes('server listening')) { clearInterval(timer); resolve(); }
            else if (child.exitCode !== null) { clearInterval(timer); reject(new Error(logs)); }
        }, 50);
        setTimeout(() => { clearInterval(timer); reject(new Error('Startup timed out\n' + logs)); }, 15000).unref();
    });
    const app = 'http://127.0.0.1:8998';
    const get = async route => {
        const response = await fetch(app + route);
        assert.equal(response.status, 200, `${route}: ${logs}`);
        assert.equal(response.headers.get('set-cookie'), null);
        return response.json();
    };
    const config = await get('/api/config');
    assert.ok(config.m3uContent.includes('fixed-m3u_test'));
    assert.ok(config.epgContent['fixed-m3u_test']);
    assert.ok(!JSON.stringify(config.settings).includes('secret=private'));
    assert.ok(!('forceProxy' in config.settings));
    for (const route of ['/api/auth/status', '/api/users', '/api/admin/activity', '/api/settings/export', '/api/sources', '/api/preferences', '/api/progress/movie/1', '/api/multiview/layouts', '/api/dvr/jobs', '/api/notifications', '/api/vod/library']) {
        assert.equal((await fetch(app + route)).status, 404, route);
    }
    for (const route of ['/api/auth/setup-admin', '/api/sources', '/api/save/settings', '/api/user/settings', '/api/cast/generate-token', '/api/preferences', '/api/notifications', '/api/dvr/schedule']) {
        assert.equal((await fetch(app + route, { method: 'POST' })).status, 404, route);
    }
    const probe = await fetch(app + `/stream?url=${encodeURIComponent(base + '/live.ts')}`, { method: 'HEAD' });
    assert.equal(probe.status, 200);
    assert.equal(hits['/live.ts'], undefined);
    const stream = await fetch(app + `/stream?url=${encodeURIComponent(base + '/live.ts')}`, { redirect: 'manual' });
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get('location'), null);
    assert.equal(await stream.text(), 'proxied-stream-payload');
    assert.equal((await fetch(app + `/stream?url=${encodeURIComponent(base + '/live.ts')}&profileId=redirect`)).status, 404);
    assert.equal((await fetch(app + '/stream?url=http://unconfigured.test/private')).status, 404);
    assert.ok(hits['/playlist?secret=private'] >= 1 && hits['/guide?secret=private'] >= 1 && hits['/live.ts'] >= 1);
    assert.deepEqual(fs.readdirSync(dir), ['bin']);
});
