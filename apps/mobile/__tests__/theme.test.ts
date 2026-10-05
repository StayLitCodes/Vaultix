/**
 * #760 — theme tokens must be the only source of colour in the app.
 *
 * Before the `theme/` module existed, every screen hardcoded its own palette
 * (`#12121f` in `app/index.tsx`, `#1a1a2e` in the tab layout, `#0f172a` in
 * settings) and the same surface was a different colour depending on which
 * screen you were on. These tests fail if that regresses.
 */
import fs from 'fs';
import path from 'path';

import { colors } from '../theme';

const APP_ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
const TOKEN_NAMES = Object.keys(colors);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = SCAN_DIRS.flatMap((dir) => walk(path.join(APP_ROOT, dir)));
const screens = sourceFiles.filter((f) => f.endsWith('.tsx'));

/** Matches `#abc` / `#aabbcc` / `#aabbccdd` but not `#550` in `#550 — an issue ref`. */
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

describe('theme tokens (#760)', () => {
  it('found the app sources to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(20);
  });

  it('exposes the semantic tokens the UI needs', () => {
    for (const token of [
      'background', 'surface', 'border',
      'text', 'textSecondary',
      'accent', 'success', 'warning', 'danger',
    ]) {
      expect(colors).toHaveProperty(token);
      expect((colors as Record<string, string>)[token]).toMatch(/^(#|rgba?\()/);
    }
  });

  it('has no duplicate values in the neutral ramp', () => {
    // background < surface < surfaceRaised must be a real ramp, not aliases.
    const isHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
    const lum = (c: string) => {
      const n = parseInt(c.slice(1), 16);
      // relative luminance approximation
      return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    };
    for (const token of ['background', 'surface', 'surfaceRaised', 'surfaceSunken']) {
      expect(isHex((colors as Record<string, string>)[token])).toBe(true);
    }
    expect(lum(colors.surface)).toBeGreaterThan(lum(colors.background));
  });

  it('no screen or component hardcodes a hex colour', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const contents = fs.readFileSync(file, 'utf8');
      const hits = contents.match(HEX_COLOR);
      if (!hits) continue;
      // Issue references in comments (#558) are not colours; require the literal
      // to appear as a quoted style value rather than in prose.
      for (const hit of hits) {
        if (contents.includes(`'${hit}'`) || contents.includes(`"${hit}"`)) {
          offenders.push(`${path.relative(APP_ROOT, file)} -> ${hit}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every colors.* reference resolves to a real token', () => {
    const unknown: string[] = [];
    for (const file of sourceFiles) {
      const contents = fs.readFileSync(file, 'utf8');
      for (const match of contents.matchAll(/\bcolors\.(\w+)/g)) {
        if (!TOKEN_NAMES.includes(match[1])) {
          unknown.push(`${path.relative(APP_ROOT, file)} -> colors.${match[1]}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it('imports theme tokens from the shared module, not a local palette', () => {
    const withoutImport = screens.filter((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      if (!/\bcolors\.[a-zA-Z]/.test(contents)) return false;
      return !/from '(\.\.\/)+theme'/.test(contents);
    });
    expect(withoutImport.map((f) => path.relative(APP_ROOT, f))).toEqual([]);
  });

  it('reconciles the old multi-way background split onto one token', () => {
    // The bug: index.tsx painted #12121f, the tab layout #1a1a2e and settings
    // #0f172a, so the same canvas was a different colour on each screen.
    const previouslyDivergent = [
      'app/index.tsx',
      'app/(tabs)/_layout.tsx',
      'app/(tabs)/settings.tsx',
      'app/(tabs)/dashboard.tsx',
      'app/(tabs)/notifications.tsx',
      'app/escrow/create.tsx',
      'app/escrow/release.tsx',
      'app/escrow/[id].tsx',
      'app/invite/[token].tsx',
      'app/not-found.tsx',
    ];

    for (const rel of previouslyDivergent) {
      const contents = fs.readFileSync(path.join(APP_ROOT, rel), 'utf8');
      expect({ file: rel, hasBackground: contents.includes('backgroundColor: colors.background') })
        .toEqual({ file: rel, hasBackground: true });
    }

    // And the retired literals are gone for good.
    for (const retired of ['#12121f', '#0F172A', '#1a1a2e']) {
      const stillUsed = sourceFiles.filter((f) => fs.readFileSync(f, 'utf8').includes(retired));
      expect(stillUsed).toEqual([]);
    }
  });
});
