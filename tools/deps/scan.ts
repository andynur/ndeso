/**
 * A small TypeScript source scanner for `bun run check:deps`.
 *
 * It exists because the boundary check needs two things a regex over raw text cannot give
 * reliably: import specifiers that are really imports (not the word "import" inside a string
 * or a commented-out line), and source text with comments and literals blanked out so the
 * `packages/sim` purity rules cannot fire on prose.
 *
 * It is a tokenizer, not a parser: enough JavaScript lexical structure to know where strings,
 * template literals, comments and regex literals begin and end. No IO, so every case below is
 * unit-testable from a string.
 */

export type TokenKind = 'word' | 'punct' | 'string' | 'template';

export interface Token {
  readonly kind: TokenKind;
  /**
   * For strings: the raw text between the quotes. A `template` token carries no value —
   * its literal parts are masked and its `${…}` interpolations are tokenized as ordinary code,
   * so nothing can hide inside one.
   */
  readonly value: string;
  /** 1-based. */
  readonly line: number;
}

export interface ImportRef {
  readonly specifier: string;
  /** `import type ... from` or `export type ... from` — erased at build time. */
  readonly typeOnly: boolean;
  /** `import('x')` or `require('x')`. */
  readonly dynamic: boolean;
  readonly line: number;
}

export interface ScanResult {
  readonly tokens: readonly Token[];
  /** The source with comment and literal *contents* replaced by spaces; offsets and lines are preserved. */
  readonly masked: string;
}

const WORD_START = /[A-Za-z_$]/;
const WORD_PART = /[A-Za-z0-9_$]/;

/** After these, a `/` starts a regex literal rather than a division. */
const REGEX_AFTER_WORD = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

function regexAllowed(previous: Token | undefined): boolean {
  if (previous === undefined) return true;
  if (previous.kind === 'word') return REGEX_AFTER_WORD.has(previous.value);
  if (previous.kind === 'punct') return !')]}'.includes(previous.value);
  return false;
}

/**
 * Tokenize and mask in one pass. Everything else in this module is built on top of it.
 */
export function scanSource(source: string): ScanResult {
  const tokens: Token[] = [];
  const masked = [...source];
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      if (masked[k] !== '\n') masked[k] = ' ';
    }
  };

  const length = source.length;
  let index = 0;
  let line = 1;
  /** One entry per template literal we are inside; the counter tracks `{}` nesting in `${…}`. */
  const templates: { braceDepth: number }[] = [];
  let inTemplateText = false;

  // `#!/usr/bin/env bun` is not JavaScript; the `/` would otherwise open a regex literal.
  if (source.startsWith('#!')) {
    while (index < length && source[index] !== '\n') index += 1;
  }

  while (index < length) {
    // Inside the literal part of a template: blank it, and stop at the end or at a `${`.
    if (inTemplateText) {
      const start = index;
      while (index < length) {
        const current = source[index];
        if (current === '\\') {
          index += 2;
          continue;
        }
        if (current === '`') break;
        if (current === '$' && source[index + 1] === '{') break;
        if (current === '\n') line += 1;
        index += 1;
      }
      blank(start, Math.min(index, length));
      if (index >= length) break;
      if (source[index] === '`') {
        index += 1;
        templates.pop();
        inTemplateText = false;
        continue;
      }
      // `${` — back to real code until the matching `}`.
      index += 2;
      inTemplateText = false;
      continue;
    }

    const char = source[index] as string;

    if (char === '\n') {
      line += 1;
      index += 1;
      continue;
    }
    if (char === ' ' || char === '\t' || char === '\r') {
      index += 1;
      continue;
    }

    if (char === '/' && source[index + 1] === '/') {
      const start = index;
      while (index < length && source[index] !== '\n') index += 1;
      blank(start, index);
      continue;
    }

    if (char === '/' && source[index + 1] === '*') {
      const start = index;
      index += 2;
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') line += 1;
        index += 1;
      }
      index = Math.min(index + 2, length);
      blank(start, index);
      continue;
    }

    if (char === '/' && regexAllowed(tokens.at(-1))) {
      const start = index;
      index += 1;
      let inClass = false;
      while (index < length) {
        const current = source[index];
        if (current === '\\') {
          index += 2;
          continue;
        }
        if (current === '\n') break;
        if (current === '[') inClass = true;
        else if (current === ']') inClass = false;
        else if (current === '/' && !inClass) {
          index += 1;
          break;
        }
        index += 1;
      }
      while (index < length && WORD_PART.test(source[index] as string)) index += 1;
      blank(start + 1, index);
      tokens.push({ kind: 'punct', value: '/', line });
      continue;
    }

    if (char === '"' || char === "'") {
      const startLine = line;
      const contentStart = index + 1;
      index += 1;
      while (index < length && source[index] !== char) {
        if (source[index] === '\\') index += 1;
        else if (source[index] === '\n') line += 1;
        index += 1;
      }
      const value = source.slice(contentStart, index);
      blank(contentStart, index);
      index += 1;
      tokens.push({ kind: 'string', value, line: startLine });
      continue;
    }

    if (char === '`') {
      templates.push({ braceDepth: 0 });
      inTemplateText = true;
      tokens.push({ kind: 'template', value: '', line });
      index += 1;
      continue;
    }

    if (WORD_START.test(char)) {
      const start = index;
      while (index < length && WORD_PART.test(source[index] as string)) index += 1;
      tokens.push({ kind: 'word', value: source.slice(start, index), line });
      continue;
    }

    // A `}` that closes an interpolation returns us to the template's literal text.
    const template = templates.at(-1);
    if (template !== undefined) {
      if (char === '{') template.braceDepth += 1;
      else if (char === '}') {
        if (template.braceDepth === 0) {
          inTemplateText = true;
          index += 1;
          continue;
        }
        template.braceDepth -= 1;
      }
    }

    tokens.push({ kind: 'punct', value: char, line });
    index += 1;
  }

  return { tokens, masked: masked.join('') };
}

