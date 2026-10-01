#!/usr/bin/env bun
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SOURCE_LOCALE } from '@bale/shared';
import { compareInkStructure, inspectInk } from './ink-parity.ts';
import { LOCALE_IDS } from './locales.ts';

const DIALOG_DIR = join(import.meta.dir, '../../packages/content/dialog');
const REQUIRED_SCRIPTS = ['day', 'evening', 'morning'];

async function inkFiles(locale: string): Promise<string[]> {
  return (await readdir(join(DIALOG_DIR, locale)))
    .filter((file) => file.endsWith('.ink'))
    .sort((a, b) => a.localeCompare(b));
}

async function main(): Promise<number> {
  const problems: string[] = [];
  const sourceLocale = SOURCE_LOCALE;
  const targetLocales = LOCALE_IDS.filter((locale) => locale !== sourceLocale);
  const sourceFiles = await inkFiles(sourceLocale);
  for (const locale of targetLocales) {
    const targetFiles = await inkFiles(locale);
    for (const file of sourceFiles) {
      if (!targetFiles.includes(file)) problems.push(`${locale}/${file}: missing dialog file`);
    }
    for (const file of targetFiles) {
      if (!sourceFiles.includes(file)) problems.push(`${locale}/${file}: extra dialog file`);
    }
  }

  for (const file of sourceFiles) {
    const sourcePath = join(DIALOG_DIR, sourceLocale, file);
    try {
      const source = inspectInk(await Bun.file(sourcePath).text(), `${sourceLocale}/${file}`);
      const scripts = source.flows.map((flow) => flow.path).sort((a, b) => a.localeCompare(b));
      if (scripts.join('\n') !== REQUIRED_SCRIPTS.join('\n')) {
        problems.push(
          `${sourceLocale}/${file}: expected exactly morning, day, evening scripts; got ${scripts.join(', ')}`,
        );
      }
      for (const locale of targetLocales) {
        const targetPath = join(DIALOG_DIR, locale, file);
        if (!(await Bun.file(targetPath).exists())) continue;
        const target = inspectInk(await Bun.file(targetPath).text(), `${locale}/${file}`);
        problems.push(...compareInkStructure(source, target, `${locale}/${file}`));
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  for (const problem of problems) console.error(`  error  ${problem}`);
  if (problems.length > 0) {
    console.error(`check:ink failed — ${problems.length} error(s).`);
    return 1;
  }
  console.log(
    `check:ink ok — ${sourceFiles.length} NPC files × ${LOCALE_IDS.length} locales × 3 scripts.`,
  );
  return 0;
}

if (import.meta.main) process.exit(await main());
