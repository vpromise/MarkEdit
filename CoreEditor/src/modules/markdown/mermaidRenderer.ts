export type MermaidTheme = 'default' | 'dark';

const diagramSelector = '[data-markedit-mermaid]';
const sourceSelector = '.markdown-preview-mermaid-source';
const canvasSelector = '.markdown-preview-mermaid-canvas';
const errorClassName = 'markdown-preview-mermaid-error';

let diagramID = 0;
let renderQueue = Promise.resolve();

export async function renderMermaidDiagrams(root: ParentNode, theme: MermaidTheme): Promise<void> {
  if (root.querySelector(diagramSelector) === null) {
    return;
  }

  const previousTask = renderQueue;
  const task = renderAfter(previousTask, root, theme);
  renderQueue = task;
  await task;
}

async function renderAfter(previousTask: Promise<void>, root: ParentNode, theme: MermaidTheme) {
  try {
    await previousTask;
  } catch {
    // A failed batch must not prevent later previews from rendering.
  }

  await renderMermaidBatch(root, theme);
}

async function renderMermaidBatch(root: ParentNode, theme: MermaidTheme) {
  const diagrams = [...root.querySelectorAll<HTMLElement>(diagramSelector)]
    .filter(diagram => diagram.dataset.markeditMermaidTheme !== theme);
  if (diagrams.length === 0) {
    return;
  }

  let mermaid: typeof import('mermaid').default;
  try {
    ({ default: mermaid } = await import('mermaid'));
    mermaid.initialize({
      securityLevel: 'strict',
      startOnLoad: false,
      suppressErrorRendering: true,
      theme,
    });
  } catch (error) {
    diagrams.forEach(diagram => showMermaidError(diagram, error));
    return;
  }

  for (const diagram of diagrams) {
    const source = diagram.querySelector<HTMLElement>(sourceSelector);
    const canvas = diagram.querySelector<HTMLElement>(canvasSelector);
    if (source === null || canvas === null) {
      continue;
    }

    diagram.setAttribute('aria-busy', 'true');
    const renderID = `markedit-mermaid-${diagramID}`;
    diagramID += 1;

    try {
      const { svg, bindFunctions } = await mermaid.render(renderID, source.textContent);
      if (!diagram.isConnected) {
        continue;
      }

      canvas.innerHTML = svg;
      bindFunctions?.(canvas);
      source.hidden = true;
      diagram.classList.remove(errorClassName);
      diagram.dataset.markeditMermaidTheme = theme;
      diagram.setAttribute('aria-busy', 'false');
    } catch (error) {
      document.getElementById(renderID)?.remove();
      document.getElementById(`d${renderID}`)?.remove();
      showMermaidError(diagram, error);
    }
  }
}

function showMermaidError(diagram: HTMLElement, error: unknown) {
  const source = diagram.querySelector<HTMLElement>(sourceSelector);
  const canvas = diagram.querySelector<HTMLElement>(canvasSelector);
  if (source === null || canvas === null) {
    return;
  }

  const message = document.createElement('div');
  message.className = 'markdown-preview-mermaid-error-message';
  message.setAttribute('role', 'alert');
  message.textContent = `Mermaid: ${errorMessage(error)}`;

  source.hidden = false;
  canvas.replaceChildren(message);
  diagram.classList.add(errorClassName);
  diagram.removeAttribute('data-markedit-mermaid-theme');
  diagram.setAttribute('aria-busy', 'false');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message.trim();
  }

  return 'Unable to render diagram';
}
