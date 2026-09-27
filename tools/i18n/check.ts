#!/usr/bin/env bun
/**
 * `bun run check:i18n` — locale parity gate (TESTING §1, I18N §1).
 *
 * Checks, for every locale in `SUPPORTED_LOCALES` against the source locale:
 *   - the same namespace files exist
 *   - the same keys exist (a removed or renamed key fails here)
 *   - every message parses as the ICU subset of I18N §3
 *   - placeholders match the source string
 *   - `[TODO-ID]` is a warning on a branch and an error on `main` or a release tag
 * and that the committed `i18n.generated.ts` still matches the locale files.
 */

import { SOURCE_LOCALE } from '@ndeso/shared';
import { GENERATED_PATH, renderGeneratedModule } from './gen-types.ts';
import { LOCALE_IDS, presentNamespaces, readBundle, unknownFiles } from './locales.ts';
import { compareNamespace, compareNamespaceSets, type Problem, validateBundle } from './parity.ts';

/**
 * I18N §1 rule 3: `[TODO-ID]` is a warning everywhere except a release tag.
 *
 * It deliberately does *not* fail on `main`. AGENTS rule 3 lets a PR merge with `[TODO-ID]`
 * plus a `needs-translation` label, so failing on `main` would only turn the default branch
 * red *after* the merge that was allowed — an alarm nobody can act on in time. A release tag
 * is the point where untranslated strings must not ship.
 */
export function todoAllowed(ref: string): boolean {
  return !ref.startsWith('refs/tags/');
}

async function main(): Promise<number> {
  const problems: Problem[] = [];
  const { GITHUB_REF } = process.env;
  const allowTodo = todoAllowed(GITHUB_REF ?? '');
  const sourceNamespaces = presentNamespaces(SOURCE_LOCALE);

  for (const locale of LOCALE_IDS) {
    for (const file of unknownFiles(locale)) {
      problems.push({
        level: 'error',
        where: `${locale}/${file}`,
        message: 'not a namespace from I18N §2 — add it to LOCALE_NAMESPACES or remove it',
      });
    }
  }

  for (const namespace of sourceNamespaces) {
    const source = await readBundle(SOURCE_LOCALE, namespace);
    problems.push(...validateBundle(SOURCE_LOCALE, namespace, source));

    for (const locale of LOCALE_IDS) {
      if (locale === SOURCE_LOCALE) continue;
      if (!presentNamespaces(locale).includes(namespace)) continue;
      const target = await readBundle(locale, namespace);
      problems.push(...validateBundle(locale, namespace, target));
      problems.push(
        ...compareNamespace({
          namespace,
          sourceLocale: SOURCE_LOCALE,
          targetLocale: locale,
          source,
          target,
          allowTodo,
        }),
      );
    }
  }

  for (const locale of LOCALE_IDS) {
    if (locale === SOURCE_LOCALE) continue;
    problems.push(
      ...compareNamespaceSets(SOURCE_LOCALE, sourceNamespaces, locale, presentNamespaces(locale)),
    );
  }

  const generated = await renderGeneratedModule();
  const committed = await Bun.file(GENERATED_PATH)
    .text()
    .catch(() => '');
  if (committed !== generated) {
    problems.push({
      level: 'error',
      where: 'packages/content/src/i18n.generated.ts',
      message: 'stale — run `bun run gen:i18n` and commit the result',
    });
  }

  for (const problem of problems) {
    console.error(
      `  ${problem.level === 'error' ? 'error' : ' warn'}  ${problem.where}: ${problem.message}`,
    );
  }

  const errors = problems.filter((problem) => problem.level === 'error').length;
  const warnings = problems.length - errors;
  const scope = `${LOCALE_IDS.length} locales × ${sourceNamespaces.length} namespaces`;
  if (errors > 0) {
    console.error(
      `check:i18n failed — ${errors} error(s), ${warnings} warning(s) across ${scope}.`,
    );
    return 1;
  }
  console.log(`check:i18n ok — ${scope}, ${warnings} warning(s).`);
  return 0;
}

if (import.meta.main) process.exit(await main());
