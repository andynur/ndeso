/**
 * The import boundary table of ARCHITECTURE §2, as data plus the one function that applies it.
 *
 * Pure: everything here works on a repo-relative path and a source string, so the rules are
 * unit-testable without a fixture tree, and the PostToolUse edit hook can reuse the exact
 * check that `bun run check:deps` runs in CI.
 */

import { dirname, normalize } from 'node:path/posix';
import { purityViolations } from './purity.ts';
import { type ImportRef, scanImports } from './scan.ts';

/** Workspace package name → the directory it resolves to. */
export const WORKSPACE_PACKAGES: Readonly<Record<string, string>> = {
  '@bale/shared': 'packages/shared',
  '@bale/sim': 'packages/sim',
  '@bale/content': 'packages/content',
  '@bale/client': 'apps/client',
};

/**
 * Every part of the repo an import can land in, longest prefix first. `regionOf` uses these
 * to turn a path into the row of the ARCHITECTURE §2 table it belongs to.
 */
export const REGION_PREFIXES: readonly string[] = [
  // Build scripts, not part of the bundle: they may use Bun, node: and tools/ (M0-07).
  'apps/client/build.ts',
  'apps/client/build.test.ts',
  'apps/client/src/render',
  'apps/client/src/ui',
  'apps/client/src/game',
  'apps/client/src/platform',
  'apps/client/src/i18n',
  'apps/client',
  'apps/server',
  'packages/shared',
  'packages/sim',
  'packages/content',
  'tools',
  'scripts',
];

const SORTED_REGIONS = [...REGION_PREFIXES].sort((a, b) => b.length - a.length);

export function regionOf(repoPath: string): string | undefined {
  const path = repoPath.replaceAll('\\', '/').replace(/^\.\//, '');
  return SORTED_REGIONS.find((region) => path === region || path.startsWith(`${region}/`));
}

export interface RegionDeny {
  readonly region: string;
  readonly reason: string;
}

export interface PackageDeny {
  /** An exact package name, or `@scope/*`. */
  readonly match: string;
  readonly reason: string;
}

export interface ZoneRule {
  readonly region: string;
  /** Regions this zone may import from. Absent means "any, except `denyRegions`". */
  readonly allowRegions?: readonly string[];
  /** Regions reachable only through `import type` — erased, so no runtime coupling. */
  readonly typeOnlyRegions?: readonly string[];
  readonly denyRegions?: readonly RegionDeny[];
  /** npm packages this zone may import. Absent means "any, except `denyPackages`". */
  readonly allowPackages?: readonly string[];
  readonly denyPackages?: readonly PackageDeny[];
  /** `node:*` and `bun:*`. False for pure and browser zones. */
  readonly allowRuntimeBuiltins: boolean;
  /** Extra source-level rules that are not visible in the import graph. */
  readonly checkPurity?: boolean;
}

const NO_BUILD_TIME: readonly RegionDeny[] = [
  { region: 'tools', reason: 'tools/ is build-time only and never ships in a bundle' },
  { region: 'scripts', reason: 'scripts/ is build-time only and never ships in a bundle' },
  {
    region: 'apps/client/build.ts',
    reason: 'build.ts is the bundler entry, not a module the bundle may import',
  },
];

const BROWSER_ONLY = 'apps/client is bundled for the browser';

/**
 * ARCHITECTURE §2, one entry per constrained row. Regions without an entry — `tools`,
 * `scripts`, `apps/client/build.ts` — are build-time code and unconstrained.
 */
export const ZONE_RULES: readonly ZoneRule[] = [
  {
    region: 'packages/shared',
    allowRegions: ['packages/shared'],
    allowPackages: ['zod'],
    allowRuntimeBuiltins: false,
  },
  {
    region: 'packages/sim',
    allowRegions: ['packages/sim', 'packages/shared'],
    typeOnlyRegions: ['packages/content'],
    allowPackages: [],
    allowRuntimeBuiltins: false,
    checkPurity: true,
  },
  {
    region: 'packages/content',
    allowRegions: ['packages/content', 'packages/shared'],
    allowPackages: ['zod'],
    // The loaders in content/src read locale files from disk for tools and tests.
    allowRuntimeBuiltins: true,
  },
  {
    region: 'apps/client/src/render',
    denyRegions: [
      {
        region: 'apps/client/src/ui',
        reason: 'render/ must not import ui/ — pass what it needs in as options',
      },
      ...NO_BUILD_TIME,
    ],
    denyPackages: [
      { match: 'preact', reason: 'render/ is Three.js only; the overlay owns Preact' },
      { match: '@preact/*', reason: 'render/ is Three.js only; the overlay owns Preact' },
    ],
    allowRuntimeBuiltins: false,
  },
  {
    region: 'apps/client/src/ui',
    denyRegions: [
      {
        region: 'apps/client/src/render',
        reason: 'ui/ must not import render/ — read sim views, not the renderer',
      },
      ...NO_BUILD_TIME,
    ],
    denyPackages: [{ match: 'three', reason: 'ui/ is a DOM overlay; Three.js belongs to render/' }],
    allowRuntimeBuiltins: false,
  },
  {
    region: 'apps/client/src/game',
    denyRegions: [...NO_BUILD_TIME],
    allowRuntimeBuiltins: false,
  },
  {
    region: 'apps/client/src/platform',
    denyRegions: [...NO_BUILD_TIME],
    allowRuntimeBuiltins: false,
  },
  {
    region: 'apps/client/src/i18n',
    denyRegions: [...NO_BUILD_TIME],
    allowRuntimeBuiltins: false,
  },
  {
    region: 'apps/client',
    denyRegions: [...NO_BUILD_TIME],
    allowRuntimeBuiltins: false,
  },
];

const RULES_BY_REGION = new Map(ZONE_RULES.map((rule) => [rule.region, rule]));

export function ruleFor(repoPath: string): ZoneRule | undefined {
  const region = regionOf(repoPath);
  return region === undefined ? undefined : RULES_BY_REGION.get(region);
}

const NODE_BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'events',
  'fs',
  'http',
  'https',
  'os',
  'path',
  'process',
  'stream',
  'url',
  'util',
  'worker_threads',
  'zlib',
]);

