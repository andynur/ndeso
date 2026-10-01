import { Compiler } from 'inkjs/full';

/** Compile authored Ink to the compact JSON consumed by the browser-only runtime. */
export function compileInk(source: string, sourcePath: string): string {
  const compiler = new Compiler(source);
  const story = compiler.Compile();
  if (compiler.errors.length > 0) {
    throw new Error(`${sourcePath}:\n${compiler.errors.join('\n')}`);
  }
  return story.ToJson() as string;
}
