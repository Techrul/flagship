# 🚩 Flagship

A game launcher for Scratch games. Paste a project link, and Flagship downloads it, keeps a local copy, and plays it with [TurboWarp](https://turbowarp.org/)'s fast player — no browser tab needed.

> **Status:** early beta (v0.1). Expect things to break.

## Features (v0.1)

- Add games by pasting a Scratch or TurboWarp link, or just the project ID
- Games are cached locally, so they keep working even if they get unshared
- Library grid with thumbnails and playtime tracking
- Cloud-variable saves are kept on your computer, per game
- True-black OLED theme (plus Mocha)

## Roadmap

| Version | Focus |
|---|---|
| v0.2 | Per-game notes & save-code vault, per-game TurboWarp settings, collections |
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
