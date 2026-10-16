import { expect, test } from 'vite-plus/test';
import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';

const root = new URL('../src/', import.meta.url);
const sources = new Map(
  readdirSync(root, { recursive: true })
    .map((file) => String(file).replaceAll('\\', '/'))
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => [file, readFileSync(new URL(file, root), 'utf8')]),
);

function dependencies(source: string): string[] {
  const tokens: { kind: 'string' | 'other'; value: string }[] = [];
  const pattern =
    /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|(['"])((?:\\.|(?!\1)[^\\])*)\1|`(?:\\.|[^\\`])*`|[A-Za-z_$][\w$]*|[();]/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1]) tokens.push({ kind: 'string', value: match[2] });
    else if (!match[0].startsWith('//') && !match[0].startsWith('/*'))
      tokens.push({ kind: 'other', value: match[0] });
  }
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    if (current.kind !== 'other') continue;
    const next = tokens[i + 1];
    const third = tokens[i + 2];
    if ((current.value === 'import' || current.value === 'from') && next?.kind === 'string') {
      result.push(next.value);
    } else if (
      (current.value === 'import' || current.value === 'require') &&
      next?.kind === 'other' &&
      next.value === '(' &&
      third?.kind === 'string'
    ) {
      result.push(third.value);
    }
  }
  return result;
}

function target(file: string, dependency: string) {
  return dependency.startsWith('.')
    ? posix.normalize(posix.join(posix.dirname(file), dependency))
    : dependency;
}

test('architecture inspection includes side-effect imports, re-exports and dynamic/type imports', () => {
  expect(
    dependencies(`import './one'; export { x } from './two';
    const lazy = import('./three'); type T = import('./four').T;
    const node = require('node:fs'); import old = require('./five');
    // import './ignored';
  `),
  ).toEqual(['./one', './two', './three', './four', 'node:fs', './five']);
});

test('core and application depend only inward, including nested directories', () => {
  for (const [file, source] of sources) {
    const layer = file.split('/')[0];
    if (layer !== 'core' && layer !== 'application') continue;
    for (const dependency of dependencies(source)) {
      expect(dependency, file).toMatch(/^\./);
      const destination = target(file, dependency).split('/')[0];
      expect(layer === 'core' ? ['core'] : ['core', 'application'], file).toContain(destination);
    }
    expect(source, file).not.toMatch(
      /\b(window|document\.createElement|DOMParser|XMLSerializer|HTMLElement|Blob|FileReader|localStorage|globalThis|fetch|setTimeout|setInterval)\b/,
    );
    if (layer === 'core') expect(source, file).not.toMatch(/Math\.random|Date\.now|new\s+Date\b/);
  }
});

test('UI and adapters cannot couple to each other or to bootstrap', () => {
  for (const [file, source] of sources) {
    const layer = file.split('/')[0];
    if (layer !== 'ui' && layer !== 'adapters') continue;
    for (const dependency of dependencies(source)) {
      const destination = target(file, dependency);
      expect(destination, file).not.toMatch(/^(bootstrap|index)(\.|\/|$)/);
      if (layer === 'ui') expect(destination, file).not.toMatch(/^adapters\/|^@tauri-apps/);
      else expect(destination, file).not.toMatch(/^ui\/|^solid-js/);
    }
    if (layer === 'ui')
      expect(source, file).not.toMatch(/\blocalStorage\b|\bmatchMedia\b|document\.documentElement/);
  }
});

test('source module dependencies have no cycles', () => {
  const visited = new Set<string>();
  function visit(file: string, path: string[]) {
    expect(path, `Dependency cycle: ${[...path, file].join(' -> ')}`).not.toContain(file);
    if (visited.has(file)) return;
    for (const dependency of dependencies(sources.get(file)!)) {
      if (!dependency.startsWith('.')) continue;
      const resolved = target(file, dependency);
      const child = [
        resolved,
        resolved + '.ts',
        resolved + '.tsx',
        resolved + '/index.ts',
        resolved + '/index.tsx',
      ].find((candidate) => sources.has(candidate));
      if (child) visit(child, [...path, file]);
    }
    visited.add(file);
  }
  for (const file of sources.keys()) visit(file, []);
});
