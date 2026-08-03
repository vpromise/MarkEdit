import { Config } from '../config';
import { setEditorColors } from '../styling/config';
import { renderMarkdown } from '../modules/markdown/markdownRenderer';
import { renderMermaidDiagrams } from '../modules/markdown/mermaidRenderer';
import { rewriteImageSource } from '../modules/markdown/previewMode';
import { enablePinchZoom, PinchZoomTarget } from './zoom';

import GitHubLight from '../styling/themes/github-light';
import GitHubDark from '../styling/themes/github-dark';

// There's no native bridge in the QuickLook extension, functions live on window directly
declare global {
  interface Window {
    startDragging?: (location: number) => void;
    updateDragging?: (location: number) => void;
    cancelDragging?: () => void;
    pinchZoomTarget?: () => PinchZoomTarget | null;
  }
}

/**
 * Render Markdown for the QuickLook extension using the same safe renderer as
 * the main app's toolbar preview.
 */
export function setUpQuickLook(config: Config) {
  document.documentElement.classList.add('markedit-quicklook');

  const parent = document.querySelector('#editor') ?? document.body;
  const preview = document.createElement('article');
  preview.className = 'markdown-preview';
  preview.innerHTML = renderMarkdown(config.text);
  rewriteLocalImageSources(preview);
  parent.replaceChildren(preview);

  const colorSchemeQuery = matchMedia('(prefers-color-scheme: dark)');
  const updateTheme = () => {
    const isDark = colorSchemeQuery.matches;
    const theme = isDark ? GitHubDark() : GitHubLight();
    setEditorColors(theme.colors);
    void renderMermaidDiagrams(preview, isDark ? 'dark' : 'default');
  };

  colorSchemeQuery.addEventListener('change', updateTheme);
  updateTheme();
  enableDragGestures(preview);
  window.scrollTo({ top: 0, left: 0 });
}

function rewriteLocalImageSources(container: HTMLElement) {
  container.querySelectorAll<HTMLImageElement>('img[src]').forEach(image => {
    image.setAttribute('src', rewriteImageSource(image.getAttribute('src') ?? ''));
  });
}

/**
 * Homemade scrollbar dragging, driven by mouse events forwarded from native.
 */
function enableDragGestures(preview: HTMLElement) {
  const bridge = window;
  bridge.startDragging = original => {
    // scrollbarOffset is the distance between the top of the scrollbar and the mouse location
    const location = convertToLocal(original);
    const { scrollbarTop, scrollbarHeight } = scrollerGeometryValues();
    storage.scrollbarOffset = location - scrollbarTop;

    if (location < scrollbarTop || location > scrollbarTop + scrollbarHeight) {
      scrollToMouseLocation(location, scrollbarHeight * 0.5, 'smooth');
    }
  };

  bridge.updateDragging = location => {
    if (storage.scrollbarOffset !== undefined) {
      scrollToMouseLocation(convertToLocal(location), storage.scrollbarOffset);
    }
  };

  bridge.cancelDragging = () => {
    storage.scrollbarOffset = undefined;
  };

  enablePinchZoom(bridge);
  bridge.pinchZoomTarget = () => ({ scroller: scrollerElement(), inner: preview });
}

function scrollerElement(): HTMLElement {
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function scrollToMouseLocation(location: number, scrollbarOffset: number, behavior: ScrollBehavior = 'auto') {
  const { clientHeight, scrollHeight, scrollbarHeight } = scrollerGeometryValues();
  const scrollableHeight = scrollHeight - clientHeight;
  if (scrollableHeight <= 0) {
    return;
  }

  const percentage = (location - scrollbarOffset) / (clientHeight - scrollbarHeight);
  scrollerElement().scrollTo({
    top: percentage * scrollableHeight,
    behavior,
  });
}

function convertToLocal(viewportY: number): number {
  return viewportY - scrollerElement().getBoundingClientRect().top;
}

function scrollerGeometryValues() {
  const container = scrollerElement();
  const clientHeight = container.clientHeight;
  const scrollHeight = container.scrollHeight;
  const scrollbarHeight = clientHeight * (clientHeight / scrollHeight);
  const progress = container.scrollTop / Math.max(scrollHeight - clientHeight, 1);
  const scrollbarTop = progress * (clientHeight - scrollbarHeight);

  return { clientHeight, scrollHeight, scrollbarHeight, scrollbarTop };
}

const storage: { scrollbarOffset?: number } = {};
