# K-46 Knowledge Journey

`KnowledgeJourneyPanel.tsx` renders a vertical progression path in Timeline **Milestones**.

## Steps

Derived from K-42 `KnowledgeMilestone` list:

- First Note → First Link → First Hub → 100 Notes → 500 Links → 10 Core Hubs

Achieved steps show ✓ and link to related notes when event history provides note ids.

## Data

`buildKnowledgeJourney(milestones, events)` maps milestones to steps with `getMilestoneNoteId()` for core milestones.

## Limitations

- Scale milestones (100 notes, etc.) use timeline estimates when event history is incomplete
- No per-step date labels in v1 (milestone list below journey retains dates)
