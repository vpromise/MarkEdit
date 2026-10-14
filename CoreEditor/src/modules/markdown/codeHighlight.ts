import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

Object.entries({ bash, c, cpp, css, go, java, javascript, json, python, rust, sql, swift, typescript, xml, yaml })
  .forEach(([name, language]) => hljs.registerLanguage(name, language));

export function highlightCode(source: string, language: string): string {
  if (!hljs.getLanguage(language)) {
    return '';
  }

  try {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  } catch {
    return '';
  }
}
