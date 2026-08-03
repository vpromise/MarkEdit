import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const readHtml = () => {
  const filePath = path.join(__dirname, '../dist/index.html');
  return fs.readFileSync(filePath, 'utf-8');
};

describe('Build system', () => {
  test('test existence of magic variables', () => {
    const html = readHtml();
    expect(html).toContain('"{{EDITOR_CONFIG}}"');
    expect(html).toContain('"{{USER_SETTINGS}}"');
  });

  test('test everything is inlined in a single file', () => {
    const html = readHtml();
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link[^>]*\srel=["']?stylesheet/i);
    expect(html).not.toContain('chunk-loader');
    expect(html).toContain('markdown-preview-mermaid');
  });

  test('uses a single root scroller in Quick Look', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/@quicklook/index.css'), 'utf-8');

    expect(css).toMatch(/html\.markedit-quicklook\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.markedit-quicklook body\s*\{[^}]*overflow:\s*visible;/s);
    expect(css).toMatch(/\.markedit-quicklook \.markdown-preview\s*\{[^}]*overflow:\s*visible;/s);
  });

  test('leaves vertical scrolling to the active main editor view', () => {
    const css = fs.readFileSync(path.join(__dirname, '../index.css'), 'utf-8');
    const rootRule = css.match(/html,\s*body\s*\{([^}]*)\}/s)?.[1] ?? '';

    expect(rootRule).toMatch(/overflow-x:\s*auto;/);
    expect(rootRule).toMatch(/overflow-y:\s*hidden;/);
    expect(rootRule).not.toMatch(/overflow:\s*auto;/);
  });
});
