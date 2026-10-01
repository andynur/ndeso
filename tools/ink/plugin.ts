import type { BunPlugin } from 'bun';
import { compileInk } from './compile.ts';

/** Bun loader used by both the development server and the production build. */
export const inkPlugin: BunPlugin = {
  name: 'ink-dialog',
  setup(build) {
    build.onLoad({ filter: /\.ink$/ }, async ({ path }) => ({
      contents: `export default ${JSON.stringify(compileInk(await Bun.file(path).text(), path))};`,
      loader: 'js',
    }));
  },
};
