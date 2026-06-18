import 'katex/dist/katex.min.css';
import { Config } from '../config';
import { renderMarkdown } from '../modules/markdown/markdownRenderer';
import { enablePinchZoom, PinchZoomBridge } from '../zoom';

// "{{EDITOR_CONFIG}}" will be replaced with a JSON literal
const config: Config = '{{EDITOR_CONFIG}}' as unknown as Config;
window.config = config;

const colorSchemeQuery = matchMedia('(prefers-color-scheme: dark)');
const parent = document.querySelector('#editor') ?? document.body;
const preview = document.querySelector<HTMLElement>('#preview') ?? parent.appendChild(document.createElement('article'));
preview.innerHTML = renderMarkdown(config.text);

const bridge = window as Window & PinchZoomBridge & {
  setTheme: (name: string) => void;
  startDragging: (location: number) => void;
  updateDragging: (location: number) => void;
  cancelDragging: () => void;
};

const storage: { scrollbarOffset?: number } = {};

bridge.setTheme = name => {
  document.documentElement.dataset.theme = name === 'github-dark' ? 'dark' : 'light';
};

colorSchemeQuery.addEventListener('change', () => {
  bridge.setTheme(preferredTheme());
});

bridge.startDragging = original => {
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
bridge.setTheme(preferredTheme());
window.scrollTo({ top: 0, left: 0 });

function preferredTheme() {
  return colorSchemeQuery.matches ? 'github-dark' : 'github-light';
}

function scrollerElement(): HTMLElement {
  return document.scrollingElement as HTMLElement;
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
