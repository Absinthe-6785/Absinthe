# K-97F — Stability Audit: Render Memory + Seed Lifecycle

Addresses two stability issues without changing ranking, note schema, graph simulation, or UI behavior:

1. **Render server OOM** (512 MB limit) — audit payloads, caches, and memory hotspots.
2. **Welcome note recreation** during refresh/hydration races — onboarding marker + hydration gate.

**Branch:** `k97f-stability-memory-seed`  
**Status:** Review package (audit + seed fix — not merged)

---

## Workstream A — Render Memory Audit

### A1. Server memory instrumentation

| File | Role |
|------|------|
| `frontend/src/server/k97fServerMemoryAudit.ts` | `process.memoryUsage()` samples, operation matrix, OOM ranking |
| `frontend/src/server/k97fServerMemoryAudit.test.ts` | Policy + payload + cache verification |
| `frontend/docs/K-97F-server-memory-audit.md` | Render memory report |

Operations modeled (before/after heap + payload bytes):

- note sync (`POST /api/notes`)
- export (`GET /api/backup` + client manifest)
- snapshot generation
- login hydration (`GET /api/notes` + folders)
- cloud merge (dual payload)
- large note update

### A2. Payload size audit

Run `npm test -- k97fServerMemory` to print:

| Notes | GET /api/notes | Sync vault | Export est. | Snapshot |
|------:|---------------:|-----------:|--------------:|---------:|

Identifies full-vault responses, duplicate JSON serialization, and temporary buffers.

### A3. Cache audit

| Cache | Bounded | Risk |
|-------|---------|------|
| `pendingBodySync` | per-edit | medium |
| `notesCache` | 1 entry | low |
| `paragraphOffsetCache` | 512 (K-95E) | low |
| `galaxyMapCache` | 1 entry | low |
| `GET /api/backup` response | **unbounded** | **high** |
| `GET /api/notes` response | **unbounded** | **high** |

### A4. Incremental sync candidate

**Current:** `GET /api/notes` → entire vault (`select("*")`, no `updated_after` filter).

**Candidate:** `GET /api/notes?updated_after=<ts>` — documented-only; estimated >50% memory savings on steady-state login at 1000 notes.

---

## Workstream B — Seed Lifecycle Fix

### Problem

```
notes empty (sync load before IDB)
  → defaultSeedNotes()
  → IndexedDB loads later
  → duplicate Welcome note
```

### Fix

| Change | File |
|--------|------|
| `notes-seeded-v1` onboarding marker | `frontend/src/lib/notesOnboarding.ts` |
| No seed on `notes.length === 0` | `notePersistence.ts`, `noteUtils.ts` |
| Sync load returns `[]` until hydration | `loadNotesSync()` when IDB migration complete |
| Seed only when marker absent (first setup) | `initNotesPersistence()` |
| Explicit reset still creates welcome note | `createDefaultWelcomeNotes()` |

### Policy

- **First account / first vault setup** + marker absent → one welcome note, then `notes-seeded-v1=1`.
- **User deletes all notes** → vault stays empty; marker prevents re-seed.
- **Refresh / logout / restart** → marker in localStorage survives; no duplicate welcome.
- **Valid vault sizes:** 0, 1, 1000+ notes — no automatic creation except first onboarding.

### Audit harness

| File | Role |
|------|------|
| `frontend/src/components/views/k97fSeedLifecycleAudit.ts` | Race scenarios + policy reads |
| `frontend/src/components/views/k97fSeedLifecycleAudit.test.ts` | Refresh, empty vault, first-time, race |

---

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm test -- k97f
```

---

## Review package checklist

### Render Memory Report

- [x] Heap usage samples (`process.memoryUsage`)
- [x] Payload sizes @ 100 / 300 / 1000 / 3000
- [x] Cache retention audit
- [x] OOM candidate ranking
- [x] Incremental sync analysis (documented only)

### Seed Lifecycle Report

- [x] Refresh behavior (no duplicate welcome)
- [x] IndexedDB race protection (sync load → empty until hydrate)
- [x] Empty vault support (0 notes valid)
- [x] First-time onboarding (exactly 1 welcome note)

---

## Out of scope

- Incremental sync implementation
- Backend memory instrumentation in production
- Ranking, schema, storage-layer redesign, graph simulation, UI changes
