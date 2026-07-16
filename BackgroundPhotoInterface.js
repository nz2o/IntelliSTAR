// Server-side interface for the optional local background-photo library --
// assets/background/<cwa>/*.jpg (or .png, etc.), one folder per NWS County Warning
// Area (e.g. "bmx" for Birmingham, AL). See assets/background/README.md for the
// full pitch/setup instructions; this file just lists what's actually on disk so
// js/MainScript.js's setMainBackground() can pick a random one, client-side.
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

// Only simple alphanumeric CWA codes are ever legitimate here (NWS office IDs are
// 3-4 letters, e.g. "BMX", "TOP") -- reject anything else outright rather than
// building a filesystem path out of it, since :cwa comes straight from the request
// URL (see server.js) and this guards against path traversal (e.g. "../../etc").
const VALID_CWA = /^[a-zA-Z0-9]+$/;

// Returns a list of relative URL paths (e.g. "assets/background/bmx/sunset.jpg"),
// ready to use directly as a background-image URL -- or an empty array if the CWA
// has no folder, the folder is empty, or contains no recognized image files. Never
// throws: a missing/unreadable folder is exactly as valid a "nothing local, fall
// back to picsum" outcome as an empty one.
export async function GetBackgroundPhotos(cwa) {
  if (!cwa || !VALID_CWA.test(cwa)) return [];

  const folder = cwa.toLowerCase();
  const dirPath = path.join(BACKGROUND_ROOT, folder);

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(entry => `${BACKGROUND_ROOT}/${folder}/${entry.name}`);
  } catch {
    return []; // no folder for this CWA -- not an error, just nothing local to offer
  }
}
