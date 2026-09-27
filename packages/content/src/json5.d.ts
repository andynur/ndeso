/** Bun imports `.json5` natively (runtime and bundler); the content is validated after import. */
declare module '*.json5' {
  const value: unknown;
  // biome-ignore lint/style/noDefaultExport: a data module's value is its default export.
  export default value;
}
