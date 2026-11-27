# 🚩 Flagship

A game launcher for Scratch games. Paste a project link, and Flagship downloads it, keeps a local copy, and plays it with [TurboWarp](https://turbowarp.org/)'s fast player — no browser tab needed.

> [!WARNING]
> ## 🤖 This project is vibe-coded
> **Almost all of Flagship's code, tests, build setup and docs were written by an AI** ([Claude](https://claude.ai)).
> Techrul (the human here) decides what to build, tests it, reports bugs and makes the calls — but **does not write or review the code line by line.**
>
> What that means for you:
> - It works (and has automated tests), but it hasn't had the careful human review a normal project gets. **There will be bugs**, and possibly mistakes a human programmer would have caught.
> - Don't use it for anything important. It's a fun launcher for Scratch games, provided as-is under the [MIT license](LICENSE) with no warranty.
> - Found a problem? [Open an issue](https://github.com/Techrul/flagship/issues). Code contributions from actual humans are very welcome.
>
> Because of this, Flagship is **not** on Flathub, which [requires disclosure of AI-generated code and lets reviewers reject it](https://docs.flathub.org/docs/for-app-authors/requirements#generative-ai-policy).

> **Status:** early beta (v0.4). Expect things to break.

If you'd like to get the newest builds earlier you can check out the [beta branch](https://github.com/Techrul/flagship/tree/beta). There can and will be bugs and issues so be aware.

## Install

### With a package manager (recommended — no "unknown app" warnings)

| System | Command |
|---|---|
| **Windows** (winget) | `winget install Techrul.Flagship` |
| **Windows** (Scoop) | `scoop bucket add flagship https://github.com/Techrul/flagship` then `scoop install flagship/flagship` |
| **macOS** (Homebrew) ⚠️ untested | `brew tap techrul/flagship https://github.com/Techrul/flagship` then `brew install --cask techrul/flagship/flagship` |
| **Arch / CachyOS / Manjaro / EndeavourOS** | See [Arch Linux](#arch-linux) below. (The AUR package is ready but waiting: [AUR registration is paused](https://archlinux.org/news/).) |

> **Coming soon:** these go live with the first stable release (betas aren't published to package managers).
> winget also waits for Microsoft to approve the first submission.

Package managers update Flagship for you (`winget upgrade`, `scoop update`, `brew upgrade`).

Why no warnings? Windows and macOS only warn about apps that were *downloaded by a browser*. Package managers download
and verify the file themselves (checking its checksum), so the warning doesn't apply. The Homebrew tap is Techrul's own
(not Homebrew's official list), so it can clear macOS's "downloaded" flag after installing — you're trusting this repo when you use it.

### Or download it

Grab the file for your system from the [latest release](https://github.com/Techrul/flagship/releases):

| System | File | Notes |
|---|---|---|
| **Windows** | `Flagship-…-win-x64.exe` (or `win-arm64` for ARM laptops) | Installer. Or the `.zip` for a portable copy. |
| **macOS** (Intel & Apple Silicon) ⚠️ untested | `Flagship-…-mac-universal.dmg` | See the Mac notes below. |
| **Any Linux** | `Flagship-…-linux-….AppImage` | Make it executable, double-click. Works on Steam Deck too. |
| **Debian / Ubuntu / Mint / Pop!_OS** | `Flagship-…-linux-amd64.deb` (or `arm64`) | `sudo apt install ./Flagship-….deb` |
| **Fedora / openSUSE** | `Flagship-…-linux-x86_64.rpm` (or `aarch64`) | `sudo dnf install ./Flagship-….rpm` |
| **Arch / CachyOS / Manjaro** | `Flagship-…-linux-x64.pacman` (or `aarch64` for ARM) | See [Arch Linux](#arch-linux) below. |
| **Other Linux** | `Flagship-…-linux-….tar.gz` | Unpack anywhere and run `flagship`. |

Most copies update themselves. See [Updates](#updates) below.
Every release has a `SHA256SUMS.txt` if you want to verify your download.

**Windows:** Flagship isn't signed with a paid certificate, so SmartScreen may say "Windows protected your PC". Click **More info → Run anyway**.

**macOS:** same reason — macOS blocks it the first time. Open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**. After that it opens normally.

> [!CAUTION]
> **The Mac version is untested.** I don't actually have a Mac, so no one has actually installed or played Flagship on one yet.
> It's built automatically on GitHub's Mac machines and the automated tests pass there, but that's all.
> The Homebrew tap's trick for skipping the "unidentified developer" block is untested too.
> If you try it on a Mac, please [open an issue](https://github.com/Techrul/flagship/issues) saying whether it worked, even if it did.

### Arch Linux

Works on Arch and anything based on it (CachyOS, EndeavourOS, Manjaro, Garuda…). Until the AUR package is up, pick one:

**Option 1 — prebuilt package (quickest).** Downloads the newest `.pacman` from GitHub and installs it:

```sh
curl -LO "$(curl -s https://api.github.com/repos/Techrul/flagship/releases/latest | grep -o 'https://[^"]*linux-x64\.pacman')"
sudo pacman -U ./Flagship-*-linux-x64.pacman
```

On an ARM device, change both `linux-x64` to `linux-aarch64`. (These commands work in bash, zsh and fish.)

**Option 2 — build the package yourself with `makepkg`.** Uses the same PKGBUILD that will go to the AUR, so you can read exactly what it does first:

```sh
git clone https://github.com/Techrul/flagship
cd flagship/packaging/aur
less PKGBUILD        # optional: have a look
makepkg -si
```

**Updating:** with option 1, Flagship updates itself: it downloads the new version and asks for your password to install it.
(Or run the same two commands again; delete the old `.pacman` file first so the `*` only matches the new one.) For option 2,
Flagship shows a banner; run `git pull` in the `flagship` folder, then `makepkg -si` again in `packaging/aur`.

**Uninstalling:** **Settings → Updates & about → Uninstall Flagship…** (asks for your password). Or in a terminal: `sudo pacman -R flagship` (option 1) or `sudo pacman -R flagship-bin` (option 2).
Your library, settings and saves stay in `~/.config/Flagship`; delete that folder too if you want them gone.

**Later, from the AUR:** `yay -S flagship-bin` (or `paru -S flagship-bin`) once AUR registration reopens.
pacman will offer to replace whichever option you used (answer yes).

## Updates

Flagship checks for a new version when it starts (and every few hours while it's open). What happens next depends on how you installed it:

| How you installed it | What happens |
|---|---|
| **AppImage** (recommended for Steam Deck, handhelds and big picture) | Downloads in the background, then installs when you close Flagship. Or click **Restart now**. No password needed. |
| **Windows installer** (`.exe`) | Same: downloads in the background, installs when you close it. |
| **`.deb` / `.rpm` / `.pacman`** (incl. Arch option 1) | Downloads in the background, then **Install** asks for your password (it's a system package) and restarts. |
| **winget / Scoop / Homebrew** | Shows a banner; update with `winget upgrade`, `scoop update flagship` or `brew upgrade`. |
| **Arch option 2** (`makepkg`) / `.tar.gz` / portable `.zip` | Shows a banner with a download link. |
| **macOS `.dmg`** ⚠️ untested | Shows a banner with a download link. (Self-updating on Mac needs a paid Apple certificate.) |
| **git clone** | **Update now** pulls the new commits and restarts. |

Betas only update to newer betas or stable releases. Stable copies never jump to a beta.

> [!NOTE]
> Self-updating starts with **v0.5.0**. If you have v0.4.x, download v0.5.0 by hand once; it updates itself after that.

## Uninstalling

Go to **Settings → Updates & about → Uninstall Flagship…**. It removes Flagship the right way for how you installed it
(deletes the AppImage, runs the Windows uninstaller, or removes the .deb/.rpm/.pacman package, which asks for your password).
Tick the box if you also want your library, notes and settings gone; otherwise they stay for next time.
For winget, Scoop, Homebrew and portable copies it shows the command (or folder) to remove instead.



- Add games by pasting a Scratch or TurboWarp link, or just the project ID
- Games are cached locally, so they keep working even if they get unshared
- Library grid with thumbnails and playtime tracking
- Cloud-variable saves are kept on your computer, per game
- **Setting profiles**: every TurboWarp option (FPS, interpolation, turbo, compiler, clone limits, stage size, controller support, mouse lock…) explained in plain English, saved as named profiles
  - **Enhanced** (default): interpolation, HQ pen, warp timer, infinite clones, no fencing, no misc limits, pause button — better than vanilla and almost never breaks a game
  - **Vanilla**: exactly like Scratch
  - Make as many of your own as you want, and pick any of them as the default
- Pick a profile when adding a game, change it later, and tweak individual settings per game
- **11 built-in themes** (true-black OLED by default), a custom accent color, and **custom themes** — drop a CSS file in the themes folder
- **Pause button**: freezes scripts, timers and sound, then resumes exactly where you left off
- Runs on **Windows, macOS and Linux**, on both x64 and ARM

## Custom themes

Settings → Appearance → **Open folder**. Copy `example.css`, rename it, change the colors, then hit **Reload**. The first line (`/* name: My Theme */`) sets the name shown in Flagship. Any color you don't set falls back to the OLED theme.

## Roadmap

| Version | Focus |
|---|---|
| v0.1 – v0.3 | ✅ Library, downloader, player, settings, profiles, themes, pause button, git updater |
| v0.4 | ✅ Builds for every platform, GitHub releases, package managers |
| v0.5 | ✅ Self-updating (AppImage, Windows installer, .deb/.rpm/.pacman), uninstall button |
| Next | Per-game notes & save-code vault, collections |
| Then | Search Scratch, curated recommendations, studio import |
| Then | Big picture mode, controller navigation, verified controller presets |
| Later | Save states, plugins, maybe itch.io |

## Running from source

Needs [Node.js](https://nodejs.org/) 22+ and git.

```sh
git clone https://github.com/Techrul/flagship
cd flagship
npm install
npm start
```

To open it like a normal app, go to **Settings → Updates & about → Add to app menu** (Linux and Windows). It launches your clone.

A clone updates itself: when there's a new commit, a banner shows up with an **Update now** button
(or go to Settings → Updates & about). You can also update by hand with `git pull` then `npm start`.

`npm test` runs the tests, `npm run build` makes a production build, `npm run dist` builds installers for your OS into `release/`.

## Maintainer notes

<details>
<summary>How releases and package managers work</summary>

**Branches:** work lands on `beta`; tested work gets merged into `main`. Every push to either builds and tests all platforms (Actions tab).

**Releasing:**
1. Bump `version` in `package.json` (on `beta`, then merge into `main`).
2. On GitHub: **Releases → Draft a new release**. Tag = `v` + that exact version (e.g. `v0.5.0`), target = `main` (or `beta` for a beta). Write the notes.
3. Pick the label:
   - **Pre-release** (use a version like `0.5.0-beta.1`) → only people already on a beta are offered it; package managers skip it.
   - **None** → a normal release, and package managers are updated automatically.
4. Hit **Publish release**. GitHub builds every platform (~15 min) and attaches all the files + `SHA256SUMS.txt` to it.
   If the tag and `package.json` don't match, the build stops with an error: delete the release *and* its tag, fix it, and publish again.

Each release also gets `latest*.yml` and `.blockmap` files. Self-updating copies read these, so don't delete them.
Releases marked **Pre-release** only reach copies already on a beta.

**What updates automatically on a normal (non-pre-release) release:**

| Package manager | How | Setup needed |
|---|---|---|
| Scoop | CI commits `bucket/flagship.json` to `main` | none |
| Homebrew | CI commits `Casks/flagship.rb` to `main` | none |
| winget | CI opens a pull request to `microsoft/winget-pkgs` | Add a `WINGET_TOKEN` repo secret: a GitHub classic token with the `public_repo` scope |
| AUR | CI pushes `packaging/aur/PKGBUILD` to `flagship-bin` | ⏸️ AUR registration is paused (malware cleanup). When it reopens: make an [AUR account](https://aur.archlinux.org/register), add an SSH key to it, then add `AUR_SSH_PRIVATE_KEY` (the private key) and `AUR_EMAIL` repo secrets. The first upload has to be done by hand (below) unless a new stable release goes out after the secrets are added |

Without the secrets, those two steps are skipped with a note in the run log; everything else still works.

First AUR upload by hand (after a stable release, so `packaging/aur/PKGBUILD` exists on `main`):

```sh
git clone ssh://aur@aur.archlinux.org/flagship-bin.git
cp flagship/packaging/aur/PKGBUILD flagship-bin/
cd flagship-bin
makepkg -si                          # build + install it as a test
makepkg --printsrcinfo > .SRCINFO
git add PKGBUILD .SRCINFO && git commit -m "Initial upload" && git push
```
All package files are generated by `scripts/render-packages.mjs` from the release's checksums. Edit that, not the generated files.

</details>

## Credits & legal

- Games run on the [TurboWarp](https://github.com/TurboWarp) player (Scaffolding, from [`@turbowarp/packager`](https://github.com/TurboWarp/packager)) and are downloaded with [`@turbowarp/sbdl`](https://github.com/forkphorus/sb-downloader).
- Scratch projects belong to their creators and are shared under Scratch's Creative Commons license. Flagship always shows the original author.
- Flagship is not affiliated with, endorsed by, or connected to the Scratch Team or Scratch Foundation. Scratch is a trademark of the Scratch Foundation.
- Code written by Claude (Anthropic), directed and tested by Techrul. See the notice at the top.

Flagship itself is MIT licensed. See [LICENSE](LICENSE).
