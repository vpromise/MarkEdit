import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { Config, Host } from '../src/config';
import { resetEditor, setMarkdownPreviewMode } from '../src/core';
import { renderMarkdown, renderMarkdownResult } from '../src/modules/markdown/markdownRenderer';
import { setReadingWidth } from '../src/modules/readingWidth';
import { undo } from '../src/@vendor/commands/history';
import type { EditorView } from '@codemirror/view';

async function preview(source: string, readOnly = false) {
  document.body.innerHTML = '<main id="editor"></main>';
  window.config = {
    host: Host.mainApp, theme: 'github-light', fontFace: { family: 'monospace' }, fontSize: 14,
    lineHeight: 1.5, readOnlyMode: readOnly, invisiblesBehavior: 'never', indentBehavior: 'never',
    readingWidth: 800, enhancedPasteEnabled: true,
  } as Config;
  await resetEditor(source);
  setMarkdownPreviewMode(true);
  const article = document.querySelector<HTMLElement>('.markdown-preview');
  if (article === null) {
    throw new Error('The Markdown preview was not created');
  }
  return article;
}

afterEach(() => {
  const editor = Reflect.get(window, 'editor') as EditorView | undefined;
  editor?.destroy();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Built-in Markdown preview features', () => {
  test('renders footnotes and all GitHub alert types while sanitizing HTML', () => {
    const html = renderMarkdown('Text[^note].\n\n[^note]: Footnote **body**.\n\n'
      + ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'].map(kind => `> [!${kind}]\n> Safe **content**`).join('\n\n')
      + '\n\n<script>throw new Error()</script>');
    expect(html).toContain('class="footnotes"');
    expect(html).toContain('Footnote <strong>body</strong>');
    for (const kind of ['note', 'tip', 'important', 'warning', 'caution']) {
      expect(html).toContain(`markdown-alert-${kind}`);
    }
    expect(html).not.toContain('<script>');
  });

  test('maps nested and quoted tasks to their source lines', () => {
    const result = renderMarkdownResult('- [ ] First\n  - [x] Nested\n\n> - [ ] Quoted\n\n```\n- [ ] Code\n```');
    expect(result.tasks.map(task => task.line)).toEqual([0, 1, 3]);
    expect(result.html).toContain('disabled=""');
  });

  test('task clicks update only the marker and remain undoable', async () => {
    const article = await preview('- [ ] First\n- [x] Second\n');
    const tasks = article.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    tasks[0].click();
    tasks[1].click();
    expect(window.editor.state.doc.toString()).toBe('- [x] First\n- [ ] Second\n');
    expect(undo(window.editor)).toBe(true);
    expect(window.editor.state.doc.toString()).toContain('- [x] Second');
    expect(document.querySelector('.markdown-preview')?.hasAttribute('hidden')).toBe(false);
  });

  test('does not let stale task mappings edit a changed document', async () => {
    const article = await preview('- [ ] First');
    window.editor.dispatch({ changes: { from: 0, insert: '# New\n\n' } });
    const checkbox = article.querySelector<HTMLInputElement>('input');
    checkbox?.click();
    expect(window.editor.state.doc.toString()).toBe('# New\n\n- [ ] First');
    expect(checkbox?.checked).toBe(false);
  });

  test('keeps tasks and user-authored controls disabled in read-only previews', async () => {
    const article = await preview('- [ ] First\n\n<input type="checkbox" data-markedit-task="forged">', true);
    article.querySelectorAll<HTMLInputElement>('input').forEach(input => {
      expect(input.disabled).toBe(true);
      input.click();
    });
    expect(window.editor.state.doc.toString()).toContain('- [ ] First');
  });

  test('copies the original code text rather than highlighting markup', async () => {
    const article = await preview('```javascript\nconst title = "<b>中文</b>";\n```');
    const write = jest.fn<(args: { text: string }) => Promise<boolean>>(async () => true);
    window.nativeModules.api = { setPasteboardString: write } as unknown as typeof window.nativeModules.api;
    jest.useFakeTimers();
    article.querySelector<HTMLButtonElement>('.markdown-preview-copy')?.click();
    await jest.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledWith({ text: 'const title = "<b>中文</b>";\n' });
    expect(article.querySelector('.markdown-preview-copy')?.textContent).toBe('Copied');
    jest.runOnlyPendingTimers();
  });

  test('creates unique heading anchors and changes reading width without losing source state', async () => {
    const article = await preview('# 中文\n\n# 中文\n');
    const headings = article.querySelectorAll('h1');
    expect(headings[0].id).not.toBe(headings[1].id);
    const editor = window.editor;
    setReadingWidth(640);
    expect(document.documentElement.style.getPropertyValue('--markdown-preview-reading-width')).toBe('640px');
    setReadingWidth(0);
    expect(document.documentElement.style.getPropertyValue('--markdown-preview-reading-width')).toBe('100%');
    expect(window.editor).toBe(editor);
    expect(window.editor.state.doc.toString()).toBe('# 中文\n\n# 中文\n');
  });
});
