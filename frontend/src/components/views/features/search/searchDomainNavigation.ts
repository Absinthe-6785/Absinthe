/** K-113 — Deep navigation handlers for non-note search domains. */

export interface SearchDomainHandlers {
  onOpenPlannerItem?: (itemId: string, kind: string) => void;
  onSelectRecipe?: (recipeId: string) => void;
  onOpenHealthDay?: (dateLabel: string) => void;
}

const handlerSets = new Map<symbol, SearchDomainHandlers>();

function mergedHandlers(): SearchDomainHandlers {
  const out: SearchDomainHandlers = {};
  for (const handlers of handlerSets.values()) {
    if (handlers.onOpenPlannerItem) out.onOpenPlannerItem = handlers.onOpenPlannerItem;
    if (handlers.onSelectRecipe) out.onSelectRecipe = handlers.onSelectRecipe;
    if (handlers.onOpenHealthDay) out.onOpenHealthDay = handlers.onOpenHealthDay;
  }
  return out;
}

export function registerSearchDomainHandlers(handlers: SearchDomainHandlers): () => void {
  const key = Symbol('search-domain-handlers');
  handlerSets.set(key, handlers);
  return () => {
    handlerSets.delete(key);
  };
}

export function getSearchDomainHandlers(): SearchDomainHandlers {
  return mergedHandlers();
}

export function peekSearchDomainHandlers(): SearchDomainHandlers {
  return mergedHandlers();
}

export function clearSearchDomainHandlersForTest(): void {
  handlerSets.clear();
}
