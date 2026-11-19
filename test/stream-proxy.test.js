const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { proxyStream } = require('../stream-proxy');

test('byte proxy follows redirects, forwards ranges and identity, and hides upstream errors', async t => {
    const payload = Buffer.from([0x47, 0, 255, 23, 0, 0x47]);
    const upstream = http.createServer((req, res) => {
        if (req.url === '/redirect') return res.writeHead(302, { Location: '/live' }).end();
        if (req.url === '/loop') return res.writeHead(302, { Location: '/loop' }).end();
        if (req.url === '/failure') return res.writeHead(403).end('private upstream details');
        assert.equal(req.headers['user-agent'], 'TestBrowser');
        assert.equal(req.headers['accept-encoding'], 'identity');
        assert.equal(req.headers.range, 'bytes=0-5');
        res.writeHead(206, { 'Content-Type': 'video/mp2t', 'Content-Range': 'bytes 0-5/6' });
        res.end(payload);
    });
    const app = express();
    let base;
    app.get('/:route', (req, res) => proxyStream(base + req.path, req, res, 'TestBrowser'));
    const proxy = http.createServer(app);
    t.after(() => { for (const server of [proxy, upstream]) { server.closeAllConnections(); server.close(); } });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${upstream.address().port}`;
    const local = `http://127.0.0.1:${proxy.address().port}`;
    const response = await fetch(local + '/redirect', { headers: { Range: 'bytes=0-5' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-type'), 'video/mp2t');
    assert.equal(response.headers.get('content-range'), 'bytes 0-5/6');
    assert.equal(response.headers.get('location'), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload);
    for (const route of ['/failure', '/loop']) {
        const failed = await fetch(local + route);
        assert.equal(failed.status, 502);
        assert.equal(await failed.text(), 'The upstream stream could not be played.');
    }
});

test('an unfinished redirect is closed while the final stream stays playable', { timeout: 5000 }, async t => {
    let closeRedirect, closeLive, liveResponse;
    const redirectClosed = new Promise(resolve => { closeRedirect = resolve; });
    const liveClosed = new Promise(resolve => { closeLive = resolve; });
    const upstream = http.createServer((req, res) => {
        if (req.url === '/redirect') {
            res.on('close', closeRedirect);
            res.writeHead(302, { Location: '/live' });
            res.write('unfinished redirect body');
            return;
        }
        liveResponse = res;
        res.on('close', closeLive);
        res.writeHead(200, { 'Content-Type': 'video/mp2t' });
        res.write('first');
    });
    const app = express();
    app.get('/', (req, res) => proxyStream(`http://127.0.0.1:${upstream.address().port}/redirect`, req, res));
    const proxy = http.createServer(app);
    t.after(() => { for (const server of [proxy, upstream]) { server.closeAllConnections(); server.close(); } });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/`);
    const reader = response.body.getReader();
    assert.equal(Buffer.from((await reader.read()).value).toString(), 'first');
    await redirectClosed;
    liveResponse.write('next');
    assert.equal(Buffer.from((await reader.read()).value).toString(), 'next');
    await reader.cancel();
    await liveClosed;
});

test('disconnecting one viewer closes only its upstream connection', { timeout: 5000 }, async t => {
    let opened = 0, closed = 0;
    let onClose;
    const disconnected = new Promise(resolve => { onClose = resolve; });
    const upstream = http.createServer((req, res) => {
        opened++;
        res.writeHead(200, { 'Content-Type': 'video/mp2t' });
        res.write('first');
        const timer = setInterval(() => res.write('next'), 10);
        res.on('close', () => { clearInterval(timer); closed++; onClose(); });
    });
    const app = express();
    app.get('/', (req, res) => proxyStream(`http://127.0.0.1:${upstream.address().port}/`, req, res));
    const proxy = http.createServer(app);
    t.after(() => { for (const server of [proxy, upstream]) { server.closeAllConnections(); server.close(); } });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const address = `http://127.0.0.1:${proxy.address().port}/`;
    const controller = new AbortController();
    const first = await fetch(address, { signal: controller.signal });
    const second = await fetch(address);
    const reader = second.body.getReader();
    assert.equal(opened, 2);
    controller.abort();
    await disconnected;
    assert.equal(closed, 1);
    assert.equal((await reader.read()).done, false);
    await reader.cancel();
});