export type Target =
  | { readonly kind: 'region'; readonly path: string; readonly region: string | undefined }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };

/** The npm package a specifier belongs to: `three/examples/jsm/x` → `three`. */
export function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
}

export function resolveSpecifier(fromFile: string, specifier: string): Target {
  if (specifier.startsWith('.')) {
    const path = normalize(`${dirname(fromFile)}/${specifier}`);
    return { kind: 'region', path, region: regionOf(path) };
  }
  if (specifier.startsWith('node:') || specifier.startsWith('bun:') || specifier === 'bun') {
    return { kind: 'builtin', name: specifier };
  }
  const name = packageName(specifier);
  if (NODE_BUILTINS.has(name)) return { kind: 'builtin', name };

  const workspace = WORKSPACE_PACKAGES[name];
  if (workspace !== undefined) {
    const rest = specifier.slice(name.length);
    const path = `${workspace}${rest}`;
    return { kind: 'region', path, region: regionOf(path) };
  }
  return { kind: 'package', name };
}

function packageMatches(pattern: string, name: string): boolean {
  if (pattern.endsWith('/*')) return name.startsWith(`${pattern.slice(0, -1)}`);
  return pattern === name;
}

export interface Violation {
  /** 1-based. */
  readonly line: number;
  readonly message: string;
}

export function isTestFile(repoPath: string): boolean {
  return /\.test\.tsx?$/.test(repoPath);
}

/** Applies one zone's rules to one import. Returns undefined when the import is allowed. */
export function checkImport(
  rule: ZoneRule,
  fromFile: string,
  ref: ImportRef,
): Violation | undefined {
  const target = resolveSpecifier(fromFile, ref.specifier);
  const fail = (message: string): Violation => ({ line: ref.line, message });

  if (target.kind === 'builtin') {
    if (rule.allowRuntimeBuiltins) return undefined;
    if (target.name === 'bun:test' && isTestFile(fromFile)) return undefined;
    return fail(
      `imports '${ref.specifier}' — ${
        rule.region.startsWith('apps/client')
          ? BROWSER_ONLY
          : `${rule.region} must not depend on a host runtime`
      }`,
    );
  }

  if (target.kind === 'package') {
    const denied = rule.denyPackages?.find((entry) => packageMatches(entry.match, target.name));
    if (denied !== undefined) return fail(`imports '${ref.specifier}' — ${denied.reason}`);
    if (rule.allowPackages !== undefined && !rule.allowPackages.includes(target.name)) {
      const allowed =
        rule.allowPackages.length === 0
          ? 'no third-party package'
          : `only ${rule.allowPackages.join(', ')}`;
      return fail(`imports '${ref.specifier}' — ${rule.region} may import ${allowed}`);
    }
    return undefined;
  }

  const { region } = target;
  if (region === rule.region) return undefined;

  if (region !== undefined && rule.typeOnlyRegions?.includes(region) === true) {
    // A test may load real data as a fixture (the sim golden runs on the shipped calendar);
    // tests are never bundled, so this cannot leak runtime content into the sim.
    return ref.typeOnly || isTestFile(fromFile)
      ? undefined
      : fail(
          `imports '${ref.specifier}' as a value — ${rule.region} may only import types from ${region}`,
        );
  }

  const denied = rule.denyRegions?.find((entry) => entry.region === region);
  if (denied !== undefined) return fail(`imports '${ref.specifier}' — ${denied.reason}`);

  if (
    rule.allowRegions !== undefined &&
    (region === undefined || !rule.allowRegions.includes(region))
  ) {
    return fail(
      `imports '${ref.specifier}' — ${rule.region} may only import from ${rule.allowRegions.join(', ')}`,
    );
  }
  return undefined;
}

/**
 * The whole per-file check: import boundaries plus, for `packages/sim`, the purity rules.
 * `repoPath` is relative to the repo root and decides which zone applies.
 */
export function checkSource(repoPath: string, source: string): Violation[] {
  const rule = ruleFor(repoPath);
  if (rule === undefined) return [];

  const violations: Violation[] = [];
  for (const ref of scanImports(source)) {
    const violation = checkImport(rule, repoPath, ref);
    if (violation !== undefined) violations.push(violation);
  }
  if (rule.checkPurity === true) violations.push(...purityViolations(source));
  return violations.sort((a, b) => a.line - b.line);
}
