# K-282 Notes Overview / Signal Panel Contract Fixture Spec

## Purpose

K-282 defines a deterministic contract fixture spec for a future Notes Overview / Signal Panel. K-282 follows the K-280 data contract plan and the K-281 component boundary plan.

K-282 is docs/spec plus audit test only. K-282 does not implement UI. K-282 does not add runtime fixture files. K-282 does not create runtime types/exports. K-282 does not wire runtime data. K-282 does not add route/nav/panel behavior. K-282 does not create a data adapter. K-282 does not change stores, schemas, persistence, providers, sync, graph builders, backup, or BlockEditor internals.

K-282 chooses the K-283 next path: Notes Overview / Signal Panel Isolated Component Plan.

## Current State Summary

K-278 defined Notes Overview / Signal Panel as a concept-only product surface. Signal Panel remains an orientation/readout surface, not Cosmos Map, not a graph replacement, not backup/Data Safety UI, and not Archive Voyager.

K-279 audited local-first data boundaries for a future Signal Panel MVP. K-279 approved only future local-note metadata plus simple active-note orientation as safe first boundaries.

K-280 defined a draft recent notes plus active writing data contract in docs only. K-280 did not add runtime type/export, runtime data wiring, or implementation.

K-281 defined a props-first component boundary in docs only. K-281 did not add a Signal Panel runtime component, runtime type/export, data adapter, route/nav/panel, or runtime mount.

No Signal Panel runtime component exists. No Signal Panel runtime type/export exists. No Signal Panel data adapter exists.

The Empty State line remains closed. `NotesPixelCosmosEmptyState` remains the productized empty-vault Notes/Cosmos surface, and Empty State remains primary when no notes exist.

The Static Preview line remains closed. `NotesCosmosStaticPreview` remains fixture-driven, deterministic, isolated, unwired, and not product data.

`NoteGraphView` remains the shipped full-vault graph surface. `LocalGraphView` remains the local/context graph surface. Runtime Cosmos Map is not implemented. Backup/preflight guardrails remain infrastructure and are not productized here.

## Fixture Principles

Future Signal Panel fixtures should be:

- deterministic.
- local-first.
- contract-shaped.
- plain serializable objects.
- safe for isolated component tests later.
- explicit about active, idle, unavailable, and empty/degraded states.
- bounded to recent notes plus active writing signal readout.

Future fixtures must not include:

- functions.
- React component state.
- raw store objects.
- service/client objects.
- provider/client objects.
- graph/KIS objects.
- editor instances.
- BlockEditor document models.
- raw note body/content.
- backup/preflight data.
- generated artifacts.
- real user data.
- secrets.

Fixture data must not imply runtime mounting. Fixture data must not be treated as app data.

## Proposed Fixture Contract Shape

Documentation-only sketch:

```ts
type SignalPanelRecentNoteFixture = {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  signalLabel: 'recent';
};

type SignalPanelActiveWritingFixture = {
  state: 'active' | 'idle' | 'unavailable';
  currentNoteId?: string;
  currentNoteTitle?: string;
  lastEditedAt?: string;
};

type SignalPanelDataFixture = {
  generatedFrom: 'local-note-metadata';
  recentNotes: SignalPanelRecentNoteFixture[];
  activeWriting: SignalPanelActiveWritingFixture;
  emptyState: {
    hasNotes: boolean;
    noteCount?: number;
    reason: 'empty-vault' | 'ready' | 'unavailable';
  };
};
```

Rules:

- documentation only.
- not runtime exports.
- exact field names may be finalized in a later implementation PR.
- no callbacks in fixture data.
- no store references.
- no provider references.
- no graph references.
- no backup references.
- no editor references.
- no raw note objects.

## Required Fixture Cases

### 1. Active Writing Fixture

Required shape:

- `emptyState.hasNotes` is `true`.
- `emptyState.reason` is `ready`.
- `recentNotes` contains 2-5 items.
- `activeWriting.state` is `active`.
- `currentNoteId` is present.
- `currentNoteTitle` is present and follows the display title fallback rule.
- `lastEditedAt` is present only if source-supported.
- no raw body/content.

Purpose:

- verifies the primary happy path.
- verifies current-note orientation without editor internals.
- verifies recent notes remain supporting context.

### 2. Idle Writing Fixture

Required shape:

