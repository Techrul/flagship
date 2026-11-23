// Custom themes are plain .css files in <userData>/themes/ that redefine Flagship's color variables.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CustomThemeInfo } from '../shared/themes';

const FILE = /^[\w .-]{1,80}\.css$/;

const EXAMPLE = `/* name: Example (edit me!) */
/*
  Flagship custom theme.
  Copy this file, rename it, change the colors, then pick it in Settings → Appearance.
  Hit "Reload" in Settings after saving changes. The first line sets the name shown in Flagship.
*/
:root {
  --bg: #04121a;            /* window background */
  --surface: #0a2230;       /* cards, inputs, menus */
  --surface-hover: #113246; /* hovered cards and buttons */
  --border: #16394d;        /* outlines */
  --text: #e6f7ff;          /* main text */
  --text-dim: #7fa6b8;      /* secondary text */
  --accent: #38e1ff;        /* buttons, highlights */
  --accent-text: #00141a;   /* text on top of the accent color */
  --danger: #ff6b8b;        /* remove buttons, errors */
  --radius: 14px;           /* corner roundness */
}
`;

export class CustomThemes {
  constructor(readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    const example = path.join(dir, 'example.css');
    if (fs.readdirSync(dir).length === 0) fs.writeFileSync(example, EXAMPLE);
  }

  list(): CustomThemeInfo[] {
    return fs.readdirSync(this.dir)
      .filter((file) => FILE.test(file))
      .sort()
      .map((file) => {
        const head = fs.readFileSync(path.join(this.dir, file), 'utf8').slice(0, 300);
        const name = head.match(/\/\*\s*name:\s*([^*\n]{1,60}?)\s*\*\//i)?.[1] ?? file.replace(/\.css$/, '');
        return { id: `custom:${file}`, name, file };
      });
  }

  /** Absolute path for a theme file, or null if the name is invalid or missing. */
  resolve(file: string): string | null {
    if (!FILE.test(file)) return null;
    const full = path.join(this.dir, file);
    return fs.existsSync(full) ? full : null;
  }
}
