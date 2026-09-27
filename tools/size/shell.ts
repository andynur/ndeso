/**
 * What counts as the "core shell" in PERFORMANCE_BUDGET §2: `index.html` plus exactly the
 * files it links. Everything else in `dist/` — the lazy locale chunks today, area chunks
 * and atlases later — is fetched on demand and budgeted separately.
 *
 * Deriving it from the built HTML rather than from a filename pattern means the budget
 * tracks what a cold visit actually downloads, even after the bundler changes how it
 * names or splits things.
 */

const REFERENCE = /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** True for a path the build produced, as opposed to a CDN or `data:` URL. */
function isLocal(reference: string): boolean {
  return !/^(?:[a-z]+:|\/\/)/i.test(reference);
}

/**
 * Output-relative paths referenced directly by the built `index.html`, deduped and sorted.
 *
 * `publicPath` is the URL prefix the build stamped onto every reference. On a project site
 * served from `/ndeso/` the HTML says `/ndeso/index-abc.js` while the file on disk is
 * `index-abc.js`, so the prefix has to come back off to turn a URL into an output path.
 */
export function shellReferences(html: string, publicPath = '/'): string[] {
  const prefix = publicPath.endsWith('/') ? publicPath : `${publicPath}/`;
  const found = new Set<string>();
  for (const match of html.matchAll(REFERENCE)) {
    const reference = (match[1] as string).trim();
    if (!isLocal(reference)) continue;
    const path = reference.split(/[?#]/)[0] as string;
    if (path === '') continue;
    const withoutPrefix =
      prefix !== '/' && path.startsWith(prefix) ? path.slice(prefix.length) : path;
    found.add(withoutPrefix.replace(/^\.?\//, ''));
  }
  return [...found].sort();
}

/** The shell as a whole: the HTML document itself plus everything it links. */
export function shellFiles(html: string, htmlPath = 'index.html', publicPath = '/'): string[] {
  return [htmlPath, ...shellReferences(html, publicPath)];
}
