/** System-defined smart collection identifiers — not user-editable */
export type SmartCollectionId =
  | 'recent'
  | 'orphan'
  | 'untagged'
  | 'highly-connected'
  | 'with-backlinks'
  | 'with-mentions';

/** Lightweight system collection definition — does not store note ids */
export interface SmartCollection {
  id: SmartCollectionId;
  name: string;
  description: string;
}
