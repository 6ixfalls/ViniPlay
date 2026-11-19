const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeeds, parseEpgTime } = require('../feeds');

test('live channels and XMLTV programmes match; provider headers and VOD are excluded', () => {
    const playlist = `#EXTM3U x-tvg-url="http://private/secret-guide"
#EXTINF:-1 tvg-id="news" tvg-logo="http://private/logo.png",News
http://private/live/news.ts
#EXTINF:-1,No ID
http://private/live/other.ts
#EXTINF:-1 tvg-type="movie",Film
http://private/movie/1.mp4
#EXTINF:-1 tvg-type="series",Episode
http://private/series/2.mp4`;
    const guide = '<tv><programme channel="news" start="20261118120000 -0800" stop="20261118130000 -0800"><title>News</title><desc><![CDATA[Current events]]></desc></programme><programme channel="unknown" start="20261118120000 +0000" stop="20261118130000 +0000"><title>Excluded</title></programme></tv>';
    const result = parseFeeds(playlist, guide);
    assert.equal(result.channels.length, 2);
    assert.ok(!result.m3uContent.includes('secret-guide'));
    assert.ok(result.m3uContent.includes('/api/image-proxy?url='));
    assert.ok(result.m3uContent.includes('vini-source="Live TV"'));
    assert.ok(result.channels[0].metadata.endsWith(',News'));
    assert.equal(result.epgContent['fixed-m3u_news'][0].start, '2026-11-18T20:00:00.000Z');
    assert.equal(result.epgContent['fixed-m3u_news'][0].desc, 'Current events');
    assert.equal(Object.keys(result.epgContent).length, 1);
    assert.equal(parseFeeds(playlist, guide).channels[1].id, result.channels[1].id);
    assert.equal(parseEpgTime('invalid'), null);
});
