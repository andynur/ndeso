/**
 * Pure comparison rules behind `bun run check:i18n` (I18N §1–§3). Kept free of file IO
 * so every rule below is unit-testable without fixtures on disk.
 */

import { messagePlaceholders } from '@bale/shared';

export type Bundle = Readonly<Record<string, unknown>>;

export interface Problem {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}

/** I18N §1 rule 3: untranslated strings are marked, allowed on branches, never on main. */
export const TODO_PREFIX = '[TODO-ID] ';

function at(locale: string, namespace: string, key?: string): string {
  return key === undefined ? `${locale}/${namespace}.json` : `${locale}/${namespace}.json → ${key}`;
}

/** Shape rules that apply to any bundle, source or translation. */
export function validateBundle(locale: string, namespace: string, bundle: Bundle): Problem[] {
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(bundle)) {
    const where = at(locale, namespace, key);
    if (typeof value !== 'string') {
      problems.push({
        level: 'error',
        where,
        // I18N §2: namespaces are flat dotted keys, not nested objects.
        message: `value must be a string, got ${Array.isArray(value) ? 'array' : typeof value}`,
      });
      continue;
    }
    if (value.trim() === '') {
      problems.push({ level: 'error', where, message: 'value is empty' });
      continue;
    }
    try {
      messagePlaceholders(value);
    } catch (error) {
      problems.push({
        level: 'error',
        where,
        message: `unparseable message — ${(error as Error).message}`,
      });
    }
  }
  return problems;
}

export interface CompareOptions {
  readonly namespace: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly source: Bundle;
  readonly target: Bundle;
  /** False on `main` and on release tags, where `[TODO-ID]` becomes an error. */
  readonly allowTodo: boolean;
}

/** Key parity, placeholder parity, and translation-marker policy for one namespace. */
export function compareNamespace(options: CompareOptions): Problem[] {
  const { namespace, sourceLocale, targetLocale, source, target, allowTodo } = options;
  const problems: Problem[] = [];

  for (const key of Object.keys(source)) {
    if (!(key in target)) {
      problems.push({
        level: 'error',
        where: at(targetLocale, namespace, key),
        message: `missing key (present in ${sourceLocale})`,
      });
    }
  }

  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      problems.push({
        level: 'error',
        where: at(targetLocale, namespace, key),
        message: `extra key (not in ${sourceLocale}) — remove it or add it to the source locale`,
      });
    }
  }

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];
    if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') continue;
    const where = at(targetLocale, namespace, key);

    if (targetValue.startsWith(TODO_PREFIX)) {
      problems.push({
        level: allowTodo ? 'warn' : 'error',
        where,
        message: `untranslated (${TODO_PREFIX.trim()}) — label the PR needs-translation`,
      });
    }

    let sourceNames: ReadonlySet<string>;
    let targetNames: ReadonlySet<string>;
    try {
      sourceNames = messagePlaceholders(sourceValue);
      targetNames = messagePlaceholders(targetValue);
    } catch {
      // validateBundle already reported the syntax error; don't report it twice.
      continue;
    }

    const missing = [...sourceNames].filter((name) => !targetNames.has(name));
    const extra = [...targetNames].filter((name) => !sourceNames.has(name));
    if (missing.length > 0) {
      problems.push({
        level: 'error',
        where,
        message: `placeholder(s) missing: ${missing.map((n) => `{${n}}`).join(', ')}`,
      });
    }
    if (extra.length > 0) {
      problems.push({
        level: 'error',
        where,
        message: `unknown placeholder(s): ${extra.map((n) => `{${n}}`).join(', ')}`,
      });
    }
  }

  return problems;
}

/** Every locale must ship the same namespace files (I18N §2). */
export function compareNamespaceSets(
  sourceLocale: string,
  sourceNamespaces: readonly string[],
  targetLocale: string,
  targetNamespaces: readonly string[],
): Problem[] {
  const target = new Set(targetNamespaces);
  const source = new Set(sourceNamespaces);
  return [
    ...sourceNamespaces
      .filter((ns) => !target.has(ns))
      .map((ns) => ({
        level: 'error' as const,
        where: at(targetLocale, ns),
        message: `missing namespace file (present in ${sourceLocale})`,
      })),
    ...targetNamespaces
      .filter((ns) => !source.has(ns))
      .map((ns) => ({
        level: 'error' as const,
        where: at(targetLocale, ns),
        message: `namespace file has no counterpart in ${sourceLocale}`,
      })),
  ];
}
