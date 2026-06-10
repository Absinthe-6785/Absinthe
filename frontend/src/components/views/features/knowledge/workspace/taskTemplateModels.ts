/** Standard task property keys — conventions only, no task engine */
export const TASK_PROPERTY_KEYS = [
  'status',
  'priority',
  'dueDate',
  'estimatedHours',
  'completedAt',
] as const;

export type TaskPropertyKey = typeof TASK_PROPERTY_KEYS[number];

export interface TaskTemplateDefinition {
  id: string;
  name: string;
  description: string;
  defaultTitle: string;
  tags: readonly string[];
  properties: Readonly<Record<TaskPropertyKey, string>>;
}

export const DEFAULT_TASK_TEMPLATE_ID = 'study-task';

export const DEFAULT_TASK_STATUS = 'todo';

export const DEFAULT_TASK_PRIORITY = 'medium';
