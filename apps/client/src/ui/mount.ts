import { h, render } from 'preact';
import { App, type AppProps } from './app.tsx';

/** Keeps `main.ts` free of JSX so the boot path stays a plain `.ts` module. */
export function mountOverlay(root: HTMLElement, props: AppProps): void {
  render(h(App, props), root);
}
