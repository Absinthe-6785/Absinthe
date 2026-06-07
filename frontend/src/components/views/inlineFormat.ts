/** 단일 `*`가 `**`/`***`의 일부가 아닌지 확인 */
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

type EmphasisWrap = 'none' | 'italic' | 'bold' | 'boldItalic';

function getEmphasisWrap(text: string, start: number, end: number): EmphasisWrap {
  if (
    start >= 3 && end + 3 <= text.length
    && text.slice(start - 3, start) === '***'
    && text.slice(end, end + 3) === '***'
  ) return 'boldItalic';
  if (hasOpeningMarker(text, start, '**') && hasClosingMarker(text, end, '**')) return 'bold';
  if (hasOpeningMarker(text, start, '*') && hasClosingMarker(text, end, '*')) return 'italic';
  return 'none';
}

function spliceWrap(
  text: string,
  start: number,
  end: number,
  openLen: number,
  closeLen: number,
  inner: string,
  open: string,
  close: string,
): { text: string; caret: number; selStart: number; selEnd: number } {
  const selStart = start - openLen + open.length;
  const selEnd = selStart + inner.length;
  const next = text.slice(0, start - openLen) + open + inner + close + text.slice(end + closeLen);
  return { text: next, caret: selEnd, selStart, selEnd };
}

/** 마커 스캔 — split 지점까지 열린 bold/italic 상태 */
export function scanEmphasisState(text: string, upto: number): { bold: boolean; italic: boolean } {
  let bold = false;
  let italic = false;
  let i = 0;
  while (i < upto && i < text.length) {
    if (text.slice(i, i + 3) === '***') {
      if (bold && italic) { bold = false; italic = false; }
      else { bold = true; italic = true; }
      i += 3;
      continue;
    }
    if (text.slice(i, i + 2) === '**') {
      bold = !bold;
      i += 2;
      continue;
    }
    if (text[i] === '*') {
      italic = !italic;
      i += 1;
      continue;
    }
    i += 1;
  }
  return { bold, italic };
}

/** Enter 분리 시 열린 인라인 마커를 닫고 다음 블록에 다시 연다 */
export function splitMarkdownAt(text: string, offset: number): { before: string; after: string } {
  let before = text.slice(0, offset);
  let after = text.slice(offset);

  // 공백은 마커 밖으로 밀어 **EJU** | **일본사** 형태 유지
  const trailing = before.match(/[ \t]+$/u)?.[0] ?? '';
  if (trailing) {
    before = before.slice(0, before.length - trailing.length);
    after = trailing + after;
  }

  const leading = after.match(/^[ \t]+/u)?.[0] ?? '';
  if (leading) after = after.slice(leading.length);

  const state = scanEmphasisState(before, before.length);
  let b = before;
  let a = after;
  if (state.bold) {
    b += '**';
    a = '**' + a;
  }
  if (state.italic) {
    b += '*';
    a = '*' + a;
  }
  if (leading) b += leading;
  return { before: b, after: a };
}

/** 선택 구간이 해당 인라인 마크다운으로 감싸져 있는지 */
export function selectionHasFormat(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
): boolean {
  if (before === '**') {
    const wrap = getEmphasisWrap(text, start, end);
    return wrap === 'bold' || wrap === 'boldItalic';
  }
  if (before === '*') {
    const wrap = getEmphasisWrap(text, start, end);
    return wrap === 'italic' || wrap === 'boldItalic';
  }
  if (hasOpeningMarker(text, start, before) && hasClosingMarker(text, end, after)) return true;
  const selected = text.slice(start, end);
  const bLen = before.length;
  const aLen = after.length;
  return (
    selected.length >= bLen + aLen
    && selected.startsWith(before)
    && selected.endsWith(after)
    && hasOpeningMarker(selected, bLen, before)
    && hasClosingMarker(selected, selected.length - aLen, after)
  );
}

export type ToggleResult = { text: string; caret: number; selStart: number; selEnd: number };

/** 굵게 토글 — ** / *** 중첩 처리 */
export function toggleBold(
  text: string,
  start: number,
  end: number,
): ToggleResult {
  const inner = text.slice(start, end);
  const wrap = getEmphasisWrap(text, start, end);
  switch (wrap) {
    case 'boldItalic':
      return spliceWrap(text, start, end, 3, 3, inner, '*', '*');
    case 'bold':
      return spliceWrap(text, start, end, 2, 2, inner, '', '');
    case 'italic':
      return spliceWrap(text, start, end, 1, 1, inner, '***', '***');
    default:
      return spliceWrap(text, start, end, 0, 0, inner, '**', '**');
  }
}

/** 기울임 토글 — * / *** 중첩 처리 */
export function toggleItalic(
  text: string,
  start: number,
  end: number,
): ToggleResult {
  const inner = text.slice(start, end);
  const wrap = getEmphasisWrap(text, start, end);
  switch (wrap) {
    case 'boldItalic':
      return spliceWrap(text, start, end, 3, 3, inner, '**', '**');
    case 'italic':
      return spliceWrap(text, start, end, 1, 1, inner, '', '');
    case 'bold':
      return spliceWrap(text, start, end, 2, 2, inner, '***', '***');
    default:
      return spliceWrap(text, start, end, 0, 0, inner, '*', '*');
  }
}

/** 선택 구간에 인라인 마크다운을 적용하거나 해제 */
export function toggleMarkdownWrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
): ToggleResult {
  if (before === '**' && after === '**') return toggleBold(text, start, end);
  if (before === '*' && after === '*') return toggleItalic(text, start, end);

  const bLen = before.length;
  const aLen = after.length;

  if (hasOpeningMarker(text, start, before) && hasClosingMarker(text, end, after)) {
    const inner = text.slice(start, end);
    const selStart = start - bLen;
    const next = text.slice(0, selStart) + inner + text.slice(end + aLen);
    return { text: next, caret: selStart + inner.length, selStart, selEnd: selStart + inner.length };
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
    return { text: next, caret: start + inner.length, selStart: start, selEnd: start + inner.length };
  }

  const wrapped = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
  const selStart = start + bLen;
  const selEnd = selStart + (end - start);
  return { text: wrapped, caret: selEnd, selStart, selEnd };
}
