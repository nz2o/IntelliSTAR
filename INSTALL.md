### IntelliSTAR Emulator - Quick Start / Install Guide

This guide is for anyone who has **never used Docker before** and just wants to get
this app running on their own Windows or Linux computer, or server, and see it in a browser.
No prior Node.js, Docker, or command-line experience is assumed.

If you get stuck, see [Troubleshooting](#troubleshooting) near the bottom.

#### What you'll need

- A Windows 10/11 or Linux computer with an internet connection.
- About 10-15 minutes (most of that is Docker downloading things in the background).
- A terminal: **PowerShell** on Windows (search "PowerShell" in the Start Menu), or
  your usual terminal app on Linux.

---

### Step 1: Install Docker

Docker is the tool that runs this app in a self-contained package, so you don't have
to manually install Node.js, Python, or anything else yourself.

#### Windows

1. Download **Docker Desktop** from Docker's official site:
   https://www.docker.com/products/docker-desktop/
2. Run the installer. Leave the default options as they are (Docker Desktop uses
   "WSL 2" by default, which is the recommended choice).
3. If the installer or Windows asks to enable WSL2 or a Windows feature and prompts
   you to restart, let it restart your computer, then continue.
4. After restarting, launch **Docker Desktop** from the Start Menu. The first launch
   may ask you to accept a service agreement -- accept it.
5. Wait until the little whale icon in your system tray (bottom-right, near the
   clock) stops animating and shows "Docker Desktop is running" when you hover
   over it. This can take a minute or two the first time.
6. Confirm it worked: open PowerShell and run:
   ```
   docker --version
   docker compose version
   ```
   Both should print a version number, not an error.

#### Linux

These steps use Docker's official install script, which works on Ubuntu, Debian,
Mint, and most similar distributions. (If you're on Fedora, Arch, or something else,
follow Docker's per-distribution instructions instead:
https://docs.docker.com/engine/install/)

1. Open a terminal and run:
   ```
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```
2. Let your user run Docker without typing `sudo` every time:
   ```
   sudo usermod -aG docker $USER
   ```
   Then **log out and log back in** (or reboot) for this to take effect.
3. Confirm it worked:
   ```
   docker --version
   docker compose version
   ```
   Both should print a version number, not an error. If you see a "permission
   denied" error talking to `/var/run/docker.sock`, you skipped the log-out/log-in
   step above.

Note: Docker on Linux - It's a good idea to grab a webGUI for that, like Dockhand, or Portainer.

---

### Step 2: Get the IntelliSTAR code

Choose whichever of these is easier for you -- both end up in the same place.

**Option A -- using git** (if you don't have git, install it first: on Windows from
https://git-scm.com/download/win, on Linux via `sudo apt install git` or your
distro's package manager):
```
git clone https://github.com/nz2o/IntelliSTAR.git
cd IntelliSTAR
```

**Option B -- download a ZIP, no git needed:**
1. Go to https://github.com/nz2o/IntelliSTAR in your browser.
2. Click the green **Code** button, then **Download ZIP**.
3. Extract the ZIP file somewhere you'll remember (e.g. your Desktop or Documents).
4. Open a terminal and `cd` into the extracted folder, e.g.:
   ```
   cd Desktop\IntelliSTAR-master        (Windows PowerShell)
   cd ~/Desktop/IntelliSTAR-master      (Linux)
   ```

From here on, run every command from inside this `IntelliSTAR` folder.

---

### Step 3: Configure it

Copy the example settings file to create your own:

- Windows (PowerShell): `copy .env.example .env`
- Linux: `cp .env.example .env`

Open the new `.env` file in any text editor (Notepad, VS Code, nano, etc.) and set
`NWS_USER_AGENT` to something identifying you or your setup, e.g.:
```
NWS_USER_AGENT=MyWeatherDisplay (you@example.com)
```
This is required -- the free NWS weather API (`api.weather.gov`) asks every caller to
self-identify this way. Everything else in `.env` already has a working default; you
can leave the rest as-is for now and come back to tune it later (see `.env.example`
for what each setting does, or the main [README.md](./README.md#configuration-env)).

---

### Step 4: Run it

From inside the `IntelliSTAR` folder, run:
```
docker compose up -d
```
This builds and starts two containers: the app itself, and a self-hosted PiperTTS
voice server it talks to. The `-d` means "detached" -- it runs in the background and
gives you your terminal back.

**The first time you run this, it can take a few minutes** -- Docker is downloading
base images and a voice model file. Subsequent starts are fast (a few seconds).

Check that both containers are up and healthy:
```
docker compose ps
```
You should see two entries (`intellistar` and `intellistar-piper`) with a status of
`Up` (the piper one will say `Up (healthy)` once its voice server is ready).

---

### Step 5: View it in your browser

Open your browser and go to:
```
http://localhost:3000
```

If you want to view it from a *different* device on the same network (e.g. a
Fire Stick or another computer's browser), use the host computer's local network IP
address instead of `localhost`:
- Windows: run `ipconfig` in PowerShell and look for "IPv4 Address".
- Linux: run `hostname -I` or `ip addr`.

Then browse to `http://<that-ip-address>:3000` from the other device.

---

### Everyday use

- **Stop it:** `docker compose down`
- **Start it again later:** `docker compose up -d`
- **View live logs:** `docker compose logs -f` (Ctrl+C to stop watching)
- **Get code updates and apply them:** see [UPDATE.md](./UPDATE.md).

---

### Troubleshooting

**`docker: command not found` / `'docker' is not recognized`**
Docker isn't installed, or (Windows) Docker Desktop isn't running yet -- check the
system tray for the whale icon. On Linux, make sure Step 1 completed without errors.

**Linux: `permission denied while trying to connect to the Docker daemon socket`**
You ran `usermod -aG docker $USER` but haven't logged out and back in yet. Log out
and back in (or reboot), or temporarily prefix commands with `sudo`.

**Port 3000 is already in use / "port is already allocated"**
Something else on your computer is already using port 3000. Edit `.env` and change
`PORT=3000` to a different number (e.g. `PORT=3001`), then run
`docker compose up -d` again -- both the app and its published port follow this
setting automatically.

**Windows: installer asks about WSL2 / a restart**
This is normal and expected the first time -- just follow the on-screen prompts and
restart when asked, then relaunch Docker Desktop.

**Page loads but shows an error / never finishes "Fetching current weather"**
Check `docker compose logs intellistar` for errors, and make sure `NWS_USER_AGENT` is
set in your `.env` file (Step 3).

**No sound / voice narration doesn't work**
The PiperTTS sidecar container may still be starting up (its healthcheck has a
20-second grace period on first boot). Check with `docker compose ps` and
`docker compose logs piper`.

---

### Where to go next

- [README.md](./README.md) -- full feature overview and all `.env` options.
- [Operation Instructions](./docs/IntelliSTAR_Operation.md) -- how to use the on-screen
  settings dialog once the app is running.
- [UPDATE.md](./UPDATE.md) -- how to update to newer versions later on.