- `emptyState.hasNotes` is `true`.
- `recentNotes` contains 2-5 items.
- `activeWriting.state` is `idle`.
- `currentNoteId` is optional.
- no keystroke/activity tracking.
- no editor internals.

Purpose:

- verifies a safe state when notes exist but no current note should be emphasized.
- avoids fake active-writing claims.

### 3. Unavailable Writing Fixture

Required shape:

- `emptyState.hasNotes` may be `true` or `false` depending on the case.
- `activeWriting.state` is `unavailable`.
- no fake current note.
- no fake timestamps.
- unavailable is valid when current editor state is not safely exposed.

Purpose:

- verifies graceful degradation.
- avoids coupling to BlockEditor internals or app activity tracking.

### 4. Empty / Degraded Fixture

Required shape:

- `emptyState.hasNotes` is `false` or `recentNotes` is empty.
- the fixture does not duplicate full Empty State onboarding.
- the fixture does not fake note signals.
- `activeWriting.state` is `unavailable` or `idle` according to the contract.
- no provider/loading implication.
- no backup/provider error implication.
- readable fallback text is expected in future component rendering.

Purpose:

- verifies component resilience.
- keeps true empty-vault onboarding owned by Empty State.

### 5. Recent Notes Cap Fixture

Required shape:

- more than 5 source-like items may be represented in explanation.
- fixture output caps to 5.
- deterministic order.
- no random ordering.
- no semantic ranking.
- no graph ranking.

Purpose:

- verifies K-280 cap behavior.
- keeps future component density bounded.

### 6. Display Title Fallback Fixture

Required shape:

- at least one untitled or blank-title note case.
- title is resolved through existing display title fallback rule.
- no raw body summary.
- no AI-generated title.
- deterministic fallback only.

Purpose:

- verifies title readability.
- avoids inventing a second untitled-note rule.

### 7. Forbidden Fields Fixture Check

Required shape:

- fixture must not contain forbidden fields.
- forbidden fields listed in K-280 remain excluded.
- future implementation tests should traverse fixture objects and reject forbidden keys.

Purpose:

- keeps fixtures contract-shaped.
- prevents fixture creep into graph/provider/backup/editor data.

## RecentNotes Fixture Rules

Future `recentNotes` fixture data must:

- cap to 5.
- use deterministic order.
- use display-ready titles.
- use fallback title deterministically.
- use `updatedAt` and `createdAt` only if source-supported.
- use existing noteListSort behavior if later implementation source-confirms it.
- keep `signalLabel` as `recent`.

Future `recentNotes` fixture data must not include:

- relationship strength.
- cluster/theme data.
- provider ids.
- raw content/body.
- attachment blob data.
- backup state.
- sync status.
- semantic ranking.
- graph ranking.

## ActiveWriting Fixture Rules

Allowed states:

- `active`.
- `idle`.
- `unavailable`.

Rules:

- unavailable is a valid safe fallback.
- no empty state inside `activeWriting`; empty vault belongs to `emptyState` and the Empty State boundary.
- no BlockEditor internals.
- no editor document model.
- no keystroke/activity analytics.
- no raw editor content.
- no background sync.
- no persistence mutation.
- current note fields only when safely source-supported in future implementation.

## Empty / Degraded Fixture Rules

Rules:

- true empty vault defers to Empty State.
- Signal Panel fixture may include minimal empty/degraded case only for component resilience.
- no duplicate Empty State CTA.
- no provider loading state.
- no backup/import/export error state.
- no fake signals.
- readable fallback text required in future rendering.
- accessibility-friendly state label required in future rendering.

## Forbidden Fields

Future fixture data must not contain these fields:

- `body`.
- `content`.
- `rawContent`.
- `markdown`.
- `editorState`.
- `blockEditorState`.
- `documentModel`.
- `embedding`.
- `vector`.
- `semanticScore`.
- `similarityScore`.
- `graphCoordinates`.
- `coordinates`.
- `orbit`.
- `spatialPosition`.
- `relationshipStrength`.
- `clusterId`.
- `themeId`.
- `knowledgeIndexResult`.
- `providerId`.
- `supabaseRowId`.
- `syncStatus`.
- `backupStatus`.
- `preflightStatus`.
- `dataSafetyStatus`.
- `oauthState`.
- `googleDriveState`.
- `attachmentBlob`.
- `restoreState`.
- `importState`.
- `exportState`.
- `activityEvents`.
- `keystrokeEvents`.
- `analytics`.

