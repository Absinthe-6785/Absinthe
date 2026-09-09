import { classifyViewportWidth, type ViewportCategory } from '@/lib/responsiveLayout';

export const PLANNER_HIERARCHY = {
  primary: ['calendar', 'timetable'],
  secondary: 'today',
  tertiary: 'dday',
  compactOrder: ['calendar', 'today', 'timetable', 'dday'],
} as const;

export interface PlannerHierarchyLayout {
  category: ViewportCategory;
  composition: 'natural-flow' | 'planning-column-support-rail';
  rootScroll: 'calendar-shell' | 'bounded-panes';
  order: typeof PLANNER_HIERARCHY.compactOrder;
}

/** UI-05 semantic layout contract derived from the shared UI-01 boundaries. */
export function resolvePlannerHierarchyLayout(width: number): PlannerHierarchyLayout {
  const category = classifyViewportWidth(width);
  const desktop = category === 'desktop' || category === 'wide';

  return {
    category,
    composition: desktop ? 'planning-column-support-rail' : 'natural-flow',
    rootScroll: desktop ? 'bounded-panes' : 'calendar-shell',
    order: PLANNER_HIERARCHY.compactOrder,
  };
}
