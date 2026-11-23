# 🚩 Flagship

A game launcher for Scratch games. Paste a project link, and Flagship downloads it, keeps a local copy, and plays it with [TurboWarp](https://turbowarp.org/)'s fast player — no browser tab needed.

> **Status:** early beta (v0.2). Expect things to break.

## Features

- Add games by pasting a Scratch or TurboWarp link, or just the project ID
- Games are cached locally, so they keep working even if they get unshared
- Library grid with thumbnails and playtime tracking
- Cloud-variable saves are kept on your computer, per game
- **Settings** for every TurboWarp option (FPS, interpolation, turbo, compiler, clone limits, stage size, username, controller support, mouse lock…), each explained in plain English
- **Per-game settings**: override any option for one game; everything else follows your defaults
- **10 built-in themes** (true-black OLED by default), a custom accent color, and **custom themes** — drop a CSS file in the themes folder

## Custom themes

Settings → Appearance → **Open folder**. Copy `example.css`, rename it, change the colors, then hit **Reload**. The first line (`/* name: My Theme */`) sets the name shown in Flagship. Any color you don't set falls back to the OLED theme.

## Roadmap

| Version | Focus |
|---|---|
| v0.2 | ✅ Settings, per-game TurboWarp settings, themes · next: notes & save-code vault, collections |
| v0.3 | Search Scratch, curated recommendations, studio import, custom themes |
| v0.4 | Big picture mode, controller navigation, verified controller presets |
| Later | Save states, plugins, maybe itch.io |

## Running from source

Needs [Node.js](https://nodejs.org/) 22+.

```sh
npm install
npm start
```

`npm test` runs the tests, `npm run build` makes a production build.

## Credits & legal

- Games run on the [TurboWarp](https://github.com/TurboWarp) player (Scaffolding, from [`@turbowarp/packager`](https://github.com/TurboWarp/packager)) and are downloaded with [`@turbowarp/sbdl`](https://github.com/forkphorus/sb-downloader).
- Scratch projects belong to their creators and are shared under Scratch's Creative Commons license. Flagship always shows the original author.
- Flagship is not affiliated with, endorsed by, or connected to the Scratch Team or Scratch Foundation. Scratch is a trademark of the Scratch Foundation.

Flagship itself is MIT licensed. See [LICENSE](LICENSE).
