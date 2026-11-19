'use strict';
const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const xmlJS = require('xml-js');

function fetchResource(address, redirects = 5) {
    return new Promise((resolve, reject) => {
        const url = new URL(address);
        if (!['http:', 'https:'].includes(url.protocol)) return reject(new Error('Unsupported upstream protocol.'));
        const request = (url.protocol === 'https:' ? https : http).get(url, { headers: { 'User-Agent': 'VLC/3.0.20', 'Accept-Encoding': 'gzip' } }, response => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                response.resume();
                if (!response.headers.location || redirects <= 0) return reject(new Error('Upstream redirect limit reached.'));
                return fetchResource(new URL(response.headers.location, url).href, redirects - 1).then(resolve, reject);
            }
            if (response.statusCode !== 200) { response.resume(); return reject(new Error(`Upstream returned HTTP ${response.statusCode}.`)); }
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('error', reject);
            response.on('end', () => {
                try {
                    let data = Buffer.concat(chunks);
                    if (data[0] === 0x1f && data[1] === 0x8b) data = zlib.gunzipSync(data);
                    resolve({ data, contentType: response.headers['content-type'] || 'application/octet-stream' });
                } catch (error) { reject(error); }
            });
        });
        request.setTimeout(30000, () => request.destroy(new Error('Upstream request timed out.')));
        request.on('error', reject);
    });
}

function parseEpgTime(value) {
    const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
    const offset = (Number(offsetHour || 0) * 60 + Number(offsetMinute || 0)) * (sign === '-' ? -1 : 1);
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute - offset, +second)).toISOString();
}

function parseFeeds(playlist, xml) {
    const channels = [], images = new Set();
    let metadata;
    for (const line of playlist.split(/\r?\n/).map(line => line.trim())) {
        if (line.startsWith('#EXTINF:')) { metadata = line; continue; }
        if (!/^https?:\/\//i.test(line) || !metadata) continue;
        if (/tvg-type="(?:movie|series)"/i.test(metadata) || /\/(?:movie|series)\//i.test(line)) { metadata = null; continue; }
        const originalId = metadata.match(/tvg-id="([^"]*)"/)?.[1] || crypto.createHash('sha256').update(line).digest('hex').slice(0, 20);
        const id = `fixed-m3u_${originalId}`;
        metadata = /tvg-id="[^"]*"/.test(metadata) ? metadata.replace(/tvg-id="[^"]*"/, `tvg-id="${id}"`) : metadata.replace(/^#EXTINF:([^ ,]+)/, `$& tvg-id="${id}"`);
        metadata = metadata.replace(/tvg-logo="([^"]*)"/, (attribute, address) => {
            if (!/^https?:\/\//i.test(address)) return 'tvg-logo=""';
            images.add(address);
            return `tvg-logo="/api/image-proxy?url=${encodeURIComponent(address)}"`;
        });
        metadata = metadata.replace(`tvg-id="${id}"`, `tvg-id="${id}" vini-source="Live TV"`);
        channels.push({ id, originalId, url: line, metadata });
        metadata = null;
    }
    const guide = xmlJS.xml2js(xml, { compact: true });
    const programs = {};
    const channelIds = new Map(channels.map(channel => [channel.originalId, channel.id]));
    const text = node => node?._text || node?._cdata || '';
    for (const program of [].concat(guide.tv?.programme || [])) {
        const id = channelIds.get(program._attributes?.channel);
        const start = parseEpgTime(program._attributes?.start), stop = parseEpgTime(program._attributes?.stop);
        if (!id || !start || !stop) continue;
        (programs[id] ||= []).push({ title: text([].concat(program.title || [])[0]), desc: text([].concat(program.desc || [])[0]), start, stop });
    }
    for (const entries of Object.values(programs)) entries.sort((a, b) => a.start.localeCompare(b.start));
    return { m3uContent: '#EXTM3U\n' + channels.map(channel => `${channel.metadata}\n${channel.url}`).join('\n'), epgContent: programs, channels, images };
}
module.exports = { fetchResource, parseFeeds, parseEpgTime };
