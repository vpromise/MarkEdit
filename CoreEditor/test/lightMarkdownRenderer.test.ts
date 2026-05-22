import { describe, expect, test } from '@jest/globals';
import { renderMarkdown } from '../src/modules/markdown/markdownRenderer';

describe('Light Markdown renderer', () => {
  test('renders headings and paragraphs', () => {
    const html = renderMarkdown('# Title\n\nHello **MarkEdit**.');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Hello <strong>MarkEdit</strong>.</p>');
  });

  test('renders inline and fenced code', () => {
    const html = renderMarkdown('Use `code`.\n\n```swift\nlet value = 1\n```');

    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<pre><code class="language-swift">let value = 1\n</code></pre>');
  });

  test('renders tables', () => {
    const html = renderMarkdown('| Name | Value |\n| --- | --- |\n| A | 1 |');

    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>1</td>');
  });

  test('renders inline and display math', () => {
    const html = renderMarkdown('Inline $x^2$ math.\n\n$$\n\\int_0^1 x^2 dx\n$$');

    expect(html).toContain('<span class="katex">');
    expect(html).toContain('<span class="katex-display">');
    expect(html).toContain('application/x-tex">x^2</annotation>');
    expect(html).toContain('application/x-tex">\\int_0^1 x^2 dx</annotation>');
  });

  test('renders bracket math', () => {
    const html = renderMarkdown('Inline \\(a+b\\).\n\n\\[c+d\\]');

    expect(html).toContain('application/x-tex">a+b</annotation>');
    expect(html).toContain('application/x-tex">c+d</annotation>');
    expect(html).toContain('<span class="katex-display">');
  });

  test('keeps invalid math non-fatal', () => {
    expect(() => renderMarkdown('Invalid $\\notacommand{ math.')).not.toThrow();

    const html = renderMarkdown('Invalid $\\notacommand$ math.');
    expect(html).toContain('mathcolor="#cc0000"');
    expect(html).toContain('\\notacommand');
  });

  test('does not render code or dollar amounts as math', () => {
    const html = renderMarkdown('Cost is $5 and $10. Use `$x^2$`.\n\n```tex\n$x^2$\n```');

    expect(html).toContain('Cost is $5 and $10.');
    expect(html).toContain('<code>$x^2$</code>');
    expect(html).toContain('<pre><code class="language-tex">$x^2$\n</code></pre>');
  });

  test('does not render math inside link or image destinations', () => {
    const html = renderMarkdown('[schema](docs/$schema$.md) ![Local](assets/$name$.png)');

    expect(html).toContain('<a href="docs/$schema$.md">schema</a>');
    expect(html).toContain('<img src="assets/$name$.png" alt="Local">');
    expect(html).not.toContain('application/x-tex">schema</annotation>');
    expect(html).not.toContain('application/x-tex">name</annotation>');
  });

  test('does not render math inside raw HTML attributes', () => {
    const html = renderMarkdown('<span title="$x$">ok</span> <img alt="$x$" src="https://example.com/a.png">');

    expect(html).toContain('<span title="$x$">ok</span>');
    expect(html).toContain('alt="$x$"');
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).not.toContain('application/x-tex">x</annotation>');
  });

  test('does not render indented or raw HTML code as math', () => {
    const html = renderMarkdown('    $x^2$\n\n<code>$x^2$</code>');

    expect(html).toContain('<pre><code>$x^2$\n</code></pre>');
    expect(html).toContain('<code>$x^2$</code>');
    expect(html).not.toContain('class="katex"');
  });

  test('follows Markdown fence rules before parsing math', () => {
    const html = renderMarkdown('   ```tex\n$x^2$\n   ```\n\n```tex\n$x^2$');

    expect(html.match(/<pre><code class="language-tex">\$x\^2\$\n?<\/code><\/pre>/g)).toHaveLength(2);
    expect(html).not.toContain('class="katex"');
  });

  test('does not close fenced code on trailing text', () => {
    const html = renderMarkdown('```\ncode\n```not a close\n$x$\n```');

    expect(html).toContain('<pre><code>code\n```not a close\n$x$\n</code></pre>');
    expect(html).not.toContain('class="katex"');
  });

  test('renders inline math that starts with a digit', () => {
    const html = renderMarkdown('Inline $2x+1$ math.');

    expect(html).toContain('<span class="katex">');
    expect(html).toContain('application/x-tex">2x+1</annotation>');
  });

  test('does not replace user-authored math placeholder attributes', () => {
    const html = renderMarkdown('<span data-markedit-math="0"></span> and $x$');

    expect(html).toContain('<span data-markedit-math="0"></span>');
    expect(html.match(/application\/x-tex">x<\/annotation>/g)).toHaveLength(1);
  });

  test('renders safe inline HTML and removes executable content', () => {
    const html = renderMarkdown('<details open><summary>More</summary><strong onclick="alert(1)">Raw</strong><script>alert(1)</script></details>');

    expect(html).toContain('<details open=""><summary>More</summary><strong>Raw</strong></details>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onclick');
  });

  test('removes unsafe links', () => {
    const html = renderMarkdown('[Bad](javascript:alert(1)) [Good](https://example.com)');

    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('[Bad](javascript:alert(1))');
    expect(html).toContain('<a href="https://example.com">Good</a>');
  });

  test('keeps anchor and relative links', () => {
    const html = renderMarkdown('[Local](docs/guide.md) [Anchor](#intro)');

    expect(html).toContain('<a href="docs/guide.md">Local</a>');
    expect(html).toContain('<a href="#intro">Anchor</a>');
  });

  test('renders local, remote, absolute, and data images', () => {
    const html = renderMarkdown([
      '![Local](assets/diagram.png)',
      '![Remote](https://example.com/diagram.png)',
      '![Absolute](file:///Users/example/diagram.png)',
      '![Data](data:image/png;base64,AAAA)',
    ].join('\n'));

    expect(html).toContain('<img src="assets/diagram.png" alt="Local">');
    expect(html).toContain('<img src="https://example.com/diagram.png" alt="Remote">');
    expect(html).toContain('<img src="file:///Users/example/diagram.png" alt="Absolute">');
    expect(html).toContain('<img src="data:image/png;base64,AAAA" alt="Data">');
  });

  test('removes executable image attributes', () => {
    const html = renderMarkdown('<img src="https://example.com/a.png" onerror="alert(1)" style="width:100%">');

    expect(html).toContain('<img src="https://example.com/a.png">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('style=');
  });

  test('does not preserve user-authored styles through math classes', () => {
    const html = renderMarkdown('<span class="katex" style="position:fixed" onclick="alert(1)">fake</span>');

    expect(html).toContain('<span class="katex">fake</span>');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('onclick');
  });
});
