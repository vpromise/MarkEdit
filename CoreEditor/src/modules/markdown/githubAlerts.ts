import type { PluginSimple } from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

export const githubAlerts: PluginSimple = markdown => {
  markdown.core.ruler.after('block', 'markedit_github_alerts', state => {
    state.tokens.forEach((token, index, tokens) => {
      const content = tokens[index + 2] as Token | undefined;
      const paragraph = tokens[index + 1] as Token | undefined;
      if (token.type !== 'blockquote_open' || paragraph?.type !== 'paragraph_open' || content?.type !== 'inline') {
        return;
      }

      const marker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/i.exec(content.content);
      if (marker === null) {
        return;
      }

      const kind = marker[1].toLowerCase();
      token.type = 'markedit_alert_open';
      token.tag = 'div';
      token.attrSet('class', `markdown-alert markdown-alert-${kind}`);
      token.meta = { title: kind[0].toUpperCase() + kind.slice(1) };
      content.content = content.content.slice(marker[0].length);

      const closing = tokens.slice(index + 1).find(candidate => candidate.type === 'blockquote_close' && candidate.level === token.level);
      if (closing !== undefined) {
        closing.tag = 'div';
      }
    });
  });

  markdown.renderer.rules.markedit_alert_open = (tokens, index, options, _env, renderer) => {
    const { title } = tokens[index].meta as { title: string };
    return renderer.renderToken(tokens, index, options)
      + `<p class="markdown-alert-title">${markdown.utils.escapeHtml(title)}</p>\n`;
  };
};
