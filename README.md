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
be played. Chromecast receives a proxied MP4 stream from the same server.

For a local run, install Node.js and FFmpeg, then run `npm install` and `npm start`.
The default port is 8998; `PORT` can override it.

## Preferences and state

Favorites, recent channels, saved multiview layouts, and display preferences live
in this browser's local storage. They are specific to that browser and are cleared
if its site data is cleared. No preferences are sent to or saved by the server.

The server keeps feeds and active playback processes in memory. There is no database,
state file, data volume, or recording directory. Old data files are not read or deleted.
A failed scheduled feed refresh keeps the last successfully loaded feeds available.

## Validation

```sh
npm test
npm run test:integration
```

The integration suite starts temporary local feed and app servers. It uses an
FFmpeg stand-in to verify proxy transport without requiring local codecs; it does
not validate real transcoding or browser video decoding.

## License

CC BY-NC-SA 4.0. Original project by Andrea Ardovini.
