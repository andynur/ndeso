#!/usr/bin/env bun
/**
 * Minimal GitHub REST helper, so agent sessions never hand-roll `curl` for PR work.
 *
 * Why this exists rather than `curl`:
 * - `curl` cannot be safely allow-listed. Permission patterns match a command prefix,
 *   and the URL comes after the flags, so `Bash(curl:*)` would allow requests to any
 *   host — an exfiltration path. This script is allow-listed instead, and it only ever
 *   talks to api.github.com.
 * - PR bodies are markdown with backticks, quotes and newlines. Passing them through a
 *   shell is how you get mangled descriptions; here the body comes from a file.
 * - The token is read from the environment and never echoed.
 *
 * Usage:
 *   bun tools/gh.ts pr-create <head-branch> <title> <body-file> [base]
 *   bun tools/gh.ts pr-status <pr-number>
 *   bun tools/gh.ts pr-merge  <pr-number> [merge|squash|rebase]
 *   bun tools/gh.ts checks    <commit-sha>
 *   bun tools/gh.ts wait      <commit-sha> [timeout-seconds]
 */

const API = 'https://api.github.com';

export interface Repo {
  readonly owner: string;
  readonly repo: string;
}

/** Parse `owner/repo` out of an https or ssh GitHub remote URL. */
export function parseRemote(url: string): Repo | undefined {
  const match = /github\.com[:/]+([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url.trim());
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  return { owner: match[1], repo: match[2] };
}

async function currentRepo(): Promise<Repo> {
  const proc = Bun.spawn(['git', 'remote', 'get-url', 'origin'], { stdout: 'pipe' });
  const url = await new Response(proc.stdout).text();
  const parsed = parseRemote(url);
  if (parsed === undefined)
    throw new Error(`cannot parse a GitHub repo from origin: ${url.trim()}`);
  return parsed;
}

function token(): string {
  const { GH_TOKEN, GITHUB_TOKEN } = process.env;
  const value = GH_TOKEN ?? GITHUB_TOKEN;
  if (value === undefined || value === '') {
    throw new Error('no GH_TOKEN (or GITHUB_TOKEN) in the environment');
  }
  return value;
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const parsed: unknown = text === '' ? {} : JSON.parse(text);
  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : text;
    // Never include the request headers here — they carry the token.
    throw new Error(`${method} ${path} → ${response.status}: ${message}`);
  }
  return parsed;
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/** Combined state of the check runs for one commit. */
export type ChecksState = 'pending' | 'success' | 'failure';

export function combineChecks(runs: readonly unknown[]): ChecksState {
  if (runs.length === 0) return 'pending';
  if (runs.some((run) => field(run, 'status') !== 'completed')) return 'pending';
  const ok = runs.every((run) => {
    const conclusion = field(run, 'conclusion');
    return conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped';
  });
  return ok ? 'success' : 'failure';
}

async function checkRuns(sha: string): Promise<readonly unknown[]> {
  const { owner, repo } = await currentRepo();
  const result = await api('GET', `/repos/${owner}/${repo}/commits/${sha}/check-runs`);
  const runs = field(result, 'check_runs');
  return Array.isArray(runs) ? runs : [];
}

function reportChecks(runs: readonly unknown[]): ChecksState {
  const state = combineChecks(runs);
  for (const run of runs) {
    const name = String(field(run, 'name') ?? '?');
    const status = String(field(run, 'status') ?? '?');
    const conclusion = field(run, 'conclusion');
    console.log(`  ${name}: ${status}${conclusion === null ? '' : ` / ${String(conclusion)}`}`);
  }
  console.log(`checks: ${state}`);
  return state;
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'pr-create': {
      const [head, title, bodyFile, base] = args;
      if (head === undefined || title === undefined || bodyFile === undefined) {
        throw new Error('usage: pr-create <head-branch> <title> <body-file> [base]');
      }
      const { owner, repo } = await currentRepo();
      const body = await Bun.file(bodyFile).text();
      const pr = await api('POST', `/repos/${owner}/${repo}/pulls`, {
        title,
        head,
        base: base ?? 'main',
        body,
      });
      console.log(`#${String(field(pr, 'number'))} ${String(field(pr, 'html_url'))}`);
      return 0;
    }

    case 'pr-status': {
      const [number] = args;
      if (number === undefined) throw new Error('usage: pr-status <pr-number>');
      const { owner, repo } = await currentRepo();
      const pr = await api('GET', `/repos/${owner}/${repo}/pulls/${number}`);
      const sha = String(field(field(pr, 'head'), 'sha'));
      console.log(`#${number} ${String(field(pr, 'state'))} — ${String(field(pr, 'title'))}`);
      console.log(`head: ${sha}`);
      reportChecks(await checkRuns(sha));
      return 0;
    }

    case 'pr-merge': {
      const [number, method] = args;
      if (number === undefined)
        throw new Error('usage: pr-merge <pr-number> [merge|squash|rebase]');
      const { owner, repo } = await currentRepo();
      const result = await api('PUT', `/repos/${owner}/${repo}/pulls/${number}/merge`, {
        merge_method: method ?? 'merge',
      });
      console.log(`merged ${String(field(result, 'sha'))}`);
      return 0;
    }

    case 'checks': {
      const [sha] = args;
      if (sha === undefined) throw new Error('usage: checks <commit-sha>');
      return reportChecks(await checkRuns(sha)) === 'failure' ? 1 : 0;
    }

    case 'wait': {
      const [sha, seconds] = args;
      if (sha === undefined) throw new Error('usage: wait <commit-sha> [timeout-seconds]');
      const limit = Number(seconds ?? '600') * 1000;
      const started = Bun.nanoseconds();
      for (;;) {
        const state = combineChecks(await checkRuns(sha));
        if (state !== 'pending') {
          console.log(`checks: ${state}`);
          return state === 'success' ? 0 : 1;
        }
        if ((Bun.nanoseconds() - started) / 1e6 > limit) {
          console.log('checks: still pending — timed out waiting');
          return 2;
        }
        await Bun.sleep(10_000);
      }
    }

    default:
      console.log('usage: bun tools/gh.ts <pr-create|pr-status|pr-merge|checks|wait> …');
      return command === undefined ? 1 : 1;
  }
}

if (import.meta.main) {
  process.exit(
    await main().catch((error: unknown) => {
      console.error(`gh failed — ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }),
  );
}
