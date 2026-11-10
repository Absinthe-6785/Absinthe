// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { shouldHandleCosmosGraphKeyboardEvent } from './cosmosGraphKeyboard';

function keyEvent(target: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('Cosmos graph-wide keyboard scope', () => {
  it('does not consume search input keys while a graph preview is active', () => {
    const input = document.createElement('input');
    for (const key of ['Enter', 'ArrowLeft', 'ArrowDown', 'Escape'])
      expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(input, key))).toBe(false);
  });

  it('leaves toolbar and preview-panel buttons and links to native controls', () => {
    const button = document.createElement('button');
    const link = document.createElement('a');
    link.href = '#note';
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(button, 'Enter'))).toBe(false);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(button, 'Escape'))).toBe(false);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(link, 'Enter'))).toBe(false);
  });

  it('leaves graph-node activation to the node handler but permits graph arrows and dismissal', () => {
    const surface = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    surface.dataset.cosmosGraphSurface = 'true';
    const node = document.createElement('g');
    node.setAttribute('role', 'button');
    node.dataset.cosmosGraphNode = 'true';
    surface.appendChild(node);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(node, 'Enter'))).toBe(false);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(node, ' '))).toBe(false);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(node, 'ArrowRight'))).toBe(true);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(node, 'Escape'))).toBe(true);
  });

  it('ignores IME and already-prevented events while preserving background navigation', () => {
    const background = document.createElement('svg');
    background.dataset.cosmosGraphSurface = 'true';
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(background, 'ArrowUp'))).toBe(true);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(background, 'Enter', { isComposing: true }))).toBe(false);
    const prevented = keyEvent(background, 'Enter');
    prevented.preventDefault();
    expect(shouldHandleCosmosGraphKeyboardEvent(prevented)).toBe(false);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(document.body, 'Enter'))).toBe(false);
    expect(shouldHandleCosmosGraphKeyboardEvent(keyEvent(document.createElement('div'), 'Enter'))).toBe(false);
    const documentEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(documentEvent);
    expect(shouldHandleCosmosGraphKeyboardEvent(documentEvent)).toBe(false);
  });
});
