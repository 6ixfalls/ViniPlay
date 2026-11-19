# ViniPlay

A live IPTV player with an EPG guide, favorites, multiview, and Chromecast support.
The server fetches a fixed M3U playlist and XMLTV guide, and always proxies playback.
Provider feeds can remain accessible only to the server.

## Run

Copy `.env.example` to `.env` and configure:

```dotenv
M3U_URL=http://provider.internal/playlist.m3u
EPG_URL=http://provider.internal/guide.xml
SOURCE_REFRESH_HOURS=24
```

Both URLs must be absolute HTTP(S) URLs reachable from the server or container.
`SOURCE_REFRESH_HOURS` defaults to 24 and accepts values greater than zero up to
596 hours. Restart after changing the environment. Compressed XMLTV feeds work too.

```sh
docker compose up --build -d
```

Open `http://localhost:8998`. No account setup is required. There are no users,
admin settings, provider editing APIs, DVR, VOD, or scheduled notifications.
Proxying is unconditional and only channels in the configured live playlist can
be played. Browser playback is a byte-for-byte HTTP(S) relay with no local transcoding.
Each viewer has its own upstream connection, released when playback disconnects.

For a local run, install Node.js and FFmpeg (required for Cast), then run `npm install` and `npm start`.
The default port is 8998; `PORT` can override it.

## tvarr playback

Set `M3U_URL` and `EPG_URL` to tvarr's generated playlist and guide URLs. The
playlist's channel URLs must also be reachable from ViniPlay. Configure tvarr to
serve raw MPEG-TS with browser-compatible codecs (typically H.264 video and AAC
audio), copying compatible streams and transcoding others upstream as needed.
ViniPlay does not detect incompatible codecs or request a fallback transcode.
HLS/DASH manifests and their segment URLs are not rewritten by this proxy.

Playback requests identify as `ViniPlay/1.0`; match this user agent in tvarr's
client/profile rules. `STREAM_USER_AGENT` overrides it if your tvarr configuration
needs another value. The configured agent is used for single view, multiview,
and Cast; browser and receiver User-Agent headers are not forwarded. The browser
uses mpegts.js to remux MPEG-TS for playback.

Cast uses `video/mp4` with the default Google Cast receiver. ViniPlay runs one
FFmpeg process per Cast connection to repackage MPEG-TS into fragmented MP4,
copying the audio and video without re-encoding. Configure tvarr to supply
H.264 video and AAC audio for Cast. The receiver needs network access
to ViniPlay; disconnecting it releases its remux process and upstream connection.

## Preferences and state

Favorites, recent channels, saved multiview layouts, and display preferences live
in this browser's local storage. They are specific to that browser and are cleared
if its site data is cleared. No preferences are sent to or saved by the server.

The server keeps feeds and active playback connections in memory. There is no database,
state file, data volume, or recording directory. Old data files are not read or deleted.
A failed scheduled feed refresh keeps the last successfully loaded feeds available.

## Validation

```sh
npm test
npm run test:integration
```

The integration suite starts temporary local feed and app servers to verify direct
proxy transport and real Cast remuxing with an H.264/AAC fixture. The integration
suite requires FFmpeg and ffprobe. Tests do not validate hardware Cast playback
or browser video decoding.

## License

CC BY-NC-SA 4.0. Original project by Andrea Ardovini.
