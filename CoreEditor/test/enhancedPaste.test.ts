import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { htmlToMarkdown, handleEnhancedPaste, enhancedPaste, pasteImages } from '../src/modules/paste';
import * as editor from './utils/editor';
import { history, undo } from '../src/@vendor/commands/history';
import type { CreateFileOptions } from 'markedit-api';

function pasteEvent(html: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: { items: [], getData: (type: string) => type === 'text/html' ? html : '' },
  });
  return event;
}

const fileInfo = JSON.stringify({
  filePath: '/Documents/note.md', parentPath: '/Documents', fileSize: 10,
  creationDate: 0, modificationDate: 0, isDirectory: false,
});

afterEach(() => {
  const view = Reflect.get(window, 'editor') as EditorView | undefined;
  view?.destroy();
  jest.restoreAllMocks();
});

describe('Built-in enhanced paste', () => {
  test('converts headings, emphasis, links, lists, and HTML tables', () => {
    const markdown = htmlToMarkdown('<h2>Title</h2><p><strong>Bold</strong> <a href="https://example.com">Link</a></p>'
      + '<ul><li>One</li><li>Two</li></ul><table><tr><th>Name</th><th>Value</th></tr><tr><td>A|B</td><td>1</td></tr></table>');
    expect(markdown).toContain('## Title');
    expect(markdown).toContain('**Bold**');
    expect(markdown).toContain('[Link](https://example.com)');
    expect(markdown).toContain('| Name | Value |');
    expect(markdown).toContain('| A\\|B | 1 |');
  });

  test('replaces the selection with one undoable rich paste transaction', () => {
    editor.setUp('before selected after', [enhancedPaste, history()]);
    editor.selectRange(7, 15);
    const event = pasteEvent('<strong>中文</strong>');
    expect(handleEnhancedPaste(event, window.editor)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getText()).toBe('before **中文** after');
    expect(undo(window.editor)).toBe(true);
    expect(editor.getText()).toBe('before selected after');
  });

  test('leaves rich text in code blocks to the normal plain-text paste handler', () => {
    editor.setUp('```js\nconst value = 1;\n```', enhancedPaste);
    editor.selectRange(12, 12);
    expect(handleEnhancedPaste(pasteEvent('<b>Bold</b>'), window.editor)).toBe(false);
  });

  test('respects the setting and read-only mode', () => {
    editor.setUp('source', enhancedPaste);
    window.config.enhancedPasteEnabled = false;
    expect(handleEnhancedPaste(pasteEvent('<b>Bold</b>'), window.editor)).toBe(false);
    window.editor.destroy();
    editor.setUp('source', [enhancedPaste, EditorState.readOnly.of(true), EditorView.editable.of(false)]);
    expect(handleEnhancedPaste(pasteEvent('<b>Bold</b>'), window.editor)).toBe(false);
  });

  test('saves image bytes beside the document and inserts a relative reference', async () => {
    editor.setUp('Before after', enhancedPaste);
    editor.selectRange(7, 7);
    const create = jest.fn<(args: { options: CreateFileOptions }) => Promise<boolean>>(async () => true);
    window.nativeModules.api = {
      getFileInfo: jest.fn(async () => fileInfo), createFile: create,
    } as unknown as typeof window.nativeModules.api;
    const result = await pasteImages(window.editor, [new File(['image bytes'], 'Screenshot.png', { type: 'image/png' })]);
    expect(result).toBe(true);
    expect(create).toHaveBeenCalledWith({ options: { path: '/Documents/assets', isDirectory: true } });
    expect(create.mock.calls).toHaveLength(2);
    expect(create).toHaveBeenCalledWith({ options: {
      path: expect.stringMatching(/^\/Documents\/assets\/image-.+\.png$/),
      data: btoa('image bytes'), overwrites: false,
    } });
    expect(editor.getText()).toMatch(/^Before !\[Screenshot\.png\]\(assets\/image-[a-f0-9-]+\.png\)after$/);
  });

  test('stores TextBundle images inside the package assets directory', async () => {
    editor.setUp('bundle', enhancedPaste);
    const create = jest.fn<(args: { options: CreateFileOptions }) => Promise<boolean>>(async () => true);
    const bundleInfo = JSON.stringify({
      filePath: '/Documents/note.textbundle', parentPath: '/Documents', fileSize: 10,
      creationDate: 0, modificationDate: 0, isDirectory: true,
    });
    window.nativeModules.api = {
      getFileInfo: jest.fn(async () => bundleInfo), createFile: create,
    } as unknown as typeof window.nativeModules.api;
    await pasteImages(window.editor, [new File(['bytes'], 'image.png', { type: 'image/png' })]);
    expect(create).toHaveBeenCalledWith({ options: { path: '/Documents/note.textbundle/assets', isDirectory: true } });
  });

  test('maps the pending paste position through edits made while saving an image', async () => {
    editor.setUp('Before after', enhancedPaste);
    editor.selectRange(7, 7);
    window.nativeModules.api = {
      getFileInfo: jest.fn(async () => fileInfo), createFile: jest.fn(async () => true),
    } as unknown as typeof window.nativeModules.api;
    const pending = pasteImages(window.editor, [new File(['bytes'], 'image.png', { type: 'image/png' })]);
    window.editor.dispatch({ changes: { from: 0, insert: 'Prefix ' } });
    expect(await pending).toBe(true);
    expect(editor.getText()).toMatch(/^Prefix Before !\[image\.png\]\(assets\/.+\)after$/);
  });

  test('does not paste into a destroyed editor or create files for an unsaved document', async () => {
    editor.setUp('source', enhancedPaste);
    const create = jest.fn(async () => true);
    window.nativeModules.api = {
      getFileInfo: jest.fn(async () => fileInfo), createFile: create,
    } as unknown as typeof window.nativeModules.api;
    const pending = pasteImages(window.editor, [new File(['bytes'], 'image.png', { type: 'image/png' })]);
    window.editor.destroy();
    expect(await pending).toBe(false);
    expect(create).not.toHaveBeenCalled();

    editor.setUp('unsaved', enhancedPaste);
    window.nativeModules.api.getFileInfo = jest.fn(async () => undefined);
    await expect(pasteImages(window.editor, [new File(['bytes'], 'image.png', { type: 'image/png' })])).rejects.toThrow('saved');
    expect(create).not.toHaveBeenCalled();
    expect(editor.getText()).toBe('unsaved');
  });

  test('does not insert a broken reference when image writing fails', async () => {
    editor.setUp('source', enhancedPaste);
    window.nativeModules.api = {
      getFileInfo: jest.fn(async () => fileInfo), createFile: jest.fn(async () => false),
    } as unknown as typeof window.nativeModules.api;
    await expect(pasteImages(window.editor, [new File(['bytes'], 'image.png', { type: 'image/png' })])).rejects.toThrow('directory');
    expect(editor.getText()).toBe('source');
  });
});