## Fixture-to-component Testing Expectations

Future component tests should verify:

- renders active fixture.
- renders idle fixture.
- renders unavailable fixture.
- renders empty/degraded fixture.
- caps recent notes to 5.
- uses fallback title.
- does not render forbidden raw fields.
- exposes semantic headings/groups.
- signal hierarchy is text/structure based, not color-only.
- no graph/provider/backup claims.
- no route/nav/panel mount.
- no runtime store reads.
- wrapper-level 390px/static proof before runtime exposure.

## Runtime Fixture Boundary

K-282 does not add a fixture module.

Future fixture module rules, if a later milestone implements one:

- should live near component tests or test utilities only.
- must not be imported by production runtime.
- must not be used as app data.
- must not be committed as generated artifact.
- must not include real user data.
- must not include secrets.
- must not include provider ids.
- must not include raw note bodies.
- must not include graph/KIS objects.
- must not include backup/preflight state.

## Relationship To K-280 / K-281

K-280 defines the draft data contract. K-281 defines the props-first component boundary. K-282 defines deterministic fixture cases.

K-282 does not change the K-280 contract at runtime. K-282 does not implement the K-281 component. K-282 prepares for a later isolated component skeleton only if K-283 approves that path.

The expected sequence remains:

1. data contract plan.
2. component boundary plan.
3. fixture spec.
4. isolated component plan or skeleton.
5. data adapter audit.
6. runtime mount only after explicit gate and browser/390px QA.

## K-283 Decision

Recommended primary path:

**K-283 Notes Overview / Signal Panel Isolated Component Plan**

Scope:

- docs/plan plus audit test only.
- lock exact component file path.
- lock exact test path.
- lock fixture location.
- lock implementation acceptance criteria.
- no implementation yet.

Alternative:

**K-283 Notes Overview / Signal Panel Fixture Closure Audit**

Scope:

- docs/audit plus audit test.
- close fixture spec before implementation.

Alternative if ready for implementation:

**K-283 Notes Overview / Signal Panel Isolated Component Skeleton**

Scope:

- small component implementation.
- fixture-driven props only.
- read-only.
- no runtime mount.
- no data adapter.
- requires Codex 5.5 high.

Not recommended:

- immediate runtime mounting.
- route/nav/panel.
- adapter plus component in the same PR.
- graph/KIS/provider/backup integration.
- Runtime Cosmos Map.

## Non-goals

K-282 has these explicit non-goals:

- no Signal Panel UI implementation in K-282.
- no Notes Overview component.
- no Signal Panel component.
- no runtime fixture module.
- no runtime type/export.
- no runtime data wiring.
- no data adapter.
- no route/nav/panel change.
- no NoteView changes.
- no NoteViewEditorArea changes.
- no noteUtils changes.
- no noteListSort changes.
- no noteDisplayTitle changes.
- no Notes store changes.
- no persistence/schema change.
- no NotesCosmosStaticPreview changes.
- no Empty State changes.
- no Runtime Cosmos Map implementation.
- no graph replacement.
- no NoteGraphView change.
- no LocalGraphView change.
- no graph builder change.
- no KnowledgeIndexService coupling.
- no live graph/index integration.
- no provider/network/background sync.
- no Supabase/OAuth/Google Drive behavior change.
- no backup/preflight runtime implementation.
- no Data Safety / Backup Health UI.
- no export/import/restore behavior change.
- no attachment blob/provider behavior.
- no BlockEditor internals.
- no Health/Schedule behavior change.
- no assets/fonts/dependencies.
- no generated artifacts.

## Closure Statement

K-282 defines deterministic fixture cases only. K-282 does not implement or mount Signal Panel.

Future fixture data must be contract-shaped, local-first, serializable, and test-only. A future component should remain isolated, read-only first, and deterministic from fixture/props data.

Adapter/runtime wiring must be separate and later. Graph/KIS/provider/backup/BlockEditor internals remain forbidden. Signal Panel remains orientation/readout, not Cosmos Map or graph replacement.

Existing graph surfaces remain preserved. Empty State and Static Preview lines remain closed. Local runtime data remains source of truth. Remote systems remain support layers.
