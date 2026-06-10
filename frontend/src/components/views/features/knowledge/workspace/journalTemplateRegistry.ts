import type { JournalTemplateDefinition } from './journalTemplateModels';

export const JOURNAL_TEMPLATES: readonly JournalTemplateDefinition[] = [
  {
    id: 'daily-review',
    name: 'Daily Review',
    description: 'Reflect on today and plan tomorrow.',
    defaultTitle: 'Daily Review',
    tags: ['daily'],
    body: `# Daily Review

## What did I learn today?



## What needs review?



## What will I do tomorrow?


`,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Summarize the week and set next-week focus.',
    defaultTitle: 'Weekly Review',
    tags: ['weekly'],
    body: `# Weekly Review

## What went well this week?



## What was challenging?



## What should I focus on next week?


`,
  },
  {
    id: 'monthly-review',
    name: 'Monthly Review',
    description: 'Monthly progress and direction check.',
    defaultTitle: 'Monthly Review',
    tags: ['monthly'],
    body: `# Monthly Review

## Major wins



## Areas to improve



## Goals for next month


`,
  },
  {
    id: 'study-reflection',
    name: 'Study Reflection',
    description: 'Capture study progress and gaps.',
    defaultTitle: 'Study Reflection',
    tags: ['study'],
    body: `# Study Reflection

## What was difficult?



## What improved?



## What remains unclear?


`,
  },
  {
    id: 'project-retrospective',
    name: 'Project Retrospective',
    description: 'Review a project cycle and next steps.',
    defaultTitle: 'Project Retrospective',
    tags: ['project'],
    body: `# Project Retrospective

## What worked?



## What did not work?



## What will we change next time?


`,
  },
];
