/**
 * Build-mode flag. `apps/client/build.ts` (M0-07) defines `process.env.NODE_ENV` as
 * `"production"`, which the bundler inlines here and dead-code-eliminates the dev paths.
 * The dev server leaves it undefined, so an un-replaced build is treated as dev.
 */
declare const process: { readonly env: Readonly<Record<string, string | undefined>> } | undefined;

export const DEV: boolean =
  typeof process === 'undefined' || process.env['NODE_ENV'] !== 'production';
