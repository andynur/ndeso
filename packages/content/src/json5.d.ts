/** Bun imports `.json5` natively; the shape is unknown until a validator narrows it. */
declare module '*.json5' {
  const data: unknown;
  // biome-ignore lint/style/noDefaultExport: describes how Bun imports a .json5 file.
  export default data;
}
