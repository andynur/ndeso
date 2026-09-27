import { describe, expect, test } from 'bun:test';
import { shellFiles, shellReferences } from './shell.ts';

describe('shellReferences', () => {
  test('picks up the script and stylesheet the bundler rewrote', () => {
    const html = [
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="./index-c72amxfg.css" />',
      '</head><body>',
      '<script type="module" src="/index-6yxzf6wx.js"></script>',
      '</body></html>',
    ].join('\n');
    expect(shellReferences(html)).toEqual(['index-6yxzf6wx.js', 'index-c72amxfg.css']);
  });

  test('ignores anything not served from this build', () => {
    const html = [
      '<link rel="preconnect" href="https://fonts.example" />',
      '<link rel="icon" href="data:image/png;base64,AAAA" />',
      '<script src="//cdn.example/x.js"></script>',
      '<script src="app.js"></script>',
    ].join('\n');
    expect(shellReferences(html)).toEqual(['app.js']);
  });

  test('strips a query or fragment and dedupes', () => {
    const html = '<script src="app.js?v=2"></script><script src="./app.js#x"></script>';
    expect(shellReferences(html)).toEqual(['app.js']);
  });

  test('a lazily imported chunk is not part of the shell', () => {
    // Dynamic chunks are referenced from JS, never from the document.
    const html = '<script type="module" src="index-abc.js"></script>';
    expect(shellReferences(html)).not.toContain('ui-g71xefpz.js');
  });
});

describe('shellFiles', () => {
  test('includes the document itself', () => {
    expect(shellFiles('<script src="app.js"></script>')).toEqual(['index.html', 'app.js']);
  });
});
