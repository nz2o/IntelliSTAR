// Server-side interface for the optional local background-photo library --
// assets/background/<cwa>/*.jpg (or .png, etc.), one folder per NWS County Warning
// Area (e.g. "bmx" for Birmingham, AL), optionally split further into per-phenomenon
// subfolders (assets/background/bmx/tornado/*.jpg) picked based on the current
// active alert or condition -- see assets/background/README.md for the full
// pitch/setup instructions and the complete phenomenon list. This file just lists
// what's actually on disk so js/BackgroundSelector.js can pick a random one,
// client-side.
//
// assets/background/ is gitignored (except its own README.md) -- this is meant to
// hold a personal photo library, not something that belongs in source control. See
// docker-compose.yml for how to point it at a folder elsewhere on the host (or a
// mounted network share) instead of the repo directory, via BACKGROUND_PHOTOS_PATH.

import fs from 'node:fs/promises';
import path from 'node:path';

const BACKGROUND_ROOT = './assets/background';

// Deliberately a plain extension whitelist, not "anything in the folder" -- so a
// stray .md/.txt/.DS_Store (or, worse, some unrelated file someone's SMB share
// happens to sync into the wrong place) never ends up picked as a background image.
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);

// Only simple alphanumeric names are ever legitimate here for either the CWA code
// (NWS office IDs are 3-4 letters, e.g. "BMX", "TOP") or the phenomenon subfolder
// name (see assets/background/README.md for the full list, e.g. "tornado",
// "clearday") -- reject anything else outright rather than building a filesystem
// path out of it, since both come straight from the request URL (see server.js) and
// this guards against path traversal (e.g. "../../etc").
const VALID_PATH_SEGMENT = /^[a-zA-Z0-9]+$/;

async function listImages(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(entry => `${dirPath}/${entry.name}`);
  } catch {
    return []; // no such folder -- not an error, just nothing to offer from here
  }
}

// Returns a list of relative URL paths (e.g. "assets/background/bmx/tornado/a.jpg"),
// ready to use directly as a background-image URL -- or an empty array if there's
// nothing usable. Never throws: a missing/unreadable/empty folder is exactly as
// valid a "nothing here, caller should fall back" outcome as any other.
//
// Deliberately does NOT fall back to the plain CWA folder on its own when a
// phenomenon subfolder is empty -- js/BackgroundSelector.js's applyBackground() owns
// the full fallback chain (phenomenon -> clearday/clearnight -> plain CWA ->
// picsum, see assets/background/README.md) and needs to know precisely whether each
// tier came back empty, not have an earlier tier silently absorbed into this one.
// Any fallback-across-tiers logic belongs there, not here.
export async function GetBackgroundPhotos(cwa, phenomenon) {
  if (!cwa || !VALID_PATH_SEGMENT.test(cwa)) return [];
  const folder = cwa.toLowerCase();

  if (phenomenon && VALID_PATH_SEGMENT.test(phenomenon)) {
    return listImages(path.join(BACKGROUND_ROOT, folder, phenomenon.toLowerCase()));
  }

  return listImages(path.join(BACKGROUND_ROOT, folder));
}
