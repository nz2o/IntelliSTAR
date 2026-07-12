### IntelliSTAR Emulator - Updating to a Newer Version

This assumes you already have the app running via Docker -- see
[INSTALL.md](./INSTALL.md) if you haven't set it up yet.

#### Updating (Docker)

1. Navigate to the folder where you placed the cloned git repository:
   ```
   cd IntelliSTAR
   ```
   (or wherever you cloned it to.)

2. Pull the latest code:
   ```
   git pull
   ```

3. Rebuild and restart the containers:
   ```
   docker compose up --build -d
   ```

That's it. `docker compose up --build -d` rebuilds the app's image (picking up any
new/changed dependencies) and restarts the containers in the background. Your `.env`
file is untouched by any of this -- it's gitignored and never overwritten by `git pull`.

#### Verifying it worked

```
docker compose ps
```
Both `intellistar` and `intellistar-piper` should show a status of `Up` (piper will
say `Up (healthy)` once its voice server has finished starting). Then reload the app
in your browser to confirm it comes up normally.

If something looks wrong, check the logs:
```
docker compose logs -f
```

#### If `git pull` refuses to run

This usually means you've directly edited a tracked file (rather than only editing
`.env`, which is gitignored and safe to change freely). Git will say something like
`error: Your local changes to the following files would be overwritten by merge`.

- If those local edits aren't important, discard them: `git checkout -- <file>`, then
  `git pull` again.
- If you want to keep them, stash them first: `git stash`, then `git pull`, then
  `git stash pop` to bring your edits back (you may need to resolve a conflict if the
  update touched the same lines).

#### If you installed via the ZIP download instead of `git clone`

`git pull` only works on a folder that was set up with `git clone` (see
[INSTALL.md](./INSTALL.md), Step 2, Option A). If you downloaded a ZIP instead:

1. Download a fresh ZIP from https://github.com/nz2o/IntelliSTAR and extract it
   somewhere new.
2. Copy your existing `.env` file from the old folder into the new one (this preserves
   your settings -- don't copy over the new `.env.example`, just your own `.env`).
3. From inside the new folder, run `docker compose up --build -d` as in Step 3 above.
4. Once you've confirmed the new version is running, you can delete the old folder.

Switching to `git clone` instead going forward makes future updates a lot simpler
(just Steps 1-3 above, no manual file copying).
