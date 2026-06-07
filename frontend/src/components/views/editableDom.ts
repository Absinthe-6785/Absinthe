/**
 * contentEditable plain-text offset helpers.
 * Treats <br> and newline characters in text nodes as single \n code units.
 */

export function nodePlainLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').length;
  if (node.nodeName === 'BR') return 1;
  let len = 0;
  for (const child of node.childNodes) len += nodePlainLength(child);
  return len;
}

/** DOM subtree → markdown/plain string (trailing browser newline stripped). */
export function domToPlainText(el: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? '';
    else if (node.nodeName === 'BR') out += '\n';
    else for (const child of node.childNodes) walk(child);
  };
  for (const child of el.childNodes) walk(child);
  return out.replace(/\n$/, '');
}

function offsetAtPoint(root: HTMLElement, container: Node, nodeOffset: number): number {
  if (!root.contains(container)) return 0;

  if (container === root) {
    let offset = 0;
    for (let i = 0; i < nodeOffset; i++) {
      offset += nodePlainLength(root.childNodes[i]);
    }
    return offset;
  }

  let offset = 0;
  let found = false;

  const walk = (node: Node): boolean => {
    if (found) return true;

    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += nodeOffset;
      } else {
        for (let i = 0; i < nodeOffset; i++) {
          offset += nodePlainLength(node.childNodes[i]);
        }
      }
      found = true;
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent ?? '').length;
    } else if (node.nodeName === 'BR') {
      offset += 1;
    } else {
      for (const child of node.childNodes) {
        if (walk(child)) return true;
      }
    }
    return false;
  };

  for (const child of root.childNodes) {
    if (walk(child)) break;
  }
  return offset;
}

export function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  return offsetAtPoint(el, range.startContainer, range.startOffset);
}

export function getSelectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const start = offsetAtPoint(el, range.startContainer, range.startOffset);
  const end = offsetAtPoint(el, range.endContainer, range.endOffset);
  return start === end ? null : { start, end };
}

export function setCaretOffset(el: HTMLElement, offset: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  let remaining = Math.max(0, offset);
  let placed = false;

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        return true;
      }
      remaining -= len;
    } else if (node.nodeName === 'BR') {
      const parent = node.parentNode ?? el;
      const idx = Array.from(parent.childNodes).indexOf(node);
      if (remaining === 0) {
        range.setStart(parent, idx);
        range.collapse(true);
        placed = true;
        return true;
      }
      if (remaining === 1) {
        range.setStart(parent, idx + 1);
        range.collapse(true);
        placed = true;
        return true;
      }
      remaining -= 1;
    } else {
      for (const child of node.childNodes) {
        if (walk(child)) return true;
      }
    }
    return false;
  };

  for (const child of el.childNodes) {
    if (walk(child)) break;
  }

  if (!placed) {
    range.selectNodeContents(el);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

function resolveTextOffset(el: HTMLElement, offset: number): { node: Node; offset: number } | null {
  let remaining = Math.max(0, offset);

  const walk = (node: Node): { node: Node; offset: number } | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) return { node, offset: remaining };
      remaining -= len;
      return null;
    }
    if (node.nodeName === 'BR') {
      const parent = node.parentNode ?? el;
      const idx = Array.from(parent.childNodes).indexOf(node);
      if (remaining === 0) return { node: parent, offset: idx };
      if (remaining === 1) return { node: parent, offset: idx + 1 };
      remaining -= 1;
      return null;
    }
    for (const child of node.childNodes) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };

  for (const child of el.childNodes) {
    const hit = walk(child);
    if (hit) return hit;
  }
  return null;
}

export function setSelectionOffsets(el: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const s = resolveTextOffset(el, start);
  const e = resolveTextOffset(el, end);
  if (!s || !e) {
    setCaretOffset(el, end);
    return;
  }
  const range = document.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Insert newline at caret; returns updated plain text and caret position. */
export function insertNewlineAtCaret(el: HTMLElement, text: string, offset: number): { text: string; caret: number } {
  const caret = Math.max(0, Math.min(offset, text.length));
  const next = text.slice(0, caret) + '\n' + text.slice(caret);
  return { text: next, caret: caret + 1 };
}

/** Delete one char before caret; returns null if nothing to delete. */
export function deleteBeforeCaret(text: string, offset: number): { text: string; caret: number } | null {
  if (offset <= 0) return null;
  return { text: text.slice(0, offset - 1) + text.slice(offset), caret: offset - 1 };
}
