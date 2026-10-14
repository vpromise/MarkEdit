import { describe, expect, test } from '@jest/globals';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import { html } from '../src/@vendor/lang-html';
import { bundledLanguages } from '../src/languages';

describe('Local code language support', () => {
  test.each([
    ['Swift', 'let value = 42'], ['Python', 'def greet():\n    return "hello"'],
    ['JavaScript', 'const value = 42;'], ['JSON', '{"value": 42}'],
    ['Shell', 'echo "hello"'], ['SQL', 'SELECT * FROM notes;'],
  ])('highlights %s without an installed extension', async (name, source) => {
    const language = bundledLanguages(html()).find(candidate => candidate.name === name);
    if (language === undefined) {
      throw new Error(`Missing bundled language: ${name}`);
    }
    const support = await language.load();
    const tree = support.language.parser.parse(source);
    const highlights: string[] = [];
    highlightTree(tree, classHighlighter, (_from, _to, classes) => { highlights.push(classes); });
    expect(highlights.length).toBeGreaterThan(0);
  });
});
