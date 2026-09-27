import { describe, expect, test } from 'bun:test';
import { checkSource, regionOf, resolveSpecifier } from './rules.ts';

const messages = (file: string, source: string): string[] =>
  checkSource(file, source).map((violation) => violation.message);

describe('regionOf', () => {
  test('picks the most specific row of the ARCHITECTURE §2 table', () => {
    expect(regionOf('apps/client/src/render/scene.ts')).toBe('apps/client/src/render');
    expect(regionOf('apps/client/src/ui/app.tsx')).toBe('apps/client/src/ui');
    expect(regionOf('apps/client/src/main.ts')).toBe('apps/client');
    expect(regionOf('packages/sim/src/index.ts')).toBe('packages/sim');
    expect(regionOf('tools/check-deps.ts')).toBe('tools');
  });

  test('is undefined outside the source tree', () => {
    expect(regionOf('docs/ARCHITECTURE.md')).toBeUndefined();
  });
});

describe('resolveSpecifier', () => {
  test('resolves a relative specifier against the importing file', () => {
    expect(resolveSpecifier('apps/client/src/ui/app.tsx', '../render/quality/presets.ts')).toEqual({
      kind: 'region',
      path: 'apps/client/src/render/quality/presets.ts',
      region: 'apps/client/src/render',
    });
  });

  test('maps a workspace package to its directory, subpath included', () => {
    expect(resolveSpecifier('packages/sim/src/index.ts', '@ndeso/content/i18n')).toEqual({
      kind: 'region',
      path: 'packages/content/i18n',
      region: 'packages/content',
    });
  });

  test('reduces a deep npm specifier to its package', () => {
    expect(resolveSpecifier('apps/client/src/render/scene.ts', 'three/examples/jsm/x.js')).toEqual({
      kind: 'package',
      name: 'three',
    });
  });

  test('recognises host builtins', () => {
    expect(resolveSpecifier('tools/x.ts', 'node:path').kind).toBe('builtin');
    expect(resolveSpecifier('tools/x.ts', 'bun:test').kind).toBe('builtin');
  });
});

describe('packages/sim', () => {
  const file = 'packages/sim/src/systems/hello.ts';

  // ROADMAP M0-05 acceptance criterion.
  test('importing three fails the check', () => {
    expect(messages(file, "import { Vector3 } from 'three';")).toEqual([
      "imports 'three' — packages/sim may import no third-party package",
    ]);
  });

  test('preact fails the same way', () => {
    expect(messages(file, "import { signal } from '@preact/signals';")).toHaveLength(1);
  });

  test('shared is allowed', () => {
    expect(messages(file, "import { TICK_MS } from '@ndeso/shared';")).toEqual([]);
  });

  test('content is types only', () => {
    expect(messages(file, "import type { CropId } from '@ndeso/content';")).toEqual([]);
    expect(messages(file, "import { CROPS } from '@ndeso/content';")).toEqual([
      "imports '@ndeso/content' as a value — packages/sim may only import types from packages/content",
    ]);
  });

  test('the client is out of reach', () => {
    expect(messages(file, "import { boot } from '../../../apps/client/src/main.ts';")).toHaveLength(
      1,
    );
  });

  test('purity rules fire on globals the import graph cannot see', () => {
    expect(messages(file, 'const roll = Math.random();')).toEqual([
      'uses Math.random — use the seeded rng in state (ARCHITECTURE §3.1)',
    ]);
    expect(messages(file, 'const now = Date.now();')).toHaveLength(1);
    expect(messages(file, 'setTimeout(step, 100);')).toHaveLength(1);
    expect(messages(file, 'document.body.append(node);')).toHaveLength(1);
  });

  test('purity rules do not fire on prose', () => {
    expect(messages(file, '// never call Math.random() here\nconst a = 1;')).toEqual([]);
    expect(messages(file, "const why = 'Math.random() is banned';")).toEqual([]);
  });

  test('a colocated test may import bun:test', () => {
    expect(
      messages('packages/sim/src/systems/hello.test.ts', "import { test } from 'bun:test';"),
    ).toEqual([]);
  });

  test('production code may not import a host runtime', () => {
    expect(messages(file, "import { join } from 'node:path';")).toHaveLength(1);
  });
});

describe('packages/shared', () => {
  const file = 'packages/shared/src/save.ts';

  test('zod is the only package it may import', () => {
    expect(messages(file, "import { z } from 'zod';")).toEqual([]);
    expect(messages(file, "import { create } from 'zustand';")).toEqual([
      "imports 'zustand' — packages/shared may import only zod",
    ]);
  });

  test('it may not reach back into the repo', () => {
    expect(messages(file, "import { step } from '@ndeso/sim';")).toHaveLength(1);
    expect(messages(file, "import { CONTENT_ROOT } from '@ndeso/content';")).toHaveLength(1);
  });
});

describe('apps/client/src/render', () => {
  const file = 'apps/client/src/render/scene.ts';

  test('three and the sim are its business', () => {
    expect(messages(file, "import { Scene } from 'three';")).toEqual([]);
    expect(messages(file, "import type { GameState } from '@ndeso/sim';")).toEqual([]);
  });

  test('it must not import the overlay, not even a type', () => {
    expect(messages(file, "import type { AppProps } from '../ui/app.tsx';")).toEqual([
      "imports '../ui/app.tsx' — render/ must not import ui/ — pass what it needs in as options",
    ]);
  });

  test('it must not import preact', () => {
    expect(messages(file, "import { render } from 'preact';")).toHaveLength(1);
    expect(messages(file, "import { signal } from '@preact/signals';")).toHaveLength(1);
  });
});

describe('apps/client/src/ui', () => {
  const file = 'apps/client/src/ui/app.tsx';

  test('preact and i18n are its business', () => {
    expect(messages(file, "import { render } from 'preact';")).toEqual([]);
    expect(messages(file, "import { t } from '../i18n/index.ts';")).toEqual([]);
  });

  test('it must not import three or the renderer', () => {
    expect(messages(file, "import { Scene } from 'three';")).toEqual([
      "imports 'three' — ui/ is a DOM overlay; Three.js belongs to render/",
    ]);
    expect(messages(file, "import { createScene } from '../render/scene.ts';")).toHaveLength(1);
  });
});

describe('the client bundle', () => {
  test('no zone of it may import build-time code', () => {
    expect(
      messages('apps/client/src/main.ts', "import { x } from '../../../tools/dev.ts';"),
    ).toEqual([
      "imports '../../../tools/dev.ts' — tools/ is build-time only and never ships in a bundle",
    ]);
  });

  test('and none of it may import node builtins', () => {
    expect(
      messages('apps/client/src/platform/settings.ts', "import { join } from 'node:path';"),
    ).toEqual(["imports 'node:path' — apps/client is bundled for the browser"]);
  });
});

describe('unconstrained regions', () => {
  test('tools may import whatever they need', () => {
    expect(
      messages(
        'tools/i18n/check.ts',
        "import { join } from 'node:path';\nimport { z } from 'zod';",
      ),
    ).toEqual([]);
  });
});
