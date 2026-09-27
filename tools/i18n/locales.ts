/**
 * Shared plumbing for the i18n tools: where the locale files are and how to read them.
 * Runs under Bun only (TESTING §1 scripts), never in the browser bundle.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCALE_NAMESPACES,
  type LocaleId,
  type LocaleNamespace,
  SUPPORTED_LOCALES,
} from '@ndeso/shared';

export const LOCALES_DIR = join(import.meta.dir, '../../packages/content/locales');

export type Bundle = Readonly<Record<string, string>>;

export function localeDir(locale: LocaleId): string {
  return join(LOCALES_DIR, locale);
}

export function bundlePath(locale: LocaleId, namespace: LocaleNamespace): string {
  return join(localeDir(locale), `${namespace}.json`);
}

/**
 * Namespaces that actually exist on disk for the source locale. I18N §2 declares five,
 * but `items`, `npcs` and `tutorial` only arrive with the content of M2 — the checker
 * reports on what is there and on parity between locales, not on what is missing from
 * the roadmap.
 */
export function presentNamespaces(locale: LocaleId): LocaleNamespace[] {
  const known = new Set<string>(LOCALE_NAMESPACES);
  return readdirSync(localeDir(locale))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .filter((name): name is LocaleNamespace => known.has(name))
    .sort();
}

/** Any `.json` in a locale directory that is not a namespace I18N §2 knows about. */
export function unknownFiles(locale: LocaleId): string[] {
  const known = new Set<string>(LOCALE_NAMESPACES);
  return readdirSync(localeDir(locale))
    .filter((file) => file.endsWith('.json'))
    .filter((file) => !known.has(file.slice(0, -'.json'.length)))
    .sort();
}

export async function readBundle(locale: LocaleId, namespace: LocaleNamespace): Promise<Bundle> {
  return (await Bun.file(bundlePath(locale, namespace)).json()) as Bundle;
}

export const LOCALE_IDS: readonly LocaleId[] = SUPPORTED_LOCALES.map((locale) => locale.id);
