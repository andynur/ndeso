declare module '*.ink' {
  /** Compiled Ink JSON. `tools/ink/plugin.ts` replaces the source at bundle time. */
  const story: string;
  // biome-ignore lint/style/noDefaultExport: asset modules follow the bundler convention.
  export default story;
}
