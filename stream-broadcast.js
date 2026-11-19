'use strict';

// Bound each viewer's pending output without pausing the shared FFmpeg source.
const MAX_PENDING_BYTES = 1024 * 1024;

function broadcastStream(source, responses) {
    source.on('data', chunk => {
        for (const response of responses) {
            if (response.destroyed || response.writableEnded) continue;
            if (response.writableLength + chunk.length > MAX_PENDING_BYTES) {
                // Dropping bytes would corrupt the media stream. Disconnect the
                // lagging viewer instead, allowing its player to reconnect.
                response.destroy();
                continue;
            }
            response.write(chunk);
        }
    });
}

module.exports = { broadcastStream };
