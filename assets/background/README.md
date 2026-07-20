# Local Background Photos

By default, the greeting page's background photo comes from
[Lorem Picsum](https://picsum.photos/) (a random image, sourced from Unsplash,
free to use -- see the main [README.md](../../README.md) for licensing details).

If you'd rather use your own photos, drop them in here, in a folder named after
the NWS **County Warning Area (CWA)** code for the location you're running this
for, optionally split further into **phenomenon subfolders** so the background
actually matches what's happening outside right now -- storm photos during a
severe thunderstorm warning, snow photos when it's snowing, and so on.

```
assets/background/
  bmx/
    sunset-over-the-lake.jpg      <- plain CWA-level fallback photos
    downtown-skyline.png
    tornado/
      supercell.jpg
      wall-cloud.jpg
    storm/
      lightning.jpg
    snow/
      backyard-snow.jpg
    clearday/
      blue-sky.jpg
    clearnight/
      stars.jpg
  top/
    some-photo.jpg
```

- The CWA folder name must be the lowercase CWA code (e.g. `bmx` for
  Birmingham, AL, `top` for Topeka, KS). Find yours: it's shown on-screen as
  the hashtag on the closing "It's Amazing Out There" slide (e.g. `#bmxWX` ->
  CWA is `bmx`), or in this server's own console log (any
  `/nws/forecast/BMX/...`-style log line).
- Phenomenon folder names are lowercase too (`tornado`, not `Tornado`) -- see
  the full list below.
- Supported file types: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, `.bmp`.
- On each load, one photo is picked at random from whichever folder actually
  applies (see "How the phenomenon is chosen" below).
- You don't need to create every folder, or any of them -- add only the ones
  you have photos for. Missing/empty folders just fall through to the next
  tier automatically.
- If you run this for more than one location (or move), just add more
  CWA-named folders; only the one matching wherever you're currently pointed
  at actually gets used.

## How the phenomenon is chosen

Checked in this order every time the weather refreshes, until one of them
actually finds a photo:

1. **Active alerts** -- if there's more than one alert active at once, the
   *category* (not any one specific alert) with the highest priority in the
   list below wins. This is a deliberate, presentation-driven ordering, not
   NWS's own official severity ranking -- e.g. a hurricane's background wins
   out over a tornado warning issued within it, since hurricane coverage is
   normally the bigger, longer-running story.
2. **Current conditions** -- only checked if no active alert matched a
   phenomenon folder above (or that folder didn't have any photos in it).
3. **`clearday` or `clearnight`, whichever is currently correct** -- only
   checked if neither of the above produced a matched folder with photos in
   it (and skipped if step 1 or 2 already landed on `clearday`/`clearnight`
   itself, so it's not asked for twice). Day vs. night here is the app's own
   sunrise/sunset-based day/night determination, the same one used everywhere
   else in the app -- not a re-guess based on the current condition. This
   means a tornado warning with no `tornado/` photos configured falls back to
   a pleasant clear-sky photo appropriate for right now, rather than jumping
   straight to an untagged CWA photo or picsum.
4. **The plain CWA folder** (`assets/background/bmx/` itself) -- whatever
   photos are directly inside it, not in any phenomenon subfolder.
5. **picsum.photos** -- the original random-photo fallback, if nothing above
   produced a single usable photo.

### Alert-driven phenomena (priority order)

| # | Folder | Triggered by these NWS alerts |
|---|--------|-------------------------------|
| 1 | `hurricane` | Hurricane Warning/Watch, Hurricane Force Wind Warning/Watch, Typhoon Warning/Watch, Tropical Storm Warning/Watch, Storm Surge Warning/Watch, Tropical Cyclone Local Statement |
| 2 | `tornado` | Tornado Warning, Tornado Watch |
| 3 | `storm` | Severe Thunderstorm Warning/Watch, Special Weather Statement, Severe Weather Statement |
| 4 | `snow` | Winter Storm Warning/Watch, Winter Weather Advisory, Blizzard Warning, Snow Squall Warning, Lake Effect Snow Warning |
| 5 | `ice` | Ice Storm Warning |
| 6 | `flood` | Flood/Flash Flood/Coastal Flood/Lakeshore Flood Warning, Watch, Advisory, or Statement |
| 7 | `wind` | High Wind Warning/Watch, Extreme Wind Warning, Wind Advisory, Lake Wind Advisory |
| 8 | `firewx` | Red Flag Warning, Fire Weather Watch, Extreme Fire Danger, Fire Warning |
| 9 | `dust` | Dust Storm Warning, Blowing Dust Warning/Advisory, Dust Advisory |
| 10 | `heat` | Excessive Heat Warning/Watch, Heat Advisory |
| 11 | `cold` | Extreme Cold Warning/Watch, Freeze Warning/Watch, Cold Weather Advisory, Frost Advisory |
| 12 | `fog` | Dense Fog Advisory, Freezing Fog Advisory, Dense Smoke Advisory |
| 13 | `airquality` | Air Quality Alert, Air Stagnation Advisory |

Rows 1-6 (`hurricane` through `flood`) were the original request; rows 7-13
were added for coverage of other common NWS alert types along the same lines.
A few notable NWS alert types are deliberately **not** mapped to any
background at all, since they're either not a visual weather phenomenon
(Civil Danger Warning, Nuclear Power Plant Warning, Law Enforcement Warning,
Administrative Message, etc.), marine-only (Small Craft Advisory, Gale
Warning, Hazardous Seas Warning -- this app doesn't have a marine forecast
page), or purely informational (Hazardous Weather Outlook, Short Term
Forecast, Hydrologic Outlook).

Two judgment calls worth knowing about if your photos don't look right:
- **Winter Weather Advisory** is issued for snow, ice, *or* a mix, and NWS's
  own event name doesn't say which -- it's mapped to `snow` here since that's
  the most common cause. If your area gets more ice-mix advisories than snow
  ones, feel free to symlink/copy your `snow/` photos into `ice/` too (or vice
  versa).
- **Freezing Fog Advisory** is mapped to `fog` (it looks like fog), not `ice`
  (even though it deposits ice) -- the folder is about what it looks like
  outside, not the underlying cause.

### Condition-driven phenomena (no active alert)

Based on the current observed sky/precipitation condition:

| Folder | Condition |
|--------|-----------|
| `rain` | Rain or chance of rain |
| `snow` | Snow or sleet (same folder as the winter alerts above) |
| `storm` | Thunderstorms, not currently under a severe warning (same folder as the severe alert above) |
| `fog` | Foggy (same folder as the fog-related alerts above) |
| `haze` | Haze, smoke, or dust in the air, short of an actual Dust/Air Quality alert |
| `cloudy` | Cloudy or partly cloudy |
| `clearday` | Sunny/mostly sunny/partly sunny, during the day |
| `clearnight` | Clear/mostly clear, at night |

`rain`, `snow`, `storm`, and `fog` intentionally reuse the same folder names
as their alert-tier counterparts above -- a snowy scene looks like a snowy
scene whether or not there happens to be a Winter Storm Warning active, so
there's no need for separate `snow-alert` / `snow-condition` folders.

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
