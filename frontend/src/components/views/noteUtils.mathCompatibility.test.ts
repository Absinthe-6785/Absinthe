import { describe, expect, it } from 'vitest';

import { parseMarkdown } from './noteUtils';

describe('Notes math Markdown rendering compatibility', () => {
  it('renders the supplied Korean bracket-delimited elasticity expression as display math', () => {
    const source = String.raw`\[
\varepsilon=
\left|
\frac{\text{수요량 변화율}}{\text{가격 변화율}}
\right|
\]`;

    const html = parseMarkdown(source, []);

    expect(html).toContain('class="bmathb"');
    expect(html).toContain('class="katex"');
    expect(html).toContain('수요량 변화율');
    expect(html).toContain('가격 변화율');
    expect(html).not.toContain('katex-error');
  });

  it('keeps bracket-looking text inside a fenced code block as code', () => {
    const source = ['```latex', String.raw`\[x^2\]`, '```'].join('\n');
    const html = parseMarkdown(source, []);

    expect(html).toContain('<pre class="bpre"><code class="blang-latex">');
    expect(html).toContain(String.raw`\[x^2\]`);
    expect(html).not.toContain('class="bmathb"');
  });

  it('keeps bracket-looking text inside an inline code span as code', () => {
    const source = String.raw`Literal ` + '`' + String.raw`\[x^2\]` + '`';
    const html = parseMarkdown(source, []);

    expect(html).toContain('<code class="bcode">');
    expect(html).toContain(String.raw`\[x^2\]`);
    expect(html).not.toContain('class="bmathb"');
  });

  it('does not pair display math across a fenced-code boundary', () => {
    const source = ['\\[', 'before', '```latex', String.raw`\]`, '```', 'after', String.raw`\]`].join('\n');
    const html = parseMarkdown(source, []);

    expect(html).toContain('<pre class="bpre"><code class="blang-latex">');
    expect(html).toContain(String.raw`\]`);
    expect(html).not.toContain('class="bmathb"');
  });
});
