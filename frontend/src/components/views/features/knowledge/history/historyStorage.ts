import type { KnowledgeHistoryEvent } from './eventTypes';

export const KNOWLEDGE_HISTORY_STORAGE_KEY = 'absinthe:knowledge-history:v1';
export const MAX_HISTORY_EVENTS = 5000;
export const HISTORY_SCHEMA_VERSION = 1;

export interface KnowledgeHistoryPayload {
  version: number;
  events: KnowledgeHistoryEvent[];
}

const EMPTY_PAYLOAD: KnowledgeHistoryPayload = {
  version: HISTORY_SCHEMA_VERSION,
  events: [],
};

const historyListeners = new Set<() => void>();

export function subscribeKnowledgeHistory(listener: () => void): () => void {
  historyListeners.add(listener);
  return () => historyListeners.delete(listener);
}

function notifyHistoryListeners(): void {
  for (const listener of historyListeners) listener();
}

function hasLocalStorage(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis;
}

function isValidEvent(value: unknown): value is KnowledgeHistoryEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<KnowledgeHistoryEvent>;
  return (
    typeof event.id === 'string'
    && typeof event.type === 'string'
    && typeof event.timestamp === 'number'
    && typeof event.noteId === 'string'
  );
}

function normalizePayload(raw: unknown): KnowledgeHistoryPayload {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PAYLOAD };
  const parsed = raw as Partial<KnowledgeHistoryPayload>;
  const events = Array.isArray(parsed.events)
    ? parsed.events.filter(isValidEvent)
    : [];
  return {
    version: typeof parsed.version === 'number' ? parsed.version : HISTORY_SCHEMA_VERSION,
    events: trimEvents(events),
  };
}

export function trimEvents(events: readonly KnowledgeHistoryEvent[]): KnowledgeHistoryEvent[] {
  if (events.length <= MAX_HISTORY_EVENTS) return [...events];
  return events.slice(events.length - MAX_HISTORY_EVENTS);
}

export function loadKnowledgeHistoryPayload(): KnowledgeHistoryPayload {
  if (!hasLocalStorage()) return { ...EMPTY_PAYLOAD };
  try {
    const raw = globalThis.localStorage.getItem(KNOWLEDGE_HISTORY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_PAYLOAD };
    return normalizePayload(JSON.parse(raw));
  } catch {
    return { ...EMPTY_PAYLOAD };
  }
}

export function loadKnowledgeHistoryEvents(): KnowledgeHistoryEvent[] {
  return loadKnowledgeHistoryPayload().events;
}

export function saveKnowledgeHistoryEvents(events: readonly KnowledgeHistoryEvent[]): void {
  if (!hasLocalStorage()) return;
  const payload: KnowledgeHistoryPayload = {
    version: HISTORY_SCHEMA_VERSION,
    events: trimEvents(events),
  };
  try {
    globalThis.localStorage.setItem(KNOWLEDGE_HISTORY_STORAGE_KEY, JSON.stringify(payload));
    notifyHistoryListeners();
  } catch {
    // Storage full or unavailable — drop oldest half and retry once.
    try {
      const trimmed = trimEvents(events).slice(-Math.floor(MAX_HISTORY_EVENTS / 2));
      globalThis.localStorage.setItem(
        KNOWLEDGE_HISTORY_STORAGE_KEY,
        JSON.stringify({ version: HISTORY_SCHEMA_VERSION, events: trimmed }),
      );
      notifyHistoryListeners();
    } catch {
      // Ignore — history is best-effort.
    }
  }
}

export function appendKnowledgeHistoryEvent(event: KnowledgeHistoryEvent): void {
  const events = loadKnowledgeHistoryEvents();
  events.push(event);
  saveKnowledgeHistoryEvents(events);
}

export function clearKnowledgeHistory(): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.removeItem(KNOWLEDGE_HISTORY_STORAGE_KEY);
    notifyHistoryListeners();
  } catch {
    // Ignore.
  }
}
