import { join } from 'node:path';
import { CONTENT_ROOT } from '../packages/content/src/index.ts';
import { validateContentSet } from './content/validate.ts';

async function readJson5Files(root: string): Promise<Map<string, unknown>> {
  const files = new Map<string, unknown>();
  const paths = Array.fromAsync(new Bun.Glob('**/*.json5').scan({ cwd: root }));
  for (const path of await paths) {
    try {
      files.set(path, Bun.JSON5.parse(await Bun.file(join(root, path)).text()));
    } catch (error) {
      throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return files;
}

async function readSourceLocaleKeys(root: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const paths = Array.fromAsync(new Bun.Glob('*.json').scan({ cwd: root }));
  for (const path of await paths) {
    const namespace = path.slice(0, -'.json'.length);
    const bundle = (await Bun.file(join(root, path)).json()) as Record<string, unknown>;
    for (const key of Object.keys(bundle)) keys.add(`${namespace}:${key}`);
  }
  return keys;
}

const files = await readJson5Files(join(CONTENT_ROOT, 'data'));
const localeKeys = await readSourceLocaleKeys(join(CONTENT_ROOT, 'locales', 'en'));
const problems = validateContentSet(files, localeKeys);

if (problems.length > 0) {
  for (const problem of problems) console.error(`${problem.file}: ${problem.message}`);
  console.error(`check:content failed with ${problems.length} problem(s)`);
  process.exit(1);
}

console.log(`check:content ok (${files.size} files)`);
