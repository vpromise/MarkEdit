import DOMPurify from 'dompurify';
import katex from 'katex';
import MarkdownIt from 'markdown-it';
import type { Config as DOMPurifyConfig } from 'dompurify';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';

const controlOrWhitespace = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}\\s]+`, 'g');
const schemePattern = /^[a-z][a-z0-9+.-]*:/i;
const dataImagePattern = /^data:image\/(?:gif|png|jpe?g|webp|avif);/i;
const mathPlaceholderAttribute = 'data-markedit-math';
const rawCodeTagPattern = /^<\/?\s*(?:code|pre|kbd|samp)(?:\s|>|\/)/i;
const rawCodeClosePattern = /^<\/\s*(?:code|pre|kbd|samp)\s*>/i;

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

type MathReplacement = {
  readonly index: number;
  readonly html: string;
};

type MathSegment = {
  readonly placeholder: string;
  readonly html: string;
};

type MathEnvironment = {
  readonly mathNonce: string;
  readonly mathSegments: MathSegment[];
};

type MathDelimiter = {
  readonly open: string;
  readonly close: string;
  readonly displayMode: boolean;
};

markdown.validateLink = value => isAllowedMarkdownResource(value);
markdown.block.ruler.before('paragraph', 'markedit_math_block', mathBlockRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
markdown.inline.ruler.before('escape', 'markedit_math_inline', mathInlineRule);

const sanitizeConfig: DOMPurifyConfig = {
  ADD_DATA_URI_TAGS: ['img'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style', 'srcset'],
  FORBID_TAGS: ['script'],
};

const mathSanitizeConfig: DOMPurifyConfig = {
  ADD_ATTR: ['encoding'],
  ADD_TAGS: ['annotation', 'semantics'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcset'],
  FORBID_TAGS: ['script'],
};

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'href') {
    data.keepAttr = isAllowedLink(data.attrValue);
    data.forceKeepAttr = data.keepAttr;
  }

  if (data.attrName === 'src') {
    data.keepAttr = node.nodeName.toLowerCase() === 'img' && isAllowedImage(data.attrValue);
    data.forceKeepAttr = data.keepAttr;
  }
});

export function renderMarkdown(markdownText: string): string {
  const env = createMathEnvironment();
  const sanitizedHTML = DOMPurify.sanitize(markdown.render(markdownText, env), sanitizeConfig);
  return restoreMathSegments(sanitizedHTML, env);
}

function createMathEnvironment(): MathEnvironment {
  return {
    mathNonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    mathSegments: [],
  };
}

function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  const start = state.bMarks[startLine] + state.tShift[startLine];
  const delimiter = blockMathDelimiter(state.src, start);
  if (delimiter === undefined) {
    return false;
  }

  const mathBlock = readBlockMath(state, startLine, endLine, start, delimiter);
  if (mathBlock === undefined) {
    return false;
  }

  if (silent) {
    return true;
  }

  const token = state.push('html_block', '', 0);
  token.content = addMathSegment(mathBlock.content, delimiter.displayMode, state.env as MathEnvironment);
  token.map = [startLine, mathBlock.endLine];
  state.line = mathBlock.endLine;
  return true;
}

function blockMathDelimiter(source: string, position: number): MathDelimiter | undefined {
  if (source.startsWith('$$', position)) {
    return { open: '$$', close: '$$', displayMode: true };
  }

  if (source.startsWith('\\[', position) && !isEscaped(source, position)) {
    return { open: '\\[', close: '\\]', displayMode: true };
  }

  return undefined;
}

function readBlockMath(state: StateBlock, startLine: number, endLine: number, start: number, delimiter: MathDelimiter) {
  const firstLineEnd = state.eMarks[startLine];
  const contentStart = start + delimiter.open.length;
  const sameLineClose = findClosingDelimiter(state.src, delimiter.close, contentStart, firstLineEnd);
  if (sameLineClose !== -1 && isBlank(state.src.slice(sameLineClose + delimiter.close.length, firstLineEnd))) {
    const content = state.src.slice(contentStart, sameLineClose).trim();
    return content === '' ? undefined : { content, endLine: startLine + 1 };
  }

  let line = startLine + 1;
  while (line < endLine) {
    const lineStart = state.bMarks[line] + state.tShift[line];
    const lineEnd = state.eMarks[line];
    if (state.src.startsWith(delimiter.close, lineStart) && isBlank(state.src.slice(lineStart + delimiter.close.length, lineEnd))) {
      const content = state.src.slice(contentStart, lineStart).trim();
      return content === '' ? undefined : { content, endLine: line + 1 };
    }

    line += 1;
  }

  return undefined;
}

function mathInlineRule(state: StateInline, silent: boolean): boolean {
  if (isInsideRawCodeHTML(state.tokens)) {
    return false;
  }

  const delimiter = inlineMathDelimiter(state.src, state.pos);
  if (delimiter === undefined) {
    return false;
  }

  const end = delimiter.open === '$'
    ? findClosingInlineMath(state.src, state.pos + delimiter.open.length, state.posMax)
    : findClosingDelimiter(state.src, delimiter.close, state.pos + delimiter.open.length, state.posMax);
  if (end === -1) {
    return false;
  }

  const content = state.src.slice(state.pos + delimiter.open.length, end);
  if (content.trim() === '' || !isValidInlineMathContent(content)) {
    return false;
  }

  state.pos = end + delimiter.close.length;
  if (!silent) {
    const token = state.push('html_inline', '', 0);
    token.content = addMathSegment(content, delimiter.displayMode, state.env as MathEnvironment);
  }

  return true;
}

function inlineMathDelimiter(source: string, position: number): MathDelimiter | undefined {
  if (source[position] === '$' && source[position + 1] !== '$' && isValidInlineMathOpen(source, position)) {
    return { open: '$', close: '$', displayMode: false };
  }

  if (source.startsWith('\\(', position) && !isEscaped(source, position)) {
    return { open: '\\(', close: '\\)', displayMode: false };
  }

  if (source.startsWith('\\[', position) && !isEscaped(source, position)) {
    return { open: '\\[', close: '\\]', displayMode: true };
  }

  return undefined;
}

function addMathSegment(content: string, displayMode: boolean, env: MathEnvironment): string {
  const placeholder = `<span ${mathPlaceholderAttribute}="${env.mathNonce}-${env.mathSegments.length}"></span>`;
  env.mathSegments.push({
    placeholder,
    html: sanitizeMathHTML(katex.renderToString(content, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: false,
    })),
  });

  return placeholder;
}

function sanitizeMathHTML(html: string): string {
  return DOMPurify.sanitize(html, mathSanitizeConfig);
}

function restoreMathSegments(html: string, env: MathEnvironment): string {
  const replacements = env.mathSegments.map((segment, index) => ({
    index,
    html: segment.html,
  }));

  return html.replace(mathPlaceholderPattern(env.mathNonce), (match, index: string) => replacementHTML(match, Number(index), replacements));
}

function replacementHTML(match: string, index: number, replacements: readonly MathReplacement[]): string {
  return replacements.find(replacement => replacement.index === index)?.html ?? match;
}

function mathPlaceholderPattern(nonce: string): RegExp {
  return new RegExp(`<span ${mathPlaceholderAttribute}="${escapeRegExp(nonce)}-(\\d+)"></span>`, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isInsideRawCodeHTML(tokens: readonly Token[]): boolean {
  let depth = 0;
  tokens.forEach(token => {
    if (token.type !== 'html_inline' || !rawCodeTagPattern.test(token.content)) {
      return;
    }

    if (rawCodeClosePattern.test(token.content)) {
      depth = Math.max(0, depth - 1);
      return;
    }

    depth += 1;
  });

  return depth > 0;
}

function findClosingInlineMath(value: string, start: number, end: number): number {
  let position = start;
  while (position < end) {
    if (value[position] === '$' && value[position + 1] !== '$' && !isEscaped(value, position)) {
      return isValidInlineMathClose(value, position) ? position : -1;
    }

    position += 1;
  }

  return -1;
}

function isValidInlineMathContent(value: string): boolean {
  if (value.includes('`') || value.includes('\n') || value.includes('\r') || containsUnescaped(value, '$')) {
    return false;
  }

  return !isDecimalDigit(value[0]) || /[A-Za-z\\^_{}=+\-*/]/.test(value);
}

