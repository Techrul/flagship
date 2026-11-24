# 🚩 Flagship

A game launcher for Scratch games. Paste a project link, and Flagship downloads it, keeps a local copy, and plays it with [TurboWarp](https://turbowarp.org/)'s fast player — no browser tab needed.

> **Status:** early beta (v0.3). Expect things to break.

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
