import { Compiler } from 'inkjs/full';

export interface InkFlowSignature {
  readonly path: string;
  readonly choices: number;
  readonly tags: readonly string[];
}

export interface InkDocument {
  readonly flows: readonly InkFlowSignature[];
  readonly json: string;
}

type InkJson = null | boolean | number | string | InkJson[] | { [key: string]: InkJson };

function isObject(value: InkJson | undefined): value is { [key: string]: InkJson } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentSignature(container: InkJson[]): Omit<InkFlowSignature, 'path'> {
  let choices = 0;
  const tags: string[] = [];
  const visit = (items: InkJson[]): void => {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (Array.isArray(item)) {
        visit(item);
        continue;
      }
      if (!isObject(item)) continue;
      if (typeof item['*'] === 'string') choices++;
      for (const [key, value] of Object.entries(item)) {
        if (/^c-\d+$/.test(key) && Array.isArray(value)) visit(value);
      }
    }
    for (let index = 0; index + 2 < items.length; index++) {
      const value = items[index + 1];
      if (items[index] === '#' && typeof value === 'string' && items[index + 2] === '/#') {
        tags.push(value.startsWith('^') ? value.slice(1) : value);
      }
    }
  };
  visit(container);
  return { choices, tags };
}

function namedFlows(container: InkJson[], parent = ''): InkFlowSignature[] {
  const tail = container.at(-1);
  if (!isObject(tail)) return [];
  const flows: InkFlowSignature[] = [];
  for (const [name, value] of Object.entries(tail)) {
    if (name.startsWith('#') || /^c-\d+$/.test(name) || !Array.isArray(value)) continue;
    const path = parent === '' ? name : `${parent}.${name}`;
    flows.push({ path, ...contentSignature(value) }, ...namedFlows(value, path));
  }
  return flows;
}

/** Compile first: parity is measured from the runtime structure, not source formatting. */
export function inspectInk(source: string, sourcePath: string): InkDocument {
  const compiler = new Compiler(source);
  const story = compiler.Compile();
  if (compiler.errors.length > 0) {
    throw new Error(`${sourcePath}:\n${compiler.errors.join('\n')}`);
  }
  if (compiler.warnings.length > 0) {
    throw new Error(`${sourcePath}:\n${compiler.warnings.join('\n')}`);
  }
  const json = story.ToJson() as string;
  const parsed = JSON.parse(json) as { root?: InkJson[] };
  if (!Array.isArray(parsed.root)) throw new Error(`${sourcePath}: compiler produced no root`);
  return { flows: namedFlows(parsed.root), json };
}

export function compareInkStructure(
  source: InkDocument,
  target: InkDocument,
  targetPath: string,
): string[] {
  const problems: string[] = [];
  const sourceByPath = new Map(source.flows.map((flow) => [flow.path, flow]));
  const targetByPath = new Map(target.flows.map((flow) => [flow.path, flow]));
  for (const [path, flow] of sourceByPath) {
    const translated = targetByPath.get(path);
    if (!translated) {
      problems.push(`${targetPath}: missing knot/stitch '${path}'`);
      continue;
    }
    if (flow.choices !== translated.choices) {
      problems.push(
        `${targetPath}: '${path}' has ${translated.choices} choices; source has ${flow.choices}`,
      );
    }
    if (flow.tags.join('\n') !== translated.tags.join('\n')) {
      problems.push(`${targetPath}: '${path}' tags differ from source`);
    }
  }
  for (const path of targetByPath.keys()) {
    if (!sourceByPath.has(path)) problems.push(`${targetPath}: extra knot/stitch '${path}'`);
  }
  return problems;
}