/** The source with comments and literal contents blanked out, line numbers intact. */
export function maskLiterals(source: string): string {
  return scanSource(source).masked;
}

/** A real import/export-from statement never contains one of these before its specifier. */
const STATEMENT_END = new Set([';', '=', '(']);

/**
 * Every module specifier the file references: static imports, side-effect imports,
 * re-exports, `import()` and `require()`. A dynamic import of a computed specifier
 * (a template literal) is skipped — there is nothing static to check.
 */
export function scanImports(source: string): ImportRef[] {
  const { tokens } = scanSource(source);
  const refs: ImportRef[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as Token;
    if (token.kind !== 'word') continue;

    if (token.value === 'require') {
      const open = tokens[i + 1];
      const argument = tokens[i + 2];
      if (open?.value === '(' && argument?.kind === 'string') {
        refs.push({
          specifier: argument.value,
          typeOnly: false,
          dynamic: true,
          line: argument.line,
        });
      }
      continue;
    }

    if (token.value !== 'import' && token.value !== 'export') continue;
    const next = tokens[i + 1];

    if (token.value === 'import' && next?.kind === 'punct' && next.value === '(') {
      const argument = tokens[i + 2];
      if (argument?.kind === 'string') {
        refs.push({
          specifier: argument.value,
          typeOnly: false,
          dynamic: true,
          line: argument.line,
        });
      }
      continue;
    }

    // `import './side-effect.ts'`
    if (token.value === 'import' && next?.kind === 'string') {
      refs.push({ specifier: next.value, typeOnly: false, dynamic: false, line: next.line });
      continue;
    }

    const typeOnly = next?.kind === 'word' && next.value === 'type';
    for (let j = i + 1; j < tokens.length; j += 1) {
      const current = tokens[j] as Token;
      if (current.kind === 'punct' && STATEMENT_END.has(current.value)) break;
      if (current.kind === 'word' && (current.value === 'import' || current.value === 'export'))
        break;
      if (current.kind === 'word' && current.value === 'from') {
        const specifier = tokens[j + 1];
        if (specifier?.kind === 'string') {
          refs.push({ specifier: specifier.value, typeOnly, dynamic: false, line: specifier.line });
          i = j + 1;
        }
        break;
      }
    }
  }

  return refs;
}
