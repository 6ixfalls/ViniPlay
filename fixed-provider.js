'use strict';
const STREAM_PROFILE = Object.freeze({ id: 'ffmpeg-default', name: 'Server Proxy', command: 'server-mpegts', isDefault: true });
const CAST_PROFILE = Object.freeze({ id: 'cast-default', name: 'Cast Proxy', command: 'server-mp4', isDefault: true });

function loadProvider(env) {
    const urls = {};
    for (const key of ['M3U_URL', 'EPG_URL']) {
        try {
            const url = new URL(env[key]);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
            urls[key] = url.href;
        } catch { throw new Error(`${key} must be set to an absolute HTTP(S) URL.`); }
    }
    const refreshHours = Number(env.SOURCE_REFRESH_HOURS || 24);
    if (!Number.isFinite(refreshHours) || refreshHours <= 0 || refreshHours > 596) throw new Error('SOURCE_REFRESH_HOURS must be greater than 0 and at most 596.');
    return Object.freeze({ ...urls, refreshHours });
}
function clientSettings(updatedAt) {
    return {
        m3uSources: [{ id: 'fixed-m3u', name: 'Live TV', isActive: true }],
        streamProfiles: [STREAM_PROFILE], activeStreamProfileId: STREAM_PROFILE.id,
        castProfiles: [CAST_PROFILE], activeCastProfileId: CAST_PROFILE.id,
        userAgents: [{ id: 'default-ua', name: 'Default', value: 'VLC/3.0.20' }], activeUserAgentId: 'default-ua',
        sourcesLastUpdated: updatedAt, clientTelemetryEnabled: false
    };
}
module.exports = { STREAM_PROFILE, CAST_PROFILE, loadProvider, clientSettings };
