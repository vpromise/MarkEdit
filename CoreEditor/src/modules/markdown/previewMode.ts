import { EditorView } from '@codemirror/view';
import type { Text } from '@codemirror/state';
import { isReleaseMode } from '../../common/utils';
import { getLinkAnchor } from '../toc';
import { renderMermaidDiagrams } from './mermaidRenderer';
import { renderMarkdownResult, TaskMarker } from './markdownRenderer';
import { resolveTaskToggle } from './task';
import { copyText } from './clipboard';

const previewClassName = 'markdown-preview';
const previewModeClassName = 'markdown-preview-mode';
const rootPreviewModeClassName = 'markdown-preview-active';
const hiddenClassName = 'markdown-preview-source-hidden';
const imageLoaderScheme = 'image-loader://';
const absoluteSchemePattern = /^[a-z][a-z0-9+.-]*:/i;
const absolutePathPattern = /^\/(?:Users|Volumes|private|tmp|var)\//;

const storage: {
  enabled: boolean;
  container?: HTMLElement;
  parent?: Element;
  sourceDocument?: Text;
  tasks: WeakMap<HTMLInputElement, TaskMarker>;
} = {
  enabled: false,
  tasks: new WeakMap(),
};

export function setMarkdownPreviewMode(enabled: boolean, markdownText?: string): boolean {
  if (enabled) {
    return showMarkdownPreview(markdownText);
  }

  hideMarkdownPreview(true);
  return storage.enabled;
}

export function getMarkdownPreviewMode(): boolean {
  return storage.enabled;
}

export function scrollToMarkdownPreviewHeading(position: number): boolean {
  if (!storage.enabled || storage.container === undefined) {
    return false;
  }

  const line = window.editor.state.doc.lineAt(position).number - 1;
  storage.container.querySelector<HTMLElement>(`[data-markedit-heading-line="${line}"]`)
    ?.scrollIntoView({ block: window.config.typewriterMode ? 'center' : 'start' });
  return true;
}

export function resetMarkdownPreviewMode() {
  hideMarkdownPreview(false);
  storage.container?.remove();
  storage.container = undefined;
  storage.sourceDocument = undefined;
  storage.tasks = new WeakMap();
}

export function rewriteImageSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return source;
  }

  if (trimmed.toLowerCase().startsWith('file:')) {
    return rewriteFileImageSource(trimmed) ?? source;
  }

  if (absoluteSchemePattern.test(trimmed)) {
    return source;
  }

  if (trimmed.startsWith('/') && !absolutePathPattern.test(trimmed)) {
    return source;
  }

  return `${imageLoaderScheme}${trimmed}`;
}

