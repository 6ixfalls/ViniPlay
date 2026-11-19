'use strict';
const http = require('node:http');
const https = require('node:https');
const { pipeline } = require('node:stream');

// Give each viewer an independent upstream connection and backpressure. tvarr
// owns stream sharing, codec selection and transcoding; these bytes are untouched.
function proxyStream(address, req, res, userAgent = 'ViniPlay/1.0') {
    let upstreamRequest, upstreamResponse;
    const cleanup = () => {
        upstreamRequest?.destroy();
        upstreamResponse?.destroy();
    };
    res.once('close', cleanup);
    const fail = () => {
        if (res.destroyed || res.writableEnded) return;
        if (res.headersSent) res.destroy();
        else res.status(502).end('The upstream stream could not be played.');
        cleanup();
    };
    function connect(target, redirects = 5) {
        if (res.destroyed) return;
        try {
            const url = new URL(target);
            if (!['http:', 'https:'].includes(url.protocol)) return fail();
            const headers = { 'User-Agent': userAgent, 'Accept-Encoding': 'identity' };
            if (req.headers.range) headers.Range = req.headers.range;
            let retired = false;
            const request = upstreamRequest = (url.protocol === 'https:' ? https : http).get(url, { headers }, response => {
                upstreamResponse = response;
                if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                    response.on('error', () => {});
                    if (!response.headers.location || redirects <= 0) return fail();
                    // Release this hop before replacing the tracked connection.
                    // Errors caused by retiring it must not fail the next hop.
                    retired = true;
                    request.setTimeout(0);
                    response.destroy();
                    request.destroy();
                    try { connect(new URL(response.headers.location, url).href, redirects - 1); }
                    catch { fail(); }
                    return;
                }
                if (![200, 206].includes(response.statusCode)) {
                    response.on('error', () => {});
                    response.destroy();
                    return fail();
                }
                res.status(response.statusCode);
                for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-encoding']) {
                    if (response.headers[header]) res.set(header, response.headers[header]);
                }
                pipeline(response, res, error => { if (error) fail(); });
            });
            request.setTimeout(30000, () => request.destroy(new Error('Upstream timed out.')));
            request.on('error', () => { if (!retired) fail(); });
        } catch { fail(); }
    }
    connect(address);
}

module.exports = { proxyStream };
