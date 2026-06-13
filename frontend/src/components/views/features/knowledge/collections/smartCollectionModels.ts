/** System-defined smart collection identifiers — not user-editable */
export type SmartCollectionId =
  | 'recent'
  | 'orphan'
  | 'untagged'
  | 'highly-connected'
  | 'with-backlinks'
  | 'with-mentions'
  | 'research-sources'
  | 'research-literature'
  | 'research-permanent'
  | 'exam-study-notes'
  | 'exam-weak-topics'
  | 'exam-review-notes'
  | 'exam-prep'
  | 'map-concepts'
  | 'academic-study-projects'
  | 'academic-active-projects'
  | 'academic-completed-projects'
  | 'academic-milestones'
  | 'subject-japanese-history'
  | 'subject-politics'
  | 'subject-economics'
  | 'subject-toefl'
  | 'subject-vocabulary';

/** Lightweight system collection definition — does not store note ids */
export interface SmartCollection {
  id: SmartCollectionId;
  name: string;
  description: string;
}
