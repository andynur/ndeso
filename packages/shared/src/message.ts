/**
 * The small ICU message subset from I18N §3: `{name}` placeholders,
 * `{count, plural, …}` with `#`, and `{gender, select, …}`.
 *
 * We parse it ourselves rather than pulling in a formatter library: the grammar below
 * is the whole feature set the game needs, and TECH_STACK §2 keeps `intl-messageformat`
 * off the dependency list. Not supported (and rejected loudly): ICU apostrophe escaping,
 * `selectordinal`, and number/date skeletons — callers pre-format those via `format.*`.
 */

export type MessageValue = string | number;
export type MessageValues = Readonly<Record<string, MessageValue>>;

export type MessageNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'value'; readonly name: string }
  | { readonly kind: 'hash' }
  | {
      readonly kind: 'plural' | 'select';
      readonly name: string;
      readonly branches: Readonly<Record<string, readonly MessageNode[]>>;
    };

export class MessageSyntaxError extends Error {
  constructor(pattern: string, at: number, detail: string) {
    super(`${detail} at index ${at} in message: ${pattern}`);
    this.name = 'MessageSyntaxError';
  }
}

const ARGUMENT_TYPES = new Set(['plural', 'select']);

export function parseMessage(pattern: string): readonly MessageNode[] {
  let at = 0;

  function fail(detail: string): never {
    throw new MessageSyntaxError(pattern, at, detail);
  }

  function readUntil(stops: string): string {
    const start = at;
    while (at < pattern.length && !stops.includes(pattern[at] as string)) at++;
    return pattern.slice(start, at).trim();
  }

  function skipSpace(): void {
    while (at < pattern.length && /\s/.test(pattern[at] as string)) at++;
  }

  function expect(char: string): void {
    if (pattern[at] !== char) fail(`expected '${char}'`);
    at++;
  }

  /** `insidePlural` decides whether a bare `#` is the plural number or literal text. */
  function parseSequence(nested: boolean, insidePlural: boolean): MessageNode[] {
    const nodes: MessageNode[] = [];
    let text = '';
    const flush = (): void => {
      if (text !== '') {
        nodes.push({ kind: 'text', value: text });
        text = '';
      }
    };

    while (at < pattern.length) {
      const char = pattern[at] as string;
      if (char === '}') {
        if (!nested) fail("unbalanced '}'");
        break;
      }
      if (char === '{') {
        flush();
        nodes.push(parseArgument());
        continue;
      }
      if (char === '#' && insidePlural) {
        flush();
        nodes.push({ kind: 'hash' });
        at++;
        continue;
      }
      text += char;
      at++;
    }

    flush();
    return nodes;
  }

  function parseBranches(type: 'plural' | 'select'): Record<string, MessageNode[]> {
    const branches: Record<string, MessageNode[]> = {};
    for (;;) {
      skipSpace();
      if (pattern[at] === '}') break;
      if (at >= pattern.length) fail(`unterminated ${type} argument`);
      const selector = readUntil('{}');
      if (selector === '') fail(`empty ${type} selector`);
      skipSpace();
      expect('{');
      branches[selector] = parseSequence(true, type === 'plural');
      expect('}');
    }
    if (branches['other'] === undefined) fail(`${type} argument has no 'other' branch`);
    return branches;
  }

  function parseArgument(): MessageNode {
    expect('{');
    const name = readUntil(',}');
    if (name === '') fail('empty placeholder name');
    skipSpace();

    if (pattern[at] === '}') {
      at++;
      return { kind: 'value', name };
    }

    expect(',');
    skipSpace();
    const type = readUntil(',}');
    if (!ARGUMENT_TYPES.has(type)) fail(`unsupported argument type '${type}'`);
    skipSpace();
    expect(',');

    const branches = parseBranches(type as 'plural' | 'select');
    expect('}');
    return { kind: type as 'plural' | 'select', name, branches };
  }

  const nodes = parseSequence(false, false);
  if (at !== pattern.length) fail('unexpected trailing input');
  return nodes;
}

/**
 * Every placeholder name a message reads, including the ones nested inside branches.
 * `check:i18n` compares these sets across locales (I18N §1 rule 5).
 */
export function messagePlaceholders(pattern: string): ReadonlySet<string> {
  const names = new Set<string>();
  const walk = (nodes: readonly MessageNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'value') names.add(node.name);
      if (node.kind === 'plural' || node.kind === 'select') {
        names.add(node.name);
        for (const branch of Object.values(node.branches)) walk(branch);
      }
    }
  };
  walk(parseMessage(pattern));
  return names;
}

/** Parsing the same handful of HUD strings every frame is wasteful; the AST is immutable. */
const CACHE = new Map<string, readonly MessageNode[]>();

function parseCached(pattern: string): readonly MessageNode[] {
  let nodes = CACHE.get(pattern);
  if (nodes === undefined) {
    nodes = parseMessage(pattern);
    CACHE.set(pattern, nodes);
  }
  return nodes;
}

export function formatMessage(locale: string, pattern: string, values: MessageValues = {}): string {
  const plurals = new Intl.PluralRules(locale);

  const render = (nodes: readonly MessageNode[], hash: number | undefined): string => {
    let out = '';
    for (const node of nodes) {
      switch (node.kind) {
        case 'text':
          out += node.value;
          break;
        case 'hash':
          out += hash === undefined ? '#' : new Intl.NumberFormat(locale).format(hash);
          break;
        case 'value': {
          const value = values[node.name];
          // A missing value is a bug in the caller, not in the translation: keep the
          // placeholder visible so it shows up in review instead of rendering "undefined".
          out += value === undefined ? `{${node.name}}` : String(value);
          break;
        }
        case 'select': {
          const key = String(values[node.name] ?? 'other');
          out += render(node.branches[key] ?? (node.branches['other'] as MessageNode[]), hash);
          break;
        }
        case 'plural': {
          const count = Number(values[node.name] ?? 0);
          const branch =
            node.branches[`=${count}`] ??
            node.branches[plurals.select(count)] ??
            (node.branches['other'] as MessageNode[]);
          out += render(branch, count);
          break;
        }
      }
    }
    return out;
  };

  return render(parseCached(pattern), undefined);
}
