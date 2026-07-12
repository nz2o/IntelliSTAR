# LocalWX Roku Channel

A minimal BrightScript/SceneGraph app that plays the IntelliSTAR Roku stream (see
`../roku-stream/`) full-screen and auto-retries if it ever drops out. It's meant to be
**sideloaded** via Roku Developer Mode -- this is not published to the Channel Store,
just installed directly onto your own Roku, which is all "add a channel to my home TV
for something I self-host" actually requires.

## 1. Get the stream running first

This channel only plays a stream -- it doesn't fetch weather data itself. Follow the
"Roku Streaming (optional)" section in the main [README.md](../README.md) to enable
the `intellistar-stream` container and confirm `http://<your-server-ip>:<PORT>/stream/live.m3u8`
is actually producing video before bothering with the Roku side.

## 2. Point this channel at your stream

Edit `components/MainScene.brs` and change the `STREAM_URL` constant near the top to
your server's real LAN address and port, e.g.:

```brightscript
STREAM_URL = "http://192.168.1.50:3000/stream/live.m3u8"
```

Use an address that won't change under you (a static IP or DHCP reservation on your
router) -- there's no way for this channel to read your `.env` file, so it has to be
hardcoded here and re-sideloaded if the address changes later.

## 3. Enable Developer Mode on the Roku

On the physical Roku remote: press, in order, **Home x3, Up x2, Right, Left, Right,
Left, Right**. A "Developer Settings" screen appears. Enable it, set a password when
prompted, and note the IP address it shows -- you'll need it next. (This only needs to
be done once per device; Developer Mode persists across reboots but can be reset by a
factory reset.)

## 4. Package and sideload

From this directory:

```bash
zip -r localwx-channel.zip manifest source components
```

Then, from a computer on the same network as the Roku:

1. Open `http://<roku-ip>` in a browser (the IP from step 3).
2. Log in with username `rokudev` and the password you set.
3. Under "Development Application Installer," choose `localwx-channel.zip` and click
   **Install**.

The Roku will immediately switch to running it. It should show the IntelliSTAR stream
full-screen within a few seconds. Press the Home button to exit back to the normal Roku
home screen at any time -- launch it again from the Roku home screen's "Dev" tile.

## Updating

Whenever you change `STREAM_URL` (or anything else in this folder), just re-zip and
re-install through the same web page -- it overwrites the previous install in place, no
uninstall step needed.
