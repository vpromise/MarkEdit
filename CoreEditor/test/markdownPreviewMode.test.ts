import { describe, expect, jest, test } from '@jest/globals';
import { EditorView } from '@codemirror/view';
import { Config } from '../src/config';
import { getMarkdownPreviewMode, resetEditor, setMarkdownPreviewMode } from '../src/core';
import { handlePreviewLinkClick, rewriteImageSource } from '../src/modules/markdown/previewMode';
import { WebModuleTableOfContentsImpl } from '../src/bridge/web/toc';

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
  test.each([
    ['ATX', '# First\n\nFirst body\n\n## Second\n\nSecond body'],
    ['duplicate formatted', '# **Same**\n\nFirst body\n\n## **Same**\n\nSecond body'],
    ['Setext', 'First\n=====\n\nFirst body\n\nSecond\n------\n\nSecond body'],
    ['raw HTML before Markdown', '<h2>HTML heading</h2>\n\n# First\n\n## Second'],
    ['long Chinese', `# First\n\n## ${'中文标题'.repeat(20)}`],
    ['quoted', '# First\n\n> ## Second\n>\n> Second body'],
    ['CRLF', '# First\r\n\r\n## Second\r\n\r\nSecond body'],
  ])('scrolls to a rendered %s heading when selected from the table of contents', async (_kind, source) => {
    document.body.innerHTML = '<main id="editor"></main>';
    await resetEditor(source);
    setMarkdownPreviewMode(true);
    const toc = new WebModuleTableOfContentsImpl();
    const headings = document.querySelectorAll<HTMLElement>('.markdown-preview h2');
    const heading = headings[headings.length - 1];
    const scrollIntoView = jest.fn();
    heading.scrollIntoView = scrollIntoView;
    const headingInfo = toc.getTableOfContents()[1];

    toc.gotoHeader({ headingInfo });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(getMarkdownPreviewMode()).toBe(true);
    expect(window.editor.state.selection.main.head).toBe(headingInfo.from);
    expect(window.editor.dom.hidden).toBe(true);
  });

  test('navigates between rendered sections and returns to source navigation', async () => {
    document.body.innerHTML = '<main id="editor"></main>';
    await resetEditor('# First\n\n## Second');
    setMarkdownPreviewMode(true);
    const toc = new WebModuleTableOfContentsImpl();
    const headings = document.querySelectorAll<HTMLElement>('.markdown-preview h1, .markdown-preview h2');
    const firstScroll = jest.fn();
    const secondScroll = jest.fn();
    headings[0].scrollIntoView = firstScroll;
    headings[1].scrollIntoView = secondScroll;

    toc.selectNextSection();
    expect(secondScroll).toHaveBeenCalledWith({ block: 'start' });
    toc.selectPreviousSection();
    expect(firstScroll).toHaveBeenCalledWith({ block: 'start' });

    setMarkdownPreviewMode(false);
    toc.gotoHeader({ headingInfo: toc.getTableOfContents()[1] });
    expect(secondScroll).toHaveBeenCalledTimes(1);
    expect(window.editor.state.selection.main.head).toBe(toc.getTableOfContents()[1].from);
    expect(window.editor.dom.hidden).toBe(false);
  });

  test('rewrites local image sources for the main editor image loader', () => {
    expect(rewriteImageSource('assets/image.png')).toBe('image-loader://assets/image.png');
    expect(rewriteImageSource('./assets/image.png')).toBe('image-loader://./assets/image.png');
    expect(rewriteImageSource('../assets/image.png')).toBe('image-loader://../assets/image.png');
    expect(rewriteImageSource('assets/image.png?raw=1')).toBe('image-loader://assets/image.png?raw=1');
    expect(rewriteImageSource('/Users/example/image.png')).toBe('image-loader:///Users/example/image.png');
    expect(rewriteImageSource('/Volumes/Data/image.png')).toBe('image-loader:///Volumes/Data/image.png');
    expect(rewriteImageSource('/docs/image.png')).toBe('/docs/image.png');
    expect(rewriteImageSource('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(rewriteImageSource('file:///Users/example/image.png')).toBe('image-loader:///Users/example/image.png');
    expect(rewriteImageSource('file:///Users/example/a%20b.png?raw=1#preview')).toBe('image-loader:///Users/example/a%20b.png?raw=1#preview');
    expect(rewriteImageSource('file://server/share/image.png')).toBe('file://server/share/image.png');
    expect(rewriteImageSource('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  test('handles malformed preview fragment links without throwing', () => {
    document.body.innerHTML = '<h1 id="title">Title</h1>';
    const heading = document.getElementById('title') as HTMLElement;
    heading.scrollIntoView = jest.fn();

    expect(() => handlePreviewLinkClick('#title')).not.toThrow();
    expect(() => handlePreviewLinkClick('#%E0%A4%A')).not.toThrow();
  });

  test('toggles rendered preview without destroying the editor source', async () => {
    document.body.innerHTML = '<main id="editor"></main>';
    await resetEditor('# Title\n\n![Local](assets/image.png)\n\nInline $x^2$.');
    const editor = window.editor as EditorView;

    expect(setMarkdownPreviewMode(true)).toBe(true);
    const preview = document.querySelector('.markdown-preview') as HTMLElement;
    expect(preview.hidden).toBe(false);
    expect(preview.querySelector('h1')?.id).toBe('title');
    expect(preview.querySelector('h1')?.textContent).toBe('Title');
    expect(preview.innerHTML).toContain('src="image-loader://assets/image.png"');
    expect(preview.innerHTML).toContain('class="katex"');
    expect(preview.innerHTML).toContain('application/x-tex">x^2</annotation>');
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
    expect(window.editor.state.doc.toString()).toBe('# Title\n\n![Local](assets/image.png)\n\nInline $x^2$.');
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
