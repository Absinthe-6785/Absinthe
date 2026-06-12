/** Read-only discovery projection — not persisted */
export interface AreaHubSuggestion {
  noteId: string;
  title: string;
  referenceCount: number;
}

export interface AreaClusterSuggestion {
  noteIds: readonly string[];
  titles: readonly string[];
}

export interface AreaDiscoveryProjection {
  potentialHubs: AreaHubSuggestion[];
  recurringConnections: AreaClusterSuggestion[];
}

export const MIN_HUB_REFERENCES = 3;
export const MIN_CLUSTER_SIZE = 3;
export const MAX_DISCOVERY_HUBS = 10;
export const MAX_DISCOVERY_CLUSTERS = 10;
