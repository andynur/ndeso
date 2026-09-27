import { describe, expect, test } from 'bun:test';
import { maskLiterals, scanImports } from './scan.ts';

const specifiers = (source: string): string[] => scanImports(source).map((ref) => ref.specifier);

describe('scanImports', () => {
  test('finds every shape of module reference', () => {
    const source = [
      "import { a } from './a.ts';",
      "import b from 'b';",
      "import * as c from 'c';",
      "import './side-effect.css';",
      "export { d } from './d.ts';",
      "export * from './e.ts';",
      "const f = await import('./f.ts');",
      "const g = require('g');",
    ].join('\n');
    expect(specifiers(source)).toEqual([
      './a.ts',
      'b',
      'c',
      './side-effect.css',
      './d.ts',
      './e.ts',
      './f.ts',
      'g',
    ]);
  });

  test('reports the line of each specifier, including multi-line statements', () => {
    const source = ['import {', '  a,', '  b,', "} from './a.ts';", '', "import 'x';"].join('\n');
    expect(scanImports(source)).toEqual([
      { specifier: './a.ts', typeOnly: false, dynamic: false, line: 4 },
      { specifier: 'x', typeOnly: false, dynamic: false, line: 6 },
    ]);
  });

  test('separates type-only statements from value imports', () => {
    const refs = scanImports(
      [
        "import type { A } from './a.ts';",
        "export type { B } from './b.ts';",
        "import { type C, d } from './c.ts';",
      ].join('\n'),
    );
    expect(refs.map((ref) => [ref.specifier, ref.typeOnly])).toEqual([
      ['./a.ts', true],
      ['./b.ts', true],
      // A statement that also pulls a value in is a value import, whatever is marked inside it.
      ['./c.ts', false],
    ]);
  });

  test('ignores imports that are only text', () => {
    const source = [
      "// import { bad } from 'three';",
      "/* import { worse } from 'preact'; */",
      'const doc = "import { fake } from \'three\'";',
      "const hint = `import { alsoFake } from 'three'`;",
      "import { real } from './real.ts';",
    ].join('\n');
    expect(specifiers(source)).toEqual(['./real.ts']);
  });

  test('is not derailed by a regex literal holding a quote', () => {
    const source = ['const quoted = /[\'"]/g;', "import { real } from './real.ts';"].join('\n');
    expect(specifiers(source)).toEqual(['./real.ts']);
  });

  test('skips a shebang so its slashes do not open a regex', () => {
    const source = ['#!/usr/bin/env bun', "import { a } from './a.ts';"].join('\n');
    expect(specifiers(source)).toEqual(['./a.ts']);
  });

  test('does not mistake an ordinary export for a re-export', () => {
    const source = [
      'export const from = 1;',
      'export function pick() { return rows.map((r) => r.from); }',
      'export class Store { read() { return this.rows.from; } }',
    ].join('\n');
    expect(specifiers(source)).toEqual([]);
  });

  test('sees through a template interpolation', () => {
    // A masked-over `${…}` would hide exactly what this tool exists to catch.
    const source = 'const x = `${await import("three")}`;';
    expect(specifiers(source)).toEqual(['three']);
  });

  test('sees through a nested template interpolation', () => {
    const source = 'const x = `a${`b${await import("three")}`}c`;';
    expect(specifiers(source)).toEqual(['three']);
  });

  test('tracks braces inside an interpolation', () => {
    const source = ['const x = `${ {k: 1}.k }`;', "import { real } from './real.ts';"].join('\n');
    expect(specifiers(source)).toEqual(['./real.ts']);
  });

  test('skips a computed dynamic import', () => {
    const source = 'const m = await import(`./locales/${id}.json`);';
    expect(specifiers(source)).toEqual([]);
  });
});

describe('maskLiterals', () => {
  test('blanks template text but leaves its interpolations as code', () => {
    const masked = maskLiterals('const id = `seed-${Math.random()}`;');
    expect(masked).toContain('Math.random()');
    expect(masked).not.toContain('seed-');
  });

  test('blanks comments and literal contents but keeps the line layout', () => {
    const source = ["const a = 'Math.random()'; // Math.random()", 'const b = Math.random();'].join(
      '\n',
    );
    const masked = maskLiterals(source);
    expect(masked.split('\n')).toHaveLength(2);
    expect(masked.split('\n')[0]).not.toContain('Math.random');
    expect(masked.split('\n')[1]).toContain('Math.random()');
    expect(masked).toHaveLength(source.length);
  });
});
