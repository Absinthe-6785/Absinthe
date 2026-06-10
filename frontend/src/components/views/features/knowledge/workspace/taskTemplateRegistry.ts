import type { TaskTemplateDefinition } from './taskTemplateModels';

export const TASK_TEMPLATES: readonly TaskTemplateDefinition[] = [
  {
    id: 'study-task',
    name: 'Study Task',
    description: 'Track study work with review-friendly defaults.',
    defaultTitle: 'Study Task',
    tags: ['task', 'study'],
    properties: {
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      estimatedHours: '1',
      completedAt: '',
    },
  },
  {
    id: 'project-task',
    name: 'Project Task',
    description: 'Project deliverable with priority and due date.',
    defaultTitle: 'Project Task',
    tags: ['task', 'project'],
    properties: {
      status: 'todo',
      priority: 'high',
      dueDate: '',
      estimatedHours: '2',
      completedAt: '',
    },
  },
  {
    id: 'exam-task',
    name: 'Exam Task',
    description: 'Exam preparation task with high priority.',
    defaultTitle: 'Exam Task',
    tags: ['task', 'exam'],
    properties: {
      status: 'todo',
      priority: 'high',
      dueDate: '',
      estimatedHours: '3',
      completedAt: '',
    },
  },
  {
    id: 'review-task',
    name: 'Review Task',
    description: 'Spaced review or recap work item.',
    defaultTitle: 'Review Task',
    tags: ['task', 'review'],
    properties: {
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      estimatedHours: '1',
      completedAt: '',
    },
  },
  {
    id: 'research-task',
    name: 'Research Task',
    description: 'Research or reading follow-up task.',
    defaultTitle: 'Research Task',
    tags: ['task', 'research'],
    properties: {
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      estimatedHours: '2',
      completedAt: '',
    },
  },
];
