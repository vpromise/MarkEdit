import { EditorView } from '@codemirror/view';
import { isReleaseMode } from '../../common/utils';
import { renderMarkdown } from './markdownRenderer';

const previewClassName = 'markdown-preview';
const previewModeClassName = 'markdown-preview-mode';
const rootPreviewModeClassName = 'markdown-preview-active';
const hiddenClassName = 'markdown-preview-source-hidden';
const imageLoaderScheme = 'image-loader://';
const absoluteSchemePattern = /^[a-z][a-z0-9+.-]*:/i;

const storage: {
  enabled: boolean;
  container?: HTMLElement;
  parent?: Element;
} = {
  enabled: false,
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

export function resetMarkdownPreviewMode() {
  hideMarkdownPreview(false);
  storage.container?.remove();
  storage.container = undefined;
}

export function rewriteImageSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//') || absoluteSchemePattern.test(trimmed) || trimmed.startsWith('/')) {
    return source;
  }

  return `${imageLoaderScheme}${trimmed}`;
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

  container.innerHTML = renderMarkdown(markdownText ?? editor.state.doc.toString());
  rewriteLocalImageSources(container);
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
  parent.insertBefore(container, before);
  storage.container = container;
  return container;
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

  if (link.startsWith('#')) {
    document.getElementById(decodeURIComponent(link.substring(1)))?.scrollIntoView();
    return;
  }

  if (isReleaseMode) {
    window.nativeModules.core.notifyLinkClicked({ link });
  } else {
    window.open(link, '_blank');
  }
}

function scrollTopRatio(element: HTMLElement) {
  const scrollableHeight = element.scrollHeight - element.clientHeight;
  if (scrollableHeight <= 0) {
    return 0;
  }

  return element.scrollTop / scrollableHeight;
}
