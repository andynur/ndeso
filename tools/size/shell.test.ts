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

describe('publicPath', () => {
  const html = '<link href="/ndeso/a.css"><script src="/ndeso/b-1234.js"></script>';

  test('strips the prefix a project-site build stamped on', () => {
    expect(shellReferences(html, '/ndeso/')).toEqual(['a.css', 'b-1234.js']);
  });

  test('tolerates a prefix given without its trailing slash', () => {
    expect(shellReferences(html, '/ndeso')).toEqual(['a.css', 'b-1234.js']);
  });

  // Without the prefix the paths keep their leading directory and match nothing on disk —
  // which is exactly how the first GitHub Pages build failed.
  test('leaves the prefix in place when told the site owns the root', () => {
    expect(shellReferences(html, '/')).toEqual(['ndeso/a.css', 'ndeso/b-1234.js']);
  });

  test('shellFiles passes the prefix through', () => {
    expect(shellFiles(html, 'index.html', '/ndeso/')).toEqual(['index.html', 'a.css', 'b-1234.js']);
  });
});