function rewriteFileImageSource(source: string): string | undefined {
  try {
    const url = new URL(source);
    if (url.protocol !== 'file:' || (url.hostname !== '' && url.hostname !== 'localhost')) {
      return undefined;
    }

    return `${imageLoaderScheme}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

function showMarkdownPreview(markdownText?: string): boolean {
  const editor = window.editor as EditorView | undefined;
  if (typeof editor?.destroy !== 'function') {
    storage.enabled = false;
    return false;
  }

  const parent = document.querySelector('#editor') ?? document.body;
  const container = previewContainer(parent, editor.dom);
  const scrollRatio = scrollTopRatio(editor.scrollDOM);

  const source = markdownText ?? editor.state.doc.toString();
  const result = renderMarkdownResult(source);
  container.innerHTML = result.html;
  prepareMarkdownPreview(container);
  storage.tasks = new WeakMap();
  storage.sourceDocument = source === editor.state.doc.toString() ? editor.state.doc : undefined;
  const markers = new Map(result.tasks.map(marker => [marker.id, marker]));
  container.querySelectorAll<HTMLInputElement>('input[data-markedit-task]').forEach(input => {
    const marker = markers.get(input.dataset.markeditTask ?? '');
    if (marker !== undefined && storage.sourceDocument !== undefined && !editor.state.readOnly && !window.config.readOnlyMode) {
      const label = input.closest('li')?.textContent.trim() ?? '';
      input.setAttribute('aria-label', label.length > 0 ? label : 'Task');
      input.disabled = false;
      storage.tasks.set(input, marker);
    }
  });
  void renderMermaidDiagrams(container, editor.state.facet(EditorView.darkTheme) ? 'dark' : 'default');
  container.hidden = false;

  document.documentElement.classList.add(rootPreviewModeClassName);
  parent.classList.add(previewModeClassName);
  editor.dom.classList.add(hiddenClassName);
  editor.dom.hidden = true;
  editor.dom.setAttribute('aria-hidden', 'true');
  document.scrollingElement?.scrollTo({ top: 0 });
  storage.parent = parent;
  storage.enabled = true;

  requestAnimationFrame(() => {
    container.scrollTo({ top: scrollRatio * (container.scrollHeight - container.clientHeight) });
  });

  return true;
}

export function refreshMarkdownPreviewMermaidTheme() {
  const editor = window.editor as EditorView | undefined;
  if (!storage.enabled || storage.container === undefined || typeof editor?.destroy !== 'function') {
    return;
  }

  void renderMermaidDiagrams(storage.container, editor.state.facet(EditorView.darkTheme) ? 'dark' : 'default');
}

function hideMarkdownPreview(focusEditor: boolean) {
  const editor = window.editor as EditorView | undefined;
  storage.container?.setAttribute('hidden', '');
  storage.parent?.classList.remove(previewModeClassName);
  document.documentElement.classList.remove(rootPreviewModeClassName);
  storage.enabled = false;
  storage.parent = undefined;

  if (typeof editor?.destroy !== 'function') {
    return;
  }

  editor.dom.hidden = false;
  editor.dom.removeAttribute('aria-hidden');
  editor.dom.classList.remove(hiddenClassName);
  editor.requestMeasure();
  if (focusEditor) {
    editor.focus();
  }
}

function previewContainer(parent: Element, before: Element) {
  if (storage.container !== undefined) {
    return storage.container;
  }

  const container = document.createElement('article');
  container.className = previewClassName;
  container.hidden = true;
  container.addEventListener('click', handlePreviewClick);
  container.addEventListener('change', handleTaskChange);
  parent.insertBefore(container, before);
  storage.container = container;
  return container;
}

export function prepareMarkdownPreview(container: HTMLElement) {
  applyHeadingAnchors(container);
  rewriteLocalImageSources(container);
  container.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
  addCodeCopyButtons(container);
}

function applyHeadingAnchors(container: HTMLElement) {
  const ids = new Set([...container.querySelectorAll<HTMLElement>('[id]')].map(element => element.id));
  container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6').forEach(heading => {
    if (heading.id === '') {
      const base = getLinkAnchor(heading.textContent) || 'section';
      let id = base;
      let suffix = 1;
      while (ids.has(id)) {
        id = `${base}-${suffix++}`;
      }

      heading.id = id;
      ids.add(id);
    }
  });
}

function handleTaskChange(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const marker = storage.tasks.get(input);
  if (marker === undefined) {
    return;
  }

  const editor = window.editor;
  if (!storage.enabled || editor.state.readOnly || window.config.readOnlyMode || editor.state.doc !== storage.sourceDocument) {
    input.checked = !input.checked;
    return;
  }

  const line = editor.state.doc.line(marker.line + 1);
  const toggle = resolveTaskToggle(line.text);
  if (toggle === null) {
    input.checked = !input.checked;
    return;
  }

  const from = line.from + toggle.offset;
  editor.dispatch({ changes: { from, to: from + 1, insert: toggle.replacement }, userEvent: 'input.task' });
  storage.sourceDocument = editor.state.doc;
}

function addCodeCopyButtons(container: HTMLElement) {
  container.querySelectorAll<HTMLPreElement>('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (code === null || pre.querySelector('.markdown-preview-copy') !== null) {
      return;
    }

    const button = document.createElement('button');
    const title = window.config.localizable?.copyCodeTitle ?? 'Copy Code';
    button.type = 'button';
    button.className = 'markdown-preview-copy';
    button.textContent = title;
    button.setAttribute('aria-label', title);
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      const copied = await copyText(code.textContent);
      button.disabled = false;
      button.textContent = copied
        ? window.config.localizable?.copiedTitle ?? 'Copied'
        : window.config.localizable?.copyFailedTitle ?? 'Copy Failed';
      setTimeout(() => { button.textContent = title; }, 1500);
    });
    pre.appendChild(button);
  });
}

function rewriteLocalImageSources(container: HTMLElement) {
  container.querySelectorAll<HTMLImageElement>('img[src]').forEach(image => {
    image.setAttribute('src', rewriteImageSource(image.getAttribute('src') ?? ''));
  });
}

function handlePreviewClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
  if (anchor === null || anchor === undefined) {
    return;
  }

  const link = anchor.getAttribute('href') ?? '';
  if (link === '') {
    return;
  }

  event.preventDefault();
  handlePreviewLinkClick(link);
}

export function handlePreviewLinkClick(link: string) {
  if (link.startsWith('#')) {
    scrollToPreviewAnchor(link);
    return;
  }

  if (isReleaseMode) {
    window.nativeModules.core.notifyLinkClicked({ link });
  } else {
    window.open(link, '_blank');
  }
}

function scrollToPreviewAnchor(link: string) {
  const anchor = decodedAnchor(link.substring(1));
  if (anchor !== undefined) {
    document.getElementById(anchor)?.scrollIntoView();
  }
}

function decodedAnchor(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function scrollTopRatio(element: HTMLElement) {
  const scrollableHeight = element.scrollHeight - element.clientHeight;
  if (scrollableHeight <= 0) {
    return 0;
  }

  return element.scrollTop / scrollableHeight;
}
