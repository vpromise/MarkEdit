import { LanguageDescription, LanguageSupport, StreamLanguage, StreamParser } from '@codemirror/language';

/**
 * Common code languages shipped locally, without requiring an installed script.
 */
export function bundledLanguages(html: LanguageSupport) {
  return [
    LanguageDescription.of({
      name: 'HTML',
      alias: ['xhtml'],
      extensions: ['html', 'htm', 'handlebars', 'hbs'],
      support: html,
    }),
    LanguageDescription.of({
      name: 'Markdown',
      extensions: ['md', 'markdown', 'mkd'],
      load: async () => (await import('@codemirror/lang-markdown')).markdown(),
    }),
    legacyLanguage('JavaScript', ['js', 'jsx'], async () => (await import('@codemirror/legacy-modes/mode/javascript')).javascript),
    legacyLanguage('TypeScript', ['ts', 'tsx'], async () => (await import('@codemirror/legacy-modes/mode/javascript')).typescript),
    legacyLanguage('JSON', ['jsonc'], async () => (await import('@codemirror/legacy-modes/mode/javascript')).json),
    legacyLanguage('Python', ['py'], async () => (await import('@codemirror/legacy-modes/mode/python')).python),
    legacyLanguage('Shell', ['sh', 'bash', 'zsh', 'shell'], async () => (await import('@codemirror/legacy-modes/mode/shell')).shell),
    legacyLanguage('Swift', [], async () => (await import('@codemirror/legacy-modes/mode/swift')).swift),
    legacyLanguage('Go', ['golang'], async () => (await import('@codemirror/legacy-modes/mode/go')).go),
    legacyLanguage('Rust', ['rs'], async () => (await import('@codemirror/legacy-modes/mode/rust')).rust),
    legacyLanguage('C', ['c'], async () => (await import('@codemirror/legacy-modes/mode/clike')).c),
    legacyLanguage('C++', ['cpp', 'c++'], async () => (await import('@codemirror/legacy-modes/mode/clike')).cpp),
    legacyLanguage('Java', [], async () => (await import('@codemirror/legacy-modes/mode/clike')).java),
    legacyLanguage('CSS', [], async () => (await import('@codemirror/legacy-modes/mode/css')).css),
    legacyLanguage('YAML', ['yml'], async () => (await import('@codemirror/legacy-modes/mode/yaml')).yaml),
    legacyLanguage('SQL', [], async () => (await import('@codemirror/legacy-modes/mode/sql')).standardSQL),
  ];
}

function legacyLanguage(name: string, alias: string[], load: () => Promise<StreamParser<unknown>>) {
  return LanguageDescription.of({
    name,
    alias,
    load: async () => new LanguageSupport(StreamLanguage.define(await load())),
  });
}
