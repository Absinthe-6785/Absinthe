# K-49 LaTeX Parsing Rules

## Delimiters

| Form | Name | Multiline | Example |
|------|------|-----------|---------|
| `$…$` | Inline | No (stops at newline) | `$a^2+b^2=c^2$` |
| `$$…$$` | Display | Yes | `$$\frac{1}{2}$$` |
| `\$` | Escaped literal | — | `Price \$5` → `Price $5` |

**Order:** display `$$…$$` is matched before inline `$…$`.

## Inline validation

An inline span `$…$` renders as math only when:

1. Closing `$` exists on the same line (no embedded unescaped newline).
2. Inner expression is non-empty after trim.
3. Inner expression is **not currency-like**.

### Currency-like (do NOT render)

Pure numeric / money literals:

```
5, 10, 100, 1,234.56, 5.00
```

Regex: `/^[\d.,\s%]+$/`

### Examples

| Input | Result |
|-------|--------|
| `$a^2+b^2=c^2$` | ✅ Math |
| `$5$` | ❌ Plain text `$5$` |
| `$10$` | ❌ Plain text |
| `$100$` | ❌ Plain text |
| `$5` (no close) | ❌ Plain text |
| `$5 and $10` | ❌ Plain text (no valid pairs) |
| `$\frac{1}{2}$` | ✅ Math |
| `$\sin(x)$` | ✅ Math |

## Display math

`$$…$$` pairs are matched greedily by first closing `$$`. Empty `$$$$` yields empty display segment (renders nothing useful — avoid in content).

No currency guard on display math (unlikely to write `$$100$$` as money).

## Escaping

`\$` inside text emits a literal `$` and does not open math mode.

Inside inline math, `\$` is passed through to KaTeX as escaped dollar.

## MathBlock vs inline

| Feature | Paragraph `$…$` | MathBlock |
|---------|-----------------|-----------|
| Storage | In `block.content` string | `block.math` field |
| Serialization | `$expr$` or `$$expr$$` in markdown | `$$` fenced block or `$expr$` line |
| Editor UI | contentEditable chips | click → textarea |
| Renderer | shared `katexRender` | shared `katexRender` |

## Supported LaTeX (KaTeX 0.16.9)

K-49 validates common tokens in manual QA:

```
\frac  \sqrt  \sum  \int  \sin  \cos  \tan  \log
```

Full KaTeX support list: https://katex.org/docs/support_table.html

## Future extensions (K-50+, not implemented)

| Feature | Notes |
|---------|-------|
| `\begin{align}…\end{align}` | Display-only; needs ams environment support audit |
| `\begin{cases}…\end{cases}` | Piecewise functions |
| Matrices (`matrix`, `pmatrix`, …) | Already in KaTeX; may need editor UX |
| Chemical notation (`\ce{}`) | Requires mhchem extension — not in core KaTeX |
| Physics (`\qty`, bra-ket) | Likely custom macros or extension package |

See validation checklist for regression tests.
