import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { renderMarkdown } from '../src/modules/markdown/markdownRenderer';
import { renderMermaidDiagrams } from '../src/modules/markdown/mermaidRenderer';

const initialize = jest.fn();
const render = jest.fn<(id: string, source: string) => Promise<{ svg: string }>>();

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize,
    render,
  },
}));

describe('Mermaid Markdown renderer', () => {
  beforeEach(() => {
    initialize.mockReset();
    render.mockReset();
    document.body.innerHTML = '';
  });

  test('replaces a Mermaid fence with rendered SVG', async () => {
    render.mockResolvedValue({
      svg: '<svg role="graphics-document"><text>Diagram</text></svg>',
    });
    document.body.innerHTML = renderMarkdown('```mermaid\ngraph TD\n  A --> B\n```');

    await renderMermaidDiagrams(document, 'dark');

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      securityLevel: 'strict',
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: 'dark',
    }));
    expect(render).toHaveBeenCalledWith(expect.stringMatching(/^markedit-mermaid-\d+$/), 'graph TD\n  A --> B\n');
    expect(document.querySelector('.markdown-preview-mermaid-canvas')?.innerHTML).toContain('<svg');
    expect(document.querySelector('.markdown-preview-mermaid')?.getAttribute('aria-busy')).toBe('false');
    expect(document.querySelector<HTMLElement>('.markdown-preview-mermaid-source')?.hidden).toBe(true);
  });

  test('shows source and an error when Mermaid rejects invalid syntax', async () => {
    render.mockRejectedValue(new Error('Parse error'));
    document.body.innerHTML = renderMarkdown('```mermaid\nnot a diagram\n```');

    await renderMermaidDiagrams(document, 'default');

    expect(document.querySelector('.markdown-preview-mermaid')?.classList.contains('markdown-preview-mermaid-error')).toBe(true);
    expect(document.querySelector<HTMLElement>('.markdown-preview-mermaid-source')?.hidden).toBe(false);
    expect(document.querySelector('.markdown-preview-mermaid-error-message')?.textContent).toContain('Parse error');
  });
});
