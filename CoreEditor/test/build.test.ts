import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Build system', () => {
  test('test existence of magic variables', () => {
    const testFileName = (fileName: string, hasChunks: boolean) => {
      const html = fs.readFileSync(path.join(__dirname, fileName), 'utf-8');
      expect(html).toContain('"{{EDITOR_CONFIG}}"');

      if (hasChunks) {
        expect(html).toContain('chunk-loader://chunks/');
      }
    };

    testFileName('../dist/index.html', true);
    testFileName('../src/@light/dist/index.html', false);
  });

  test('uses the chunk loader scheme for runtime dependencies', () => {
    const chunksDirectory = path.join(__dirname, '../dist/chunks');
    const scripts = fs.readdirSync(chunksDirectory)
      .filter(fileName => fileName.endsWith('.js'))
      .map(fileName => fs.readFileSync(path.join(chunksDirectory, fileName), 'utf-8'))
      .join('\n');

    expect(scripts).toContain('chunk-loader://chunks/');
    expect(scripts).not.toContain('"/chunk-loader/');
  });

  test('uses a single root scroller in Quick Look', () => {
    const html = fs.readFileSync(path.join(__dirname, '../src/@light/index.html'), 'utf-8');

    expect(html).toMatch(/html\s*\{[^}]*overflow:\s*auto;/s);
    expect(html).toMatch(/body\s*\{[^}]*overflow:\s*visible;/s);
    expect(html).not.toMatch(/html,\s*body\s*\{[^}]*overflow:/s);
  });

  test('leaves vertical scrolling to the active main editor view', () => {
    const css = fs.readFileSync(path.join(__dirname, '../index.css'), 'utf-8');
    const rootRule = css.match(/html,\s*body\s*\{([^}]*)\}/s)?.[1] ?? '';

    expect(rootRule).toMatch(/overflow-x:\s*auto;/);
    expect(rootRule).toMatch(/overflow-y:\s*hidden;/);
    expect(rootRule).not.toMatch(/overflow:\s*auto;/);
  });
});
