import { Config } from '../config';
import { renderMarkdown } from '../modules/markdown/markdownRenderer';

// "{{EDITOR_CONFIG}}" will be replaced with a JSON literal
const config: Config = '{{EDITOR_CONFIG}}' as unknown as Config;
window.config = config;

const parent = document.querySelector('#editor') ?? document.body;
parent.innerHTML = renderMarkdown(config.text);

const bridge = window as Window & {
  setTheme: (name: string) => void;
  startDragging: (location: number) => void;
  updateDragging: (location: number) => void;
  cancelDragging: () => void;
};

const storage: { scrollbarOffset?: number } = {};

bridge.setTheme = name => {
  document.documentElement.dataset.theme = name === 'github-dark' ? 'dark' : 'light';
};

bridge.startDragging = location => {
  const { scrollbarTop, scrollbarHeight } = scrollerGeometryValues();
  storage.scrollbarOffset = location - scrollbarTop;

  if (location < scrollbarTop || location > scrollbarTop + scrollbarHeight) {
    scrollToMouseLocation(location, scrollbarHeight * 0.5, 'smooth');
  }
};

bridge.updateDragging = location => {
  if (storage.scrollbarOffset !== undefined) {
    scrollToMouseLocation(location, storage.scrollbarOffset);
  }
};

bridge.cancelDragging = () => {
  storage.scrollbarOffset = undefined;
};

bridge.setTheme(config.theme);
window.scrollTo({ top: 0, left: 0 });

function scrollToMouseLocation(location: number, scrollbarOffset: number, behavior: ScrollBehavior = 'auto') {
  const { clientHeight, scrollHeight, scrollbarHeight } = scrollerGeometryValues();
  const scrollableHeight = scrollHeight - clientHeight;
  if (scrollableHeight <= 0) {
    return;
  }

  const percentage = (location - scrollbarOffset) / (clientHeight - scrollbarHeight);
  window.scrollTo({
    top: percentage * scrollableHeight,
    behavior,
  });
}

function scrollerGeometryValues() {
  const container = document.documentElement;
  const clientHeight = container.clientHeight;
  const scrollHeight = container.scrollHeight;
  const scrollbarHeight = clientHeight * (clientHeight / scrollHeight);
  const progress = container.scrollTop / Math.max(scrollHeight - clientHeight, 1);
  const scrollbarTop = progress * (clientHeight - scrollbarHeight);

  return { clientHeight, scrollHeight, scrollbarHeight, scrollbarTop };
}
