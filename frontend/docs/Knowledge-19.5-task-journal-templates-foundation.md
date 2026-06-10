# Knowledge-19.5 — Task & Journal Templates Pre-Implementation Report

## Scope

Complete the first-generation productivity workflow layer using ordinary notes, properties, and code-defined templates. No TaskEntity, JournalEntity, or dedicated databases.

## Foundation (K-19.0, K-19.4)

| Primitive | Role |
| --------- | ---- |
| Note + properties + tags | Single content entity |
| `createInboxNote()` | Inbox convention (`tag:inbox` + optional type tag) |
| Quick Capture | Dashboard widget → ordinary inbox notes |
| `DatabaseTemplateDefinition` | Code-defined database view factories (reuse for optional bridge) |
| `setProperty` / `addTag` | Apply task/journal semantics without new engine |

## K-19.5 design

```
TaskTemplateDefinition (in-memory registry)
  → buildTaskNote(note, template, { toInbox })
       ├─ tag:inbox (when captured / inbox workflow)
       ├─ tag:task + template tags
       └─ properties: status, priority, dueDate, estimatedHours, completedAt

JournalTemplateDefinition (in-memory registry)
  → buildJournalNote(note, template)
       ├─ pre-filled body prompts
       └─ optional tag:journal

Quick Capture (task type)
  → createInboxNote + applyTaskTemplate(default or selected template)

Dashboard Quick Actions
  ├─ New Task → template picker → createTask
  └─ New Journal → template picker → createJournal

Optional database bridge
  → handleCreateDatabaseViewFromTemplate('project-tracker' | 'reading-tracker')
```

Tasks and journals remain **ordinary notes**. `WorkspaceActivation` unchanged.

## Out of scope

Task engine, recurring tasks, reminders, notifications, calendar sync, journal analytics, review scheduling.
