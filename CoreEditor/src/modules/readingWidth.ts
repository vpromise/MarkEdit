import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tryGetEditor } from '../common/utils';

const widthCompartment = new Compartment();

export function readingWidthExtension(width = 0) {
  return widthCompartment.of(widthTheme(width));
}

export function setReadingWidth(width: number) {
  const value = Number.isFinite(width) && width > 0 ? width : 0;
  window.config.readingWidth = value;
  document.documentElement.style.setProperty('--markdown-preview-reading-width', value > 0 ? `${value}px` : '100%');
  tryGetEditor()?.dispatch({ effects: widthCompartment.reconfigure(widthTheme(value)) });
}

function widthTheme(width: number) {
  return width > 0 ? EditorView.theme({ '.cm-content': { maxWidth: `${width}px`, margin: '0 auto' } }) : [];
}
