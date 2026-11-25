# 🚩 Flagship

A game launcher for Scratch games. Paste a project link, and Flagship downloads it, keeps a local copy, and plays it with [TurboWarp](https://turbowarp.org/)'s fast player — no browser tab needed.

> **Status:** early beta (v0.4). Expect things to break.

## Features

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
- **Built-in updates**: Flagship checks GitHub on launch and updates itself with one click

## Custom themes

Settings → Appearance → **Open folder**. Copy `example.css`, rename it, change the colors, then hit **Reload**. The first line (`/* name: My Theme */`) sets the name shown in Flagship. Any color you don't set falls back to the OLED theme.

## Roadmap

| Version | Focus |
|---|---|
| v0.2 | ✅ Settings, per-game TurboWarp settings, themes |
| v0.3 | ✅ Setting profiles, Enhanced default, built-in updater · next: notes & save-code vault, collections |
| v0.3 | Search Scratch, curated recommendations, studio import, custom themes |
| v0.4 | Big picture mode, controller navigation, verified controller presets |
| Later | Save states, plugins, maybe itch.io |

## Download

Grab the file for your system from the [latest release](https://github.com/Techrul/flagship/releases):

| System | File | Notes |
|---|---|---|
| **Windows** | `Flagship-…-win-x64.exe` (or `win-arm64` for ARM laptops) | Installer. Or the `.zip` for a portable copy. |
| **macOS** (Intel & Apple Silicon) | `Flagship-…-mac-universal.dmg` | See the first-launch note below. |
| **Any Linux** | `Flagship-…-linux-….AppImage` | Make it executable, double-click. Works on Steam Deck too. |
| **Debian / Ubuntu / Mint / Pop!_OS** | `Flagship-…-linux-amd64.deb` (or `arm64`) | `sudo apt install ./Flagship-….deb` |
| **Fedora / openSUSE** | `Flagship-…-linux-x86_64.rpm` (or `aarch64`) | `sudo dnf install ./Flagship-….rpm` |
| **Arch / CachyOS / Manjaro** | `Flagship-…-linux-x64.pacman` | `sudo pacman -U ./Flagship-….pacman` |
| **Other Linux** | `Flagship-…-linux-….tar.gz` | Unpack anywhere and run `flagship`. |

Installed copies check GitHub for new versions on launch and show a banner when one is out.

**macOS first launch:** Flagship isn't signed with a paid Apple certificate yet, so macOS blocks it the first time.
Open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**. After that it opens normally.

**Windows:** SmartScreen may say "Windows protected your PC" for the same reason. Click **More info → Run anyway**.

## Running from source


Needs [Node.js](https://nodejs.org/) 22+ and git.

```sh
git clone https://github.com/Techrul/flagship
cd flagship
npm install
npm start
```

To open Flagship like a normal app, go to **Settings → Updates & about → Add to app menu**
(Linux and Windows). It launches your clone, so updates keep working.

After that, Flagship updates itself: when there's a new version, a banner shows up with an **Update now** button
(or go to Settings → Updates & about). You can also update by hand with `git pull` then `npm start`.

`npm test` runs the tests, `npm run build` makes a production build.

## Credits & legal

- Games run on the [TurboWarp](https://github.com/TurboWarp) player (Scaffolding, from [`@turbowarp/packager`](https://github.com/TurboWarp/packager)) and are downloaded with [`@turbowarp/sbdl`](https://github.com/forkphorus/sb-downloader).
- Scratch projects belong to their creators and are shared under Scratch's Creative Commons license. Flagship always shows the original author.
- Flagship is not affiliated with, endorsed by, or connected to the Scratch Team or Scratch Foundation. Scratch is a trademark of the Scratch Foundation.

Flagship itself is MIT licensed. See [LICENSE](LICENSE).
