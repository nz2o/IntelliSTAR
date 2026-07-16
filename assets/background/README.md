# Local Background Photos

By default, the greeting page's background photo comes from
[Lorem Picsum](https://picsum.photos/) (a random image, sourced from Unsplash,
free to use -- see the main [README.md](../../README.md) for licensing details).

If you'd rather use your own photos, drop them in here, in a folder named after
the NWS **County Warning Area (CWA)** code for the location you're running this
for:

```
assets/background/
  bmx/
    sunset-over-the-lake.jpg
    downtown-skyline.png
  top/
    some-photo.jpg
```

- The folder name must be the lowercase CWA code (e.g. `bmx` for Birmingham, AL,
  `top` for Topeka, KS). Find yours: it's shown on-screen as the hashtag on the
  closing "It's Amazing Out There" slide (e.g. `#bmxWX` -> CWA is `bmx`), or in this
  server's own console log (any `/nws/forecast/BMX/...`-style log line).
- Supported file types: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, `.bmp`.
- On each load, one photo is picked at random from the matching CWA's folder.
- If there's no folder for the current CWA, or the folder is empty/has no
  recognized image files, the app falls back to the picsum.photos source
  automatically -- nothing else to configure.
- If you run this for more than one location (or move), just add more
  CWA-named folders; only the one matching wherever you're currently pointed at
  actually gets used.

## Why isn't this in git?

This folder (everything in it except this file) is gitignored on purpose --
GitHub is for code, not a personal photo library. Your photos stay local to
your own deployment.

## Using a bind mount instead (Docker)

If you'd rather keep your photos somewhere else entirely -- elsewhere on the
host, or a mounted network share (e.g. SMB) -- instead of inside this repo's
own `assets/background/` folder, set `BACKGROUND_PHOTOS_PATH` in `.env` to that
path. `docker-compose.yml` mounts it to `/app/assets/background` inside the
container in place of the repo's own folder. See `.env.example` for details.
Leave it unset to just use the repo's own `assets/background/` folder (the
default).
