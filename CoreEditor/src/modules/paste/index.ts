import TurndownService from 'turndown';
import { EditorSelection } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { createFile, getFileInfo } from '../../api/files';

interface PendingPaste {
  from: number;
  to: number;
  cancelled: boolean;
}

const pendingPastes = new WeakMap<EditorView, Set<PendingPaste>>();
const positions = ViewPlugin.define(view => ({
  update(update) {
    for (const paste of pendingPastes.get(view) ?? []) {
      update.changes.iterChangedRanges((from, to) => {
        if (from < paste.to && to > paste.from) {
          paste.cancelled = true;
        }
      });
      paste.from = update.changes.mapPos(paste.from, -1);
      paste.to = Math.max(paste.from, update.changes.mapPos(paste.to, -1));
    }
  },
  destroy() {
    for (const paste of pendingPastes.get(view) ?? []) {
      paste.cancelled = true;
    }
    pendingPastes.delete(view);
  },
}));

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});
turndown.addRule('strikethrough', {
  filter: node => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
  replacement: content => `~~${content}~~`,
});
turndown.addRule('markdownTable', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = [...(node as HTMLTableElement).rows].map(row => [...row.cells].map(cell => {
      return turndown.turndown(cell.innerHTML).trim().replace(/\n+/g, '<br>').replace(/\|/g, '\\|');
    }));
    const columns = Math.max(0, ...rows.map(row => row.length));
    if (columns === 0) {
      return '';
    }

    const line = (cells: string[]) => `| ${Array.from({ length: columns }, (_, index) => cells[index] ?? '').join(' | ')} |`;
    return `\n\n${[line(rows[0]), line(Array<string>(columns).fill('---')), ...rows.slice(1).map(line)].join('\n')}\n\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export const enhancedPaste = [positions, EditorView.domEventHandlers({ paste: handleEnhancedPaste })];

export function handleEnhancedPaste(event: ClipboardEvent, view: EditorView): boolean {
  if (window.config.enhancedPasteEnabled === false || view.state.readOnly || !view.state.facet(EditorView.editable)
    || view.composing || isInsideCode(view)) {
    return false;
  }

  const images = [...(event.clipboardData?.items ?? [])]
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter((file): file is File => file !== null);
  if (images.length > 0) {
    event.preventDefault();
    void pasteImagesAndReportError(view, images);
    return true;
  }

  const html = event.clipboardData?.getData('text/html') ?? '';
  if (html === '') {
    return false;
  }

  const markdown = htmlToMarkdown(html);
  if (markdown === '') {
    return false;
  }

  event.preventDefault();
  view.dispatch(view.state.replaceSelection(markdown), { userEvent: 'input.paste', scrollIntoView: true });
  return true;
}

export async function pasteImages(view: EditorView, images: File[]): Promise<boolean> {
  if (view.state.readOnly || view.state.selection.ranges.length !== 1 || view.composing) {
    return false;
  }

  const { from, to } = view.state.selection.main;
  const request: PendingPaste = { from, to, cancelled: false };
  const requests = pendingPastes.get(view) ?? new Set<PendingPaste>();
  requests.add(request);
  pendingPastes.set(view, requests);

  const isCurrent = () => !request.cancelled && window.editor === view && !view.state.readOnly
    && view.state.facet(EditorView.editable) && !view.composing;

  try {
    const info = await getFileInfo();
    if (!isCurrent()) {
      return false;
    }
    if (info === undefined) {
      throw new Error('The document must be saved before pasting images');
    }

    const directory = `${info.isDirectory ? info.filePath : info.parentPath}/assets`;
    if (!await createFile({ path: directory, isDirectory: true })) {
      throw new Error('Unable to create the image directory');
    }

    const references: string[] = [];
    for (const image of images) {
      const data = await imageData(image);
      if (!isCurrent()) {
        return false;
      }

      const extension = image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
      const name = `image-${crypto.randomUUID()}.${extension === 'svgxml' ? 'svg' : extension}`;
      if (!await createFile({ path: `${directory}/${name}`, data, overwrites: false })) {
        throw new Error('Unable to save the pasted image');
      }

      references.push(`![${image.name.replace(/[\\[\]\r\n]/g, '') || 'Image'}](assets/${name})`);
    }

    const currentInfo = await getFileInfo();
    if (!isCurrent() || currentInfo?.filePath !== info.filePath) {
      return false;
    }

    const markdown = references.join(view.state.lineBreak);
    const selection = view.state.selection.main;
    const keepCaret = selection.from !== request.from || selection.to !== request.to;
    requests.delete(request);
    view.dispatch({
      changes: { from: request.from, to: request.to, insert: markdown },
      selection: keepCaret ? undefined : EditorSelection.cursor(request.from + markdown.length),
      userEvent: 'input.paste',
      scrollIntoView: !keepCaret,
    });
    return true;
  } finally {
    requests.delete(request);
  }
}

function imageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split('base64,')[1]);
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the pasted image'));
    reader.readAsDataURL(file);
  });
}

async function pasteImagesAndReportError(view: EditorView, images: File[]) {
  try {
    await pasteImages(view, images);
  } catch (error) {
    console.error('Image paste failed:', error);
    try {
      await window.nativeModules.api.showAlert({
        title: window.config.localizable?.imagePasteFailedTitle ?? 'Unable to Paste Image',
        message: window.config.localizable?.imagePasteFailedMessage ?? 'Save this document and grant access to its folder before pasting images.',
      });
    } catch (alertError) {
      console.error('Unable to show the image paste error:', alertError);
    }
  }
}

function isInsideCode(view: EditorView): boolean {
  let node = syntaxTree(view.state).resolveInner(view.state.selection.main.head, -1);
  for (;;) {
    if (['FencedCode', 'CodeBlock', 'InlineCode'].includes(node.name)) {
      return true;
    }
    if (node.parent === null) {
      return false;
    }
    node = node.parent;
  }
}
