import type { SmartCollection, SmartCollectionId } from './smartCollectionModels';

/** Phase 1 system-defined smart collections — Korean display names */
export const SMART_COLLECTIONS: readonly SmartCollection[] = [
  {
    id: 'recent',
    name: '최근 노트',
    description: '최근 수정 순으로 정렬된 모든 노트.',
  },
  {
    id: 'orphan',
    name: '고립 노트',
    description: '위키 백링크와 멘션이 없는 노트.',
  },
  {
    id: 'untagged',
    name: '태그 없음',
    description: '태그가 없는 노트.',
  },
  {
    id: 'highly-connected',
    name: '높은 연결',
    description: '백링크·멘션·관련 노트 연결이 많은 노트.',
  },
  {
    id: 'with-backlinks',
    name: '백링크 있음',
    description: '들어오거나 나가는 위키 링크가 있는 노트.',
  },
  {
    id: 'with-mentions',
    name: '멘션 있음',
    description: '링크되지 않은 멘션이 있는 노트.',
  },
  {
    id: 'research-sources',
    name: '출처',
    description: '출처 자료로 분류된 노트 (noteKind: source).',
  },
  {
    id: 'research-literature',
    name: '문헌 노트',
    description: '처리된 문헌 노트 (noteKind: literature).',
  },
  {
    id: 'research-permanent',
    name: '영구 노트',
    description: '영구 지식 노트 (noteKind: permanent).',
  },
  {
    id: 'exam-study-notes',
    name: '학습 노트',
    description: '구조화된 학습 노트 (#study 태그).',
  },
  {
    id: 'exam-weak-topics',
    name: '약점 주제',
    description: '추가 복습이 필요한 노트.',
  },
  {
    id: 'exam-review-notes',
    name: '복습 노트',
    description: '복습 태그 또는 질문 블록이 있는 노트.',
  },
  {
    id: 'exam-prep',
    name: '시험 준비',
    description: '시험 준비 태그 (#exam-prep).',
  },
  {
    id: 'map-concepts',
    name: '개념 노트',
    description: '개념으로 분류된 노트 (noteKind: concept).',
  },
  {
    id: 'academic-study-projects',
    name: '학습 프로젝트',
    description: '장기 학습 프로젝트 컨테이너 (studyProject: yes).',
  },
  {
    id: 'academic-active-projects',
    name: '진행 프로젝트',
    description: '진행 중인 학습 프로젝트.',
  },
  {
    id: 'academic-completed-projects',
    name: '완료 프로젝트',
    description: '완료된 학습 프로젝트.',
  },
  {
    id: 'academic-milestones',
    name: '마일스톤',
    description: '프로젝트 마일스톤 (projectMilestone: yes).',
  },
  {
    id: 'subject-japanese-history',
    name: '일본사 작업공간',
    description: '#japanese-history 태그 노트.',
  },
  {
    id: 'subject-politics',
    name: '정치 작업공간',
    description: '#politics 태그 노트.',
  },
  {
    id: 'subject-economics',
    name: '경제 작업공간',
    description: '#economics 태그 노트.',
  },
  {
    id: 'subject-toefl',
    name: 'TOEFL 작업공간',
    description: '#toefl 태그 노트.',
  },
  {
    id: 'subject-vocabulary',
    name: '어휘 작업공간',
    description: '#vocabulary 태그 노트.',
  },
];

export function findSmartCollection(id: string): SmartCollection | undefined {
  return SMART_COLLECTIONS.find(collection => collection.id === id);
}

export function isSmartCollectionId(id: string): id is SmartCollectionId {
  return SMART_COLLECTIONS.some(collection => collection.id === id);
}

/** Activate a smart collection — returns its id for sidebar state */
export function activateSmartCollection(collection: SmartCollection): SmartCollectionId {
  return collection.id;
}
