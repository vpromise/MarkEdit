import { describe, expect, test } from '@jest/globals';
import { renderMarkdown } from '../src/@light/markdownRenderer';

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
});
