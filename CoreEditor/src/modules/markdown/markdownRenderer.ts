import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import type { Config as DOMPurifyConfig } from 'dompurify';

const controlOrWhitespace = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}\\s]+`, 'g');
const schemePattern = /^[a-z][a-z0-9+.-]*:/i;
const dataImagePattern = /^data:image\/(?:gif|png|jpe?g|webp|avif);/i;

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

markdown.validateLink = value => isAllowedMarkdownResource(value);

const sanitizeConfig: DOMPurifyConfig = {
  ADD_DATA_URI_TAGS: ['img'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style', 'srcset'],
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
  return DOMPurify.sanitize(markdown.render(markdownText), sanitizeConfig);
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
