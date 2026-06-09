/** User-defined collection backed by a knowledge query rule — does not store note ids */
export interface RuleCollection {
  id: string;
  name: string;
  query: string;
}