function containsUnescaped(value: string, character: string): boolean {
  let position = 0;
  while (position < value.length) {
    if (value[position] === character && !isEscaped(value, position)) {
      return true;
    }

    position += 1;
  }

  return false;
}

function findClosingDelimiter(value: string, delimiter: string, start: number, end: number): number {
  let position = start;
  while (position < end) {
    if (value.startsWith(delimiter, position) && !isEscaped(value, position)) {
      return position;
    }

    position += 1;
  }

  return -1;
}

function isValidInlineMathOpen(value: string, position: number): boolean {
  if (isEscaped(value, position) || position + 1 >= value.length) {
    return false;
  }

  const previous = position > 0 ? value[position - 1] : '';
  const next = value[position + 1];
  return !isDecimalDigit(previous) && next !== '$' && !isWhitespace(next);
}

function isValidInlineMathClose(value: string, position: number): boolean {
  if (isEscaped(value, position) || position === 0) {
    return false;
  }

  const previous = value[position - 1];
  const next = position + 1 < value.length ? value[position + 1] : '';
  return !isWhitespace(previous) && !isDecimalDigit(next);
}

function isEscaped(value: string, position: number): boolean {
  let backslashCount = 0;
  let index = position - 1;
  while (value[index] === '\\') {
    backslashCount += 1;
    index -= 1;
  }

  return backslashCount % 2 === 1;
}

function isBlank(value: string): boolean {
  return value.trim() === '';
}

function isWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function isDecimalDigit(value: string): boolean {
  return value >= '0' && value <= '9';
}

function isAllowedMarkdownResource(value: string): boolean {
  return isAllowedLink(value) || isAllowedImage(value);
}

function isAllowedLink(value: string): boolean {
  if (isLocalReference(value)) {
    return true;
  }

  const scheme = schemeOf(value);
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel' || scheme === 'file';
}

function isAllowedImage(value: string): boolean {
  if (isLocalReference(value)) {
    return true;
  }

  const normalized = normalizeUri(value);
  const scheme = schemeOf(normalized);
  return scheme === 'https' || scheme === 'file' || dataImagePattern.test(normalized);
}

function isLocalReference(value: string): boolean {
  const normalized = normalizeUri(value);
  if (normalized === '' || normalized.startsWith('//')) {
    return false;
  }

  return schemeOf(normalized) === undefined;
}

function schemeOf(value: string): string | undefined {
  return normalizeUri(value).match(schemePattern)?.[0].slice(0, -1).toLowerCase();
}

function normalizeUri(value: string): string {
  return value.trim().replace(controlOrWhitespace, '');
}
