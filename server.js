'use strict';
require('dotenv').config();
const { loadProvider, clientSettings, STREAM_PROFILE, CAST_PROFILE } = require('./fixed-provider');
const provider = loadProvider(process.env);
const express = require('express');
const path = require('node:path');
const { proxyStream } = require('./stream-proxy');
const { streamCast } = require('./cast-stream');
const { fetchResource, parseFeeds } = require('./feeds');

const app = express();
const port = Number(process.env.PORT || 8998);
const clients = new Set();
let feed, updatedAt;
let refreshInProgress = null;

function refreshFeeds() {
    if (refreshInProgress) return refreshInProgress;
    refreshInProgress = (async () => {
        const [playlist, guide] = await Promise.all([fetchResource(provider.M3U_URL), fetchResource(provider.EPG_URL)]);
        const next = parseFeeds(playlist.data.toString('utf8'), guide.data.toString('utf8'));
        feed = next;
        updatedAt = new Date().toISOString();
        for (const response of clients) response.write('event: feeds-updated\ndata: {}\n\n');
        console.log(`[FEEDS] Loaded ${feed.channels.length} live channels.`);
    })().finally(() => { refreshInProgress = null; });
    return refreshInProgress;
}

app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: response => response.set('Cache-Control', 'no-cache') }));
app.get('/api/config', (req, res) => res.json({ m3uContent: feed.m3uContent, epgContent: feed.epgContent, settings: clientSettings(updatedAt) }));
app.get('/api/version', (req, res) => res.json({ version: require('./package.json').version }));
app.get('/api/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    clients.add(res);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);
    req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
});
app.get('/api/image-proxy', async (req, res) => {
    if (!feed.images.has(req.query.url)) return res.status(404).end();
    try {
        const image = await fetchResource(req.query.url);
        res.set('Content-Type', image.contentType).send(image.data);
    } catch { res.status(502).end(); }
});

app.get('/stream', (req, res) => {
    const address = req.query.url;
    const profileId = req.query.profileId || STREAM_PROFILE.id;
    if (!feed.channels.some(channel => channel.url === address) || ![STREAM_PROFILE.id, CAST_PROFILE.id].includes(profileId)) return res.status(404).json({ error: 'Live stream not found.' });
    const cast = profileId === CAST_PROFILE.id;
    res.set({ 'Content-Type': cast ? 'video/mp4' : 'video/mp2t', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    if (req.method === 'HEAD') return res.end();
    if (cast) return streamCast(address, res, provider.streamUserAgent);
    proxyStream(address, req, res, provider.streamUserAgent);
});
app.post('/api/stream/stop', (req, res) => {
    // Disconnecting the video response releases its proxy. A stop request must
    // never terminate another browser's connection to the same live channel.
    res.json({ success: true });
});
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

refreshFeeds().then(() => {
    app.listen(port, () => console.log(`VINI PLAY server listening at http://localhost:${port}`));
    setInterval(() => refreshFeeds().catch(error => console.error('[FEEDS] Refresh failed:', error.message)), provider.refreshHours * 3600000);
}).catch(error => { console.error('[INIT] Startup failed:', error.message); process.exitCode = 1; });
