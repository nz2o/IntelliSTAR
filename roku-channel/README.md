# LocalWX Roku Channel

A minimal BrightScript/SceneGraph app that plays the IntelliSTAR Roku stream (see
`../roku-stream/`) full-screen and auto-retries if it ever drops out. It's meant to be
**sideloaded** via Roku Developer Mode -- this is not published to the Channel Store,
just installed directly onto your own Roku, which is all "add a channel to my home TV
for something I self-host" actually requires.

The server address is *not* baked into the source -- you enter it once on the TV itself
(via the remote's on-screen keyboard) the first time the channel launches, and it's
saved on the Roku from then on. Press the remote's **\*** (Options) button at any time to
change it later (e.g. if you move to a new domain/IP) -- no code edits or re-sideloading
needed for that.

## 1. Get the stream running first

This channel only plays a stream -- it doesn't fetch weather data itself. Follow the
"Roku Streaming (optional)" section in the main [README.md](../README.md) to enable the
`intellistar-stream` container, and confirm `<your-server-address>/stream/live.m3u8` is
actually producing video (e.g. by opening it in VLC) before bothering with the Roku side.

## 2. Download the channel package

`docker compose up` already packages this folder into a .zip automatically on every
server start (see `server.js`) -- no `zip` command to run yourself. Just download it:

```
http://<your-server-address>/roku-channel.zip
```

(e.g. `https://localwx.thebenefields.net/roku-channel.zip`). It's always rebuilt fresh
from whatever's currently in this folder, so if you ever edit `MainScene.brs` yourself,
just restart the `intellistar` container and re-download.

## 3. Enable Developer Mode on the Roku

On the physical Roku remote: press, in order, **Home x3, Up x2, Right, Left, Right,
Left, Right**. A "Developer Settings" screen appears. Enable it, set a password when
prompted, and note the IP address it shows -- you'll need it next. (This only needs to
be done once per device; Developer Mode persists across reboots but can be reset by a
factory reset.)

## 4. Sideload it

From a computer on the same network as the Roku:

1. Open `http://<roku-ip>` in a browser (the IP from step 3).
2. Log in with username `rokudev` and the password you set.
3. Under "Development Application Installer," choose the `localwx-channel.zip` you
   downloaded in step 2, and click **Install**.

## 5. Point it at your server

The Roku will immediately switch to running it, showing an address-entry screen. Using
the remote's D-pad and the on-screen keyboard, type your server's address -- either the
bare address (`https://your-domain.com`, or `http://192.168.1.50:3000` for a plain LAN
IP/port) or the full stream URL if you already have it copied somewhere -- then select
**Done**. It's saved from that point on; the channel goes straight to playing the stream
on every future launch without asking again.

Press the Home button to exit back to the normal Roku home screen at any time -- launch
it again from the Roku home screen's "Dev" tile. Press **\*** on the remote while the
channel is running to bring the address-entry screen back up and change it.

## Updating

If you change anything in this folder's *code* (not just the server address, which
doesn't require this): restart the `intellistar` container (or just wait for its next
restart) so it repackages the .zip, re-download it from `/roku-channel.zip`, and
re-install through the same web page -- it overwrites the previous install in place, no
uninstall step needed. Your saved server address persists across reinstalls (it lives in
the Roku's registry, not the package).
