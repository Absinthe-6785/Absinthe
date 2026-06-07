/** 단일 `*`가 `**`의 일부가 아닌지 확인 */
function isSingleAsteriskMarker(text: string, index: number, role: 'open' | 'close'): boolean {
  if (text[index] !== '*') return false;
  if (role === 'open') {
    if (index > 0 && text[index - 1] === '*') return false;
    if (text[index + 1] === '*') return false;
    return true;
  }
  if (text[index + 1] === '*') return false;
  if (index > 0 && text[index - 1] === '*') return false;
  return true;
}

function hasOpeningMarker(text: string, start: number, marker: string): boolean {
  if (marker === '**') return start >= 2 && text.slice(start - 2, start) === '**';
  if (marker === '*') return start >= 1 && isSingleAsteriskMarker(text, start - 1, 'open');
  const len = marker.length;
  return start >= len && text.slice(start - len, start) === marker;
}

function hasClosingMarker(text: string, end: number, marker: string): boolean {
  if (marker === '**') return text.slice(end, end + 2) === '**';
  if (marker === '*') return end < text.length && isSingleAsteriskMarker(text, end, 'close');
  const len = marker.length;
  return text.slice(end, end + len) === marker;
}

/** 선택 구간에 인라인 마크다운을 적용하거나 해제 */
export function toggleMarkdownWrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { text: string; caret: number } {
  const bLen = before.length;
  const aLen = after.length;

  if (hasOpeningMarker(text, start, before) && hasClosingMarker(text, end, after)) {
    const inner = text.slice(start, end);
    const next = text.slice(0, start - bLen) + inner + text.slice(end + aLen);
    return { text: next, caret: start - bLen + inner.length };
  }

  const selected = text.slice(start, end);
  if (
    selected.length >= bLen + aLen
    && selected.startsWith(before)
    && selected.endsWith(after)
    && hasOpeningMarker(selected, bLen, before)
    && hasClosingMarker(selected, selected.length - aLen, after)
  ) {
    const inner = selected.slice(bLen, selected.length - aLen);
    const next = text.slice(0, start) + inner + text.slice(end);
    return { text: next, caret: start + inner.length };
  }

  const wrapped = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
  return { text: wrapped, caret: end + bLen + aLen };
}
