'use strict';
const childProcess = require('node:child_process');

// The default Cast receiver needs MP4 or a streaming manifest, not raw TS.
// Repackage compatible upstream codecs without decoding or encoding them.
function streamCast(address, res, userAgent) {
    const process = childProcess.spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin',
        '-user_agent', userAgent, '-rw_timeout', '30000000',
        '-protocol_whitelist', 'http,https,tcp,tls', '-f', 'mpegts', '-i', address,
        '-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let killTimer;
    const cleanup = () => {
        process.stdout.destroy();
        if (process.exitCode === null && process.signalCode === null && !process.killed) {
            process.kill();
            killTimer = setTimeout(() => process.kill('SIGKILL'), 2000);
            killTimer.unref();
        }
    };
    const fail = () => {
        if (!res.destroyed && !res.writableEnded) {
            if (res.headersSent) res.destroy();
            else res.status(502).end('The Cast stream could not be played.');
        }
        cleanup();
    };
    res.once('close', cleanup);
    process.once('error', fail);
    process.stdout.once('error', fail);
    process.once('close', code => {
        clearTimeout(killTimer);
        if (code !== 0) fail();
        else res.end();
    });
    // Wait for the exit code before ending the response so an early failure
    // returns 502 rather than a successful empty MP4 response.
    process.stdout.pipe(res, { end: false });
}

module.exports = { streamCast };
