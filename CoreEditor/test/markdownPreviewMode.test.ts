import { describe, expect, test } from '@jest/globals';
import { EditorView } from '@codemirror/view';
import { Config } from '../src/config';
import { getMarkdownPreviewMode, resetEditor, setMarkdownPreviewMode } from '../src/core';
import { rewriteImageSource } from '../src/modules/markdown/previewMode';

window.config = {
  theme: 'github-light',
  typewriterMode: false,
  focusMode: false,
  readOnlyMode: false,
  showLineNumbers: false,
  showActiveLineIndicator: false,
  lineWrapping: false,
  autoCharacterPairs: false,
  lineHeight: 1.5,
  fontSize: 14,
  fontFace: { family: 'monospace' },
  invisiblesBehavior: 'never',
  indentBehavior: 'never',
} as Config;

describe('Markdown preview mode', () => {
  test('rewrites only local relative image sources for the main editor image loader', () => {
    expect(rewriteImageSource('assets/image.png')).toBe('image-loader://assets/image.png');
    expect(rewriteImageSource('./assets/image.png')).toBe('image-loader://./assets/image.png');
    expect(rewriteImageSource('../assets/image.png')).toBe('image-loader://../assets/image.png');
    expect(rewriteImageSource('/Users/example/image.png')).toBe('/Users/example/image.png');
    expect(rewriteImageSource('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(rewriteImageSource('file:///Users/example/image.png')).toBe('file:///Users/example/image.png');
    expect(rewriteImageSource('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  test('toggles rendered preview without destroying the editor source', async () => {
    document.body.innerHTML = '<main id="editor"></main>';
    await resetEditor('# Title\n\n![Local](assets/image.png)');
    const editor = window.editor as EditorView;

    expect(setMarkdownPreviewMode(true)).toBe(true);
    const preview = document.querySelector('.markdown-preview') as HTMLElement;
    expect(preview.hidden).toBe(false);
    expect(preview.innerHTML).toContain('<h1>Title</h1>');
    expect(preview.innerHTML).toContain('src="image-loader://assets/image.png"');
    expect(preview.nextElementSibling).toBe(editor.dom);
    expect(document.documentElement.classList.contains('markdown-preview-active')).toBe(true);
    expect(document.querySelector('#editor')?.classList.contains('markdown-preview-mode')).toBe(true);
    expect(editor.dom.hidden).toBe(true);
    expect(editor.dom.classList.contains('markdown-preview-source-hidden')).toBe(true);
    expect(editor.dom.getAttribute('aria-hidden')).toBe('true');
    expect(window.editor).toBe(editor);
    expect(getMarkdownPreviewMode()).toBe(true);

    expect(setMarkdownPreviewMode(false)).toBe(false);
    expect(preview.hidden).toBe(true);
    expect(document.documentElement.classList.contains('markdown-preview-active')).toBe(false);
    expect(document.querySelector('#editor')?.classList.contains('markdown-preview-mode')).toBe(false);
    expect(editor.dom.hidden).toBe(false);
    expect(editor.dom.classList.contains('markdown-preview-source-hidden')).toBe(false);
    expect(editor.dom.hasAttribute('aria-hidden')).toBe(false);
    expect(window.editor.state.doc.toString()).toBe('# Title\n\n![Local](assets/image.png)');
  });

  test('resetEditor clears active preview state', async () => {
    document.body.innerHTML = '<main id="editor"></main>';
    await resetEditor('# Old');
    setMarkdownPreviewMode(true);

    await resetEditor('# New');

    expect(getMarkdownPreviewMode()).toBe(false);
    expect(document.documentElement.classList.contains('markdown-preview-active')).toBe(false);
    expect(document.querySelector('#editor')?.classList.contains('markdown-preview-mode')).toBe(false);
    expect(document.querySelector('.markdown-preview')).toBeNull();
    expect(window.editor.state.doc.toString()).toBe('# New');
  });
});
