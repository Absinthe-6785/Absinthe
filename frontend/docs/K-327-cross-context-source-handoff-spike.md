# K-327 — Cross-Context Legacy Source Handoff Architecture Spike

## Executive verdict

`HANDOFF_ARCHITECTURE_SELECTED`

`SELECTED_HANDOFF_ARCHITECTURE: WEB_LOCKS_PLUS_DURABLE_INDEXEDDB_AUTHORITY_AND_IMMUTABLE_SNAPSHOT`

The smallest defensible handoff uses one physical-source-bound exclusive Web Lock to drain cooperating same-origin writers, one durable IndexedDB authority record per physical source to survive reload/crash and enforce logical ownership, and one immutable snapshot as the only evidence K-325 and K-326 may consume. Every migration-critical writer must derive the coordinator from physical storage identity. The current `localStorage` Notes payload and revision keys must cease to be authoritative before a production source becomes eligible.

K-327 does not implement this protocol. It adds only this architecture record and a deterministic test-only concurrency model. Current production localStorage, IndexedDB, mixed, unknown, malformed, and multiple-writer sources remain rejected by K-326G.

Required verdicts:

- `ALL_MIGRATION_CRITICAL_LEGACY_WRITERS_ARE_IDENTIFIED`
- `CROSS_CONTEXT_THREAT_MODEL_COVERS_ALL_REACHABLE_WRITERS`
- `SOURCE_HANDOFF_CONTRACT_DEFINES_A_LINEARIZATION_POINT`
- `WEB_LOCKS_IS_VIABLE_ONLY_WITH_ADDITIONAL_DURABLE_FENCING`
- `INDEXEDDB_REQUIRES_REMOVING_LOCALSTORAGE_AS_AUTHORITATIVE_SOURCE`
- `IMMUTABLE_SNAPSHOT_HANDOFF_IS_VIABLE_WITH_WRITER_SHUTDOWN`
- `WORKER_COORDINATION_IS_ONLY_ADVISORY`
- `LOCALSTORAGE_LEASE_LOCK_REJECTED_AS_NON_ATOMIC`
- `REAL_BROWSER_HARNESS_NOT_AVAILABLE`
- `PROPOSED_PROTOCOL_AVOIDS_INDEXEDDB_AUTO_COMMIT_GAPS`
- `EVERY_HANDOFF_STATE_HAS_A_SAFE_RESTART_CLASSIFICATION`
- `HANDOFF_PROVES_WRITER_DRAIN_AND_POST_HANDOFF_IMMUTABILITY`
- `HANDOFF_AUTHORITY_IS_STRICTLY_SCOPE_BOUND`
- `HANDOFF_HAS_NO_SILENT_WRITE_LOSS_SEMANTICS`
- `FUTURE_K326_SOURCE_ADAPTER_CONTRACT_IS_EXPLICIT_AND_FAIL_CLOSED`
- `PHYSICAL_SOURCE_IDENTITY_IS_STABLE_ACROSS_ACCOUNT_SCOPE_CHANGES`
- `PHYSICAL_EXCLUSION_AND_LOGICAL_AUTHORITY_ARE_STRICTLY_SEPARATED`
- `ONE_PHYSICAL_SOURCE_HAS_ONE_DURABLE_HANDOFF_AUTHORITY`
- `WRITE_EXCLUSION_POINT_IS_DISTINCT_FROM_FINAL_HANDOFF_LINEARIZATION`
- `FINAL_HANDOFF_LINEARIZATION_IS_ONE_EXACT_DURABLE_COMMIT`
- `ALL_ARCHITECTURE_MODEL_BOUNDARIES_VALIDATE_UNKNOWN_INPUT_EXACTLY`
- `MALFORMED_PHYSICAL_IDENTITIES_FAIL_BEFORE_CANONICALIZATION_AND_HASHING`
- `TOJSON_AND_OBJECT_COERCION_LOCK_ALIAS_IS_PERMANENTLY_REGRESSED`
- `PERSISTED_AUTHORITY_HAS_A_VERSIONED_DISCRIMINATED_TOTAL_SCHEMA`
- `PENDING_AUTHORITY_AND_SNAPSHOT_CANDIDATE_ARE_BIDIRECTIONALLY_EXACT`
- `RESTART_EVIDENCE_CROSSES_A_REAL_SERIALIZATION_AND_UNKNOWN_INPUT_BOUNDARY`
- `ONLY_THE_EXACT_PERSISTED_PENDING_CANDIDATE_CAN_FINALIZE`

## Starting facts

- Canonical repository: `C:\Users\이도현\GitRepos\Absinthe`.
- PR #584 was squash-merged as main commit `634e861f8c1705e89015be1817f5d7dcb7aae1d2`.
- K-327 branch base: the same commit.
- Branch: `codex/k327-cross-context-source-handoff-spike`.
- Frontend baseline: React 19, Vite 6, Vitest 4, `happy-dom`, and `fake-indexeddb`; no Playwright, Puppeteer, WebDriver, or existing E2E browser runner.
- Backend baseline: FastAPI/Pytest application at the same main commit; unchanged and not executed because this spike changes no backend file.

## Original K-326G P1 recap

The current production fence has a check/use race:

1. Tab B calls `mayWriteLegacyNotes()` and observes no fence.
2. Tab A installs a K-326 fence.
3. Tab B performs a later `localStorage.setItem()` or starts/continues a legacy IndexedDB transaction.

The K-319 operation epoch is process-local. A tab cannot invalidate another tab's captured epoch. K-326G therefore correctly classifies exact production localStorage and legacy IndexedDB sources as `uncoordinated_legacy_writers`, and accepts only the exact synthetic test adapter in test mode. K-327 preserves that classification.

## Source-facts inventory

### Migration-critical writers

| Path | Function or caller | Backend | Timing and contexts | Existing guard | Can cross handoff? | Required K-328 conversion |
|---|---|---|---|---|---|---|
| `src/lib/notePersistence.ts` | `saveNotesToLocalStorageResult` / `saveNotesSyncResult` | localStorage `notes-v2` | synchronous; any page importing the bridge | `mayWriteLegacyNotes()` before `setItem` | yes; check and write are separate | route through coordinator; localStorage no longer authoritative |
| `src/lib/notePersistence.ts` | `saveNotesAsync` | legacy IDB, with localStorage fallback | asynchronous page task | recovery guard plus process-local epoch | yes; another tab is not fenced, and fallback crosses backends | exclusive source lock plus durable authority check; remove authoritative fallback |
| `src/lib/notePersistence.ts` | `migrateLocalStorageNotesToIndexedDb` | localStorage + legacy IDB | async startup/hydration in each tab | recovery guard | yes; read, IDB write, marker update, and localStorage removal are separate | one coordinated, resumable canonicalization step |
| `src/lib/notePersistence.ts` | `initNotesPersistence` rescue/seed writes | legacy IDB/localStorage | async hydration in each page | recovery guard in lower layers | yes; hydration can race handoff | coordinator before every source mutation; no seed after pending |
| `src/lib/notePersistence.ts` | `deleteNoteFromPersistence` | legacy IDB or localStorage full snapshot | asynchronous | recovery guard plus lower-layer guard | yes | coordinator and durable authority in mutation transaction |
| `src/lib/notePersistence.ts` | `clearNotesPersistence` | legacy IDB + localStorage keys | asynchronous, multi-backend | recovery/delete guards | yes; multiple commits | coordinator; destructive legacy operation remains prohibited for handoff |
| `src/lib/noteIndexedDb.ts` | `saveNotesToIndexedDb` | `absinthe-notes-v1/notes` | asynchronous IDB readwrite transaction | repeated guard and process epoch callback | yes across tabs; revision update is later localStorage write | authority, source records, and revision in the same short IDB transaction |
| `src/lib/noteIndexedDb.ts` | `deleteNoteFromIndexedDb` | legacy IDB | asynchronous transaction | recovery guard | yes | same coordinator and transactional authority |
| `src/lib/noteIndexedDb.ts` | `clearIndexedDbNotes` | legacy IDB | asynchronous transaction | recovery guard | yes | remain disabled; if ever used, same coordinator and authority |
| `src/lib/noteIndexedDb.ts` | `markIndexedDbMigrationComplete` / `bumpNotesIndexedDbRevision` | localStorage metadata | synchronous | recovery guard around callers, not atomic with IDB | yes | move canonical migration state/revision into IDB |
| `src/components/views/noteUtils.ts` | `migrateLegacyStorageIfNeeded` | several localStorage keys | synchronous startup | `mayWriteLegacyNotes()` and bridge | yes | coordinator-backed migration; no direct writes |
| `src/components/views/noteUtils.ts` | `saveNotes` | bridge or direct localStorage | synchronous/fire-and-forget bridge | recovery guard | yes; bridge may launch async save after return | await explicit coordinated result; no fire-and-forget authority |
| `src/components/views/noteUtils.ts` | `saveFolders` / `saveActiveNoteId` | localStorage | synchronous | recovery guard | folders affect migration evidence; active ID is UI metadata | folders require coordinator/canonical source; active ID stays non-authoritative but cannot impersonate source evidence |
| `src/components/views/noteUtils.ts` | `clearNotesStorage` / `clearNotesStorageAsync` | localStorage and persistence adapter | sync plus async | recovery/reset guards | yes | remain prohibited during/after handoff |
| `src/components/views/noteUtils.ts` | `createDefaultWelcomeNotes` | Notes/folders/active storage | synchronous plus bridge | recovery/onboarding guards | yes | seed must be an ordinary coordinated mutation or be rejected |
| `src/store/useNotesStore.ts` | `persistNotes` | persistence facade | sync localStorage or async IDB | lower-layer guard | yes; caller does not await IDB | return/track coordinated commit; pre-handoff flush must settle |
| `src/store/useNotesStore.ts` | create/import/update/trash/restore/permanent delete actions | full Notes snapshot and remote calls | page/React action | operation-specific recovery guards | yes | all local mutations funnel through one coordinator; remote sync stays disabled |
| `src/store/useNotesStore.ts` | `importVaultRestore` / undo | Notes + folders + snapshot | page async fan-out | K-319 restore/undo guard | yes if enabled in a future authorized context | must remain blocked; no handoff exception |
| `src/store/useNotesStore.ts` | `resetAllNotes` | clear plus seed | page | K-319 reset guard | yes | must remain blocked; no handoff exception |
| `src/store/useNotesStore.ts` | `initNotesStorage` merge persistence | legacy IDB/localStorage | per-tab hydration | lower-layer guard | yes | hydration becomes read-only during pending; no merge writeback |
| `src/store/useNotesStore.ts` | `applyStorageMerge` | cross-tab localStorage/IDB-revision merge | storage event, async load, writeback | cross-tab guard plus process epoch | yes; storage event is notification, not exclusion | prohibit writeback after pending; coordinator for any pre-handoff merge commit |
| `src/store/useNotesStore.ts` | body debounce and lifecycle flush | in-memory timer + remote sync | timer, `pagehide`, `beforeunload` | recovery guards in remote path | pending local state can be newer than source | preflight must flush and await local durability or abort; no hidden queue |
| `src/lib/persistenceCleanup.ts` | `cleanupLegacyStorageKeys` / `runPersistenceCleanup` | localStorage deletion | startup or explicit call | `mayDeleteLegacyStorage()` | yes if ever authorized | never run during handoff; legacy evidence retained |
| `src/lib/notesOnboarding.ts` | mark/clear onboarding | localStorage metadata | page | recovery guard | not Note payload, but changes seed authority | include in coordinated metadata or keep non-authoritative and blocked after pending |
| `src/components/views/k96bIndexedDbAudit.ts` | audit seed helpers | localStorage + legacy IDB | developer/audit page or tests | recovery guard | yes if reachable in production build | development-only capability and same coordinator; excluded from production handoff |
| `src/components/views/k96dPersistenceAudit.ts` | audit seed/cleanup helpers | injected storage or default localStorage + legacy IDB | developer/audit page or tests | partial/injected | yes with default storage | development-only capability; never a production bypass |
| `src/components/views/k97fSeedLifecycleAudit.ts` | lifecycle simulations | localStorage + legacy IDB | developer/audit page or tests | explicit recovery guard | yes | test/dev-only capability; never a production bypass |

Notes objects carry folders by `folderId`, properties, relations, created/updated/deleted timestamps, and tombstones. A full-snapshot replacement changes all of that migration evidence, even when the visible action appears to affect one Note. `NOTES_IDB_REV_KEY` is currently a localStorage notification/revision hint, not an atomic source revision.

Durability backups and vault snapshots are preservation evidence, not the K-325 live canonical source. They must not silently substitute for a failed handoff.

K-327A repeated the four requested source searches. No additional reachable mutation of the K-325 canonical Notes source was found beyond this table. Other localStorage writers hold unrelated UI/domain data; durability backups and vault snapshots remain non-authoritative preservation artifacts. Verdict: `K327A_DOCUMENTS_ALL_REACHABLE_MIGRATION_CRITICAL_WRITERS`.

### Non-writers and absent authorities

- [`storage` events](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) notify other same-origin windows after localStorage changes; they do not serialize the originating mutation and do not fire in the window that made the change.
- No production Notes `BroadcastChannel`, `SharedWorker`, Web Worker, Service Worker, or `navigator.locks` coordinator exists in the inspected source.
- No production K-326 caller, startup activation, UI action, or background runner exists.

## Required safety contract

### Physical exclusion identity

The physical source is the complete legacy Notes mutation domain. During conversion this domain includes the authoritative localStorage Notes/folder/metadata keys and `absinthe-notes-v1/notes`; after canonicalization localStorage is non-authoritative and the domain is anchored by the IndexedDB database/store. Every writer for either backend uses the same coordinator identity. Its validated record contains exactly:

1. schema version `1`;
2. canonical HTTP(S) origin/storage-bucket origin;
3. source family `legacy_notes`;
4. combined backend `combined_localstorage_indexeddb`;
5. database name `absinthe-notes-v1`;
6. object store `notes`;
7. physical source version `1`.

Unknown input is accepted only after a plain-own-data-record validator rejects arrays, proxies, custom prototypes other than `null`, boxed values, functions, accessors, inherited fields, unknown keys, missing keys, wrong primitive types, empty/edge-whitespace strings, and object/`toJSON` coercion. `Object.prototype` and null-prototype input records are the only accepted record shapes; both are copied into fresh ordinary `Object.prototype` outputs before canonicalization. Arbitrary input is never passed to `JSON.stringify`. Origin must equal `new URL(value).origin`, use `http:` or `https:`, and contain no path, credentials, query, fragment, trailing slash, or noncanonical casing. Database/store names are exact case-sensitive primitive strings. The deterministic model also has explicitly named secondary fixture family/backend/version values solely to prove root separation; they imply no production support. K-328 must allowlist only source-confirmed production values.

Canonical bytes are a fixed-position UTF-8 JSON array containing discriminator `absinthe_legacy_physical_source_v1` followed by schema version, origin, family, backend, database, store, and physical version. Fixed positions make serialization delimiter-safe, locale-independent, and property-order-independent. The lock is `absinthe:legacy-source-handoff:v1:<sha256(UTF8(canonical tuple))>`. User, project, namespace, device, session, route, and repository-instance fields are forbidden from this tuple. The same physical domain therefore has one lock across logout/login, project/device changes, stale tabs, and reloads; each physical field independently distinguishes another root. Malformed physical input fails before canonicalization, hashing, registry lookup, queue creation, or authority access.

### Logical durable authority

Logical scope is a separate exact record `{ schemaVersion: 1, userId, projectRef, namespaceId, deviceId }`. Each identifier is a non-empty bounded primitive string with no edge whitespace. Unknown/missing fields, accessors, inherited values, arrays, proxies, boxed strings, objects, and coercion hooks reject. Scope is absent from physical canonical bytes and lock names. A valid physical identity reaches the common lock first; the singleton authority is then reread and the actor's freshly validated logical scope is compared under that lock before mutation. A malformed or mismatched scope cannot create a second authority or alter the source.

Exactly one versioned authority record is keyed by the physical-source digest. Its exact fields are: discriminator `absinthe_handoff_authority`; schema/coordinator version `1`; physical digest; full validated logical scope plus its digest; state; non-negative safe source revision; nullable handoff session; nullable candidate ID; and nullable snapshot/root/manifest digests. `writable` permits none of the handoff fields, `handoff_pending` requires only a session, and pending-finalization/read-only require all bindings. Unknown versions/states, extra/missing fields, malformed digests, coercion, and impossible nullable combinations fail closed.

The separate snapshot candidate has discriminator `absinthe_handoff_snapshot_candidate`, schema/coordinator version `1`, candidate and handoff-session IDs, physical and logical-scope digests, exact source revision, snapshot/root/manifest digests, entity count, and deterministic sorted snapshot records. Authority and candidate mutually agree on every binding; candidate bytes are never copied into authority as repair.

Candidate IDs are internally generated only. Byte-format v1 uses `candidate-<snapshot-digest-prefix>`, where the suffix is the first 24 lowercase hexadecimal characters of the SHA-256 snapshot/ordered-record digest. The format is fixed, deterministic, ASCII-only, and exactly 34 UTF-8 bytes. Callers cannot supply opaque candidate IDs. The 96-bit fragment is a stable object-store key, not a trust anchor: restart still verifies the complete snapshot/root/manifest digest chain, every candidate field, canonical bytes, and the authority binding, so a key collision cannot substitute different content.

Handoff session IDs are also internally generated only. Byte-format v1 uses `handoff-<physical-digest-prefix>-<revision>`, where the digest suffix is the first 16 lowercase hexadecimal characters of the SHA-256 physical-source digest and revision is canonical base-10 `0..Number.MAX_SAFE_INTEGER`, with no sign or leading zero except the value `0`. The fixed prefix/digest/separator contributes 25 bytes; total length is 26 bytes at revision 0 and at most 41 bytes at the 16-digit safe-integer maximum. The identifier is deterministic for one physical source and revision. Candidate and authority parsers require the exact generated value; arbitrary 153/154-byte candidate IDs and 128-byte session IDs are invalid schema.

For one exact physical source:

1. Every migration-critical writer derives and obtains the same physical-source coordinator before reading durable authority.
2. Under that lock, a writer reads the singleton physical-root authority, validates logical user/project/namespace/device, and performs authority validation, source mutation, and monotonic revision increment in one short IndexedDB readwrite transaction.
3. Handoff obtains that exclusive coordinator, proving previously admitted cooperating writers have finished or crashed.
4. Handoff atomically changes durable authority from `writable` to `handoff_pending`. This is the **write-exclusion point**: while pending, later writers fail before mutation.
5. Handoff captures a canonical, deterministically ordered source image and manifest while the exclusive lock remains held and authority remains pending, then commits an append-only candidate as `snapshot_committed_pending_finalization`.
6. Handoff revalidates candidate digest, physical/logical authority, and unchanged source revision. A final CAS commit binds that candidate and changes authority to `read_only_handoff`. This exact commit is the **irreversible handoff linearization point**; K-325 eligibility may begin only afterward.
7. After that commit, cancellation and automatic rollback are forbidden. Every writer, including stale tabs, reacquires the lock, observes durable read-only authority, and fails before mutation.
8. K-325 consumes only the immutable snapshot. K-326 revalidates the exact terminal authority, snapshot digest, scope, revision, and K-325 binding.

If a write acquired the lock first, handoff waits and captures it. If handoff acquired the lock first, the write waits and then rejects. A writer crash before its IDB commit leaves no partial source/revision update; Web Lock release permits recovery. A handoff crash after pending leaves a durable fail-closed state.

## Browser execution context model

| Context | Shared source | Web Lock scope | Lifecycle/stale authority risk | Required behavior |
|---|---|---|---|---|
| Primary page tab | same-origin localStorage/IDB | same storage bucket and lock name | normal | coordinator mandatory |
| Second page tab | same | same | can hold stale React state | coordinator plus durable revalidation |
| Reloaded/restored tab | same | old lock is released on termination; new request joins current manager | stale persisted/session state | rebuild capability from durable authority; no cached grant |
| Background/suspended tab | same | request may be delayed; held callback lifetime is not a durable record | timers/events can pause | no time lease; pending timeout may abort only an ungranted request |
| Detached stale React instance | same | same if it reaches persistence | captured state and process epoch can be stale | persistence boundary reacquires lock and revalidates |
| PWA window | same when exact origin/storage bucket matches | same origin/bucket | independently restored window | same coordinator; no PWA exception |
| Web worker | same-origin IDB; localStorage is unavailable | Web Locks exposed in supporting secure contexts | worker termination releases lock | no present Notes writer; any future writer must use same protocol |
| SharedWorker | same origin, shared by pages | can request Web Lock | lifetime tied to clients and direct page writers can bypass | advisory notification only |
| Service worker | origin-scoped IDB | can coordinate events but has event-driven lifetime | may be terminated/restarted; not initialized before every page write | advisory only; no Notes writer introduced |
| Developer/audit tool | may use real default storage | same if run in page | explicit helpers can write directly | unavailable without dev capability and coordinator |
| Vitest/test process | isolated fake/model storage | process-local test queue | not browser evidence | deterministic protocol proof only |
| Same-origin logout/login/project switch | physical source may remain shared | one lock derived only from physical source | stale tab retains old user memory | after common lock acquisition, singleton root authority rejects mismatched user/project/device/scope |
| Restored/imported browser profile | copied storage, new runtime locks | new lock manager | copied authority may reference a different device/root | durable device/root binding fails closed |
| Multiple repository instances | same underlying stores | same lock name | separate JS instances | no process singleton assumptions |

Separate browser profiles and private browsing sessions are separate user agents/storage partitions and cannot coordinate with one another. They must never be treated as one handed-off physical source.

## Browser primitive evidence

The [W3C Web Locks working draft](https://www.w3.org/TR/web-locks/) specifies same-storage-bucket coordination across windows and workers, exclusive-by-default same-name locks, callback-promise lifetime, and release on document/agent termination. The specification also says abort applies before grant; once granted, the signal is ignored. Its `steal` option can leave the prior holder running without exclusivity and is therefore forbidden here.

[MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) reports broad availability since March 2022, secure-context-only exposure, and worker availability. Browser support still requires a real target-browser matrix before rollout.

[MDN IndexedDB terminology](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology) defines IDB transactions as atomic, fixed-scope, and expected to be short-lived. The proposed protocol never awaits crypto, timers, React state, localStorage, network, worker messages, or arbitrary callbacks inside an open IDB transaction.

[MDN SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker) reports Baseline 2026/newly available status, exact-origin sharing, and a lifetime linked to open clients. [MDN's Service Worker overview](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) describes its event-driven worker model. Neither can prevent a page that retains direct storage access from bypassing the coordinator, so neither is the required authority.

## Candidate comparison

| Candidate | Cross-tab exclusion | Crash-safe | Browser/support constraint | Writer migration | Verdict |
|---|---|---|---|---|---|
| Web Locks alone | yes for cooperating same-bucket contexts | no durable state; lock releases on termination | secure context and API required | every writer | insufficient alone |
| Web Locks + durable IDB authority | yes | pending/read-only survive restart | unsupported environment fails closed | every writer; remove localStorage authority | selected coordinator |
| IndexedDB authority alone | only for mutations fully inside the same DB transaction model | durable | broad IDB support | canonical source and all writers must move into IDB | viable end state, but cannot authorize later localStorage writes |
| Immutable snapshot alone | no | snapshot can be durable | storage-dependent | writer shutdown required | viable only as selected protocol output |
| SharedWorker | only cooperative clients | worker lifecycle is not durable authority | newer/varying older-browser support | every writer plus worker bootstrap | advisory only |
| Service worker | event coordination, not universal page-write exclusion | restartable but event-driven | registration/control timing | every writer plus worker protocol | advisory only |
| localStorage lease | no atomic validate-and-mutate | expiry/clock/ABA/suspension races | localStorage available | every writer | rejected |

## Web Locks findings

`WEB_LOCKS_IS_VIABLE_ONLY_WITH_ADDITIONAL_DURABLE_FENCING`

- Same-name exclusive acquisition is the drain proof for writers that all use the coordinator.
- The lock is named only from the versioned canonical physical-source tuple described above. Logical user/project/namespace/device fields are deliberately excluded and are checked in the durable authority after lock acquisition.
- The lock is held only across bounded local storage work. No network call, UI wait, timer, or user interaction is inside the callback.
- An `AbortSignal` may bound waiting before grant. It is not an in-lock cancellation mechanism.
- `steal` is forbidden.
- Web Lock state is not recovery evidence. Durable IDB authority determines restart behavior.
- Unsupported API, insecure context, wrong storage bucket, or failed lock acquisition returns a bounded error before mutation or handoff. No localStorage lease fallback exists.
- Fairness beyond the specified same-resource queue behavior is not a safety premise; bounded maintenance availability is an operational concern.

## IndexedDB findings

`INDEXEDDB_REQUIRES_REMOVING_LOCALSTORAGE_AS_AUTHORITATIVE_SOURCE`

An IDB transaction can atomically validate authority, mutate records, and increment a revision only when those values are in its fixed transaction scope. It cannot authorize a later `localStorage.setItem()` atomically. Therefore:

- the live canonical legacy source must be entirely IDB-backed before eligibility;
- the authoritative revision, migration state, folders required by Notes evidence, and source authority move into the coordinated IDB model;
- `notes-v2`, localStorage migration flags, and localStorage revision events become non-authoritative cache/notification data, then direct payload writes are removed;
- dual writes are forbidden as an authority scheme;
- a one-time conversion runs under the exclusive Web Lock and is itself restart-safe and digest-checked.

Transactions contain only IDB requests and synchronous validation. Crypto and canonical serialization happen outside a transaction on captured immutable bytes; a following short transaction revalidates pending authority and revision before committing their digest.

## Immutable snapshot handoff findings

`IMMUTABLE_SNAPSHOT_HANDOFF_IS_VIABLE_WITH_WRITER_SHUTDOWN`

A copy made while writers remain possible proves only momentary equality. The selected snapshot is valid because prior writers have drained, pending authority blocks later writers, and terminal authority prevents future writes. It binds source revision, source-root digest, manifest digest, ownership/scope, and coordinator version. K-325 reads this snapshot rather than the live store. A later live-source revision or different terminal record invalidates K-326 eligibility.

## Worker coordination findings

`WORKER_COORDINATION_IS_ONLY_ADVISORY`

SharedWorker or Service Worker messages may accelerate read-only notifications, but they are not authority. A stale page or helper can bypass a worker and write storage directly unless the storage boundary also validates durable authority under the same coordinator. Worker termination, control/registration timing, reload, older-browser support, and account switching further prevent treating worker liveness as proof.

## Rejected localStorage lock

`LOCALSTORAGE_LEASE_LOCK_REJECTED_AS_NON_ATOMIC`

Read/set-if-absent is not an atomic compare-and-set. Owner nonce, expiry, renewal, and storage events do not eliminate simultaneous acquisition, suspended-tab clock behavior, split brain, overwritten leases, ABA owners, crash expiry, or delayed notification. Most importantly, localStorage cannot atomically validate a fencing token while applying the target payload. K-327 does not implement such a lock.

## Transaction-liveness structure

`PROPOSED_PROTOCOL_AVOIDS_INDEXEDDB_AUTO_COMMIT_GAPS`

Each IDB transaction is short and synchronous except for IDB request events/promises created by that transaction. These operations occur outside it:

- Web Lock acquisition;
- canonical serialization and Web Crypto hashing;
- timers and timeout policy;
- React/in-memory editor flush;
- localStorage notification;
- worker messages;
- network or remote sync.

After external computation, a new short readwrite transaction CAS-validates authority state, scope, source revision, and captured digest inputs before commit. No transaction is kept alive with unrelated asynchronous work.

## Real-browser evidence

`REAL_BROWSER_HARNESS_NOT_AVAILABLE`

The repository has Vitest, `happy-dom`, and `fake-indexeddb`, but no Playwright/Puppeteer/WebDriver dependency, browser fixture, E2E server lifecycle, or CI browser job. Adding a browser stack and production-visible test seams would exceed this spike's narrow, no-runtime-change scope.

Evidence collected:

- Deterministic unit model: 373 Vitest executions in the K-327G focused run. Counts are execution accounting, not a substitute for semantic independence; boundary fixtures below identify the exact persisted object or effect property each execution proves.
- Evidence: the K-327B/K-327C identity, schema, ordering, duplicate, canonical-byte, missing-evidence, and null-prototype matrices remain intact. K-327D's bounded parser and K-327E's real write/delete controls, counter coverage, retry measurement, and monotonic number scanner remain. K-327F replaces the synthetic combined root with separate authority/candidate payloads and a non-persisted legacy-source fixture. K-327G fixes candidate/session identifiers to the actual internally generated formats, removes identifier padding from valid resource fixtures, and treats the candidate payload as a policy ceiling rather than an exact reachable maximum.
- Focused categories: 139 physical identity, 35 logical scope, 45 persisted schema, 25 fixed identifier-policy, 8 null-prototype, 13 duplicate-aware JSON, 32 production-shaped bounds/parser, 9 observable effects, 60 separate-payload restart/corruption, and 7 named-lock ordering executions = 373. No `.only`/`.skip` marker or duplicate candidate-null fixture remains.
- Fake storage evidence: existing local database suites continue to exercise fake IndexedDB; the new model intentionally does not claim browser storage behavior.
- Real two-tab, page reload, browser-process restart, suspension, and PWA evidence: not collected.

K-328 must add Chromium two-page evidence and at least the project-supported Firefox/WebKit matrix before any rollout task.

## Selected architecture

`SELECTED_HANDOFF_ARCHITECTURE: WEB_LOCKS_PLUS_DURABLE_INDEXEDDB_AUTHORITY_AND_IMMUTABLE_SNAPSHOT`

### Safety argument

All actors touching one physical source derive the same versioned physical lock, regardless of cached account scope. Lock acquisition orders writer and handoff callbacks. Only after acquisition does an actor read the singleton physical-root authority and validate logical scope. Writers validate `writable` and commit source plus revision atomically in IDB. Handoff drains earlier writers, commits pending authority, captures the fixed source, commits an append-only snapshot candidate, and finally binds that candidate through terminal `read_only_handoff` authority. Later or stale-account writers acquire the same lock and reject on scope or state before storage mutation. Durable state, not lock liveness, drives restart.

### Required writer migrations

1. Introduce canonical physical-source identity, internal lock-name derivation, and one versioned durable authority/snapshot graph per physical source, dormant by default.
2. Move authoritative Notes, folders, migration metadata, and revision into one IDB transactional source.
3. Route every production and developer/audit mutation listed above through the coordinator.
4. Remove authoritative localStorage fallback and direct Note payload writes.
5. Await preflight editor flushes; abort rather than lose unsaved state.
6. Prove static reachability and two-tab behavior before changing K-326 classification.

### Rejected alternatives

- IndexedDB-only is a possible final mutation model but does not coordinate the conversion or any remaining direct localStorage writer.
- Maintenance mode without Web Lock/transactional authority cannot prove all tabs drained.
- Workers add lifecycle and bootstrap complexity without preventing bypass.
- localStorage leases cannot atomically fence the payload.
- Snapshot-only capture is stale as soon as any writer remains possible.

## Linearization points

- **`WRITE_EXCLUSION_POINT`:** successful IDB commit of exact authority `writable@revision N -> handoff_pending@revision N` while holding the common physical-source lock. From this precommit point until explicit pre-snapshot cancellation, no writer may commit. It is resumable and is not K-325/K-326 evidence.
- **Append-only candidate commit:** exact snapshot bytes/metadata, root and manifest digests, source revision N, physical-source digest, and logical authority digest are persisted as `snapshot_committed_pending_finalization`. Writers remain blocked; the candidate is provisional, cannot be cancelled or replaced, and is not K-325/K-326 eligible.
- **`HANDOFF_LINEARIZATION_POINT`:** one final IDB CAS commit revalidates the append-only candidate and unchanged revision, binds its digest in the singleton authority, and changes `snapshot_committed_pending_finalization -> read_only_handoff`. After this exact durable commit, cancellation, writer re-enable, candidate replacement, and automatic rollback are forbidden. K-325 eligibility may begin; K-326 still requires later exact K-325 binding and revalidation.

This two-step append-only protocol keeps hashing/canonicalization outside long IDB transactions while defining one exact irreversible terminal commit. `handoff_pending` is only the write-exclusion state, never final handoff completion.

### Persisted serialization and exact rehydration

K-327F selects one production-shaped topology and removes the synthetic serialized root. Authority and candidate are independent IndexedDB records. The legacy source remains in its existing localStorage/legacy IndexedDB stores and is read under the common physical-source lock; it is not serialized again into safety evidence. The candidate contains the one authoritative immutable snapshot copy.

| Object/store | Key | Payload | Authoritative content | Policy limit |
|---|---|---|---|---:|
| Handoff authority store | physical-source digest | byte-format-v1 canonical JSON `Uint8Array` | scope, state, revision/session, candidate/digest bindings | 4,096 bytes |
| Snapshot candidate store | candidate ID | byte-format-v1 canonical JSON `Uint8Array` | ordered source records, count, revision and all binding digests | 504,000 bytes |
| Existing legacy source stores | existing source keys | existing localStorage/legacy IDB records | writable source before candidate commit; retained evidence afterward | capture limits below |
| Test restart artifact set | not persisted | detached authority bytes, candidate entries and legacy-source fixture | orchestration only; never accepted as one production payload | no byte-format limit |

| Datum | One authoritative persisted location | Duplicate allowed |
|---|---|---|
| Physical source identity | authority payload; candidate carries only its binding digest | indexed digest key may repeat as non-authoritative lookup metadata |
| Logical authority scope and durable state | authority payload | candidate carries only the scope digest |
| Candidate ID | candidate store key and authority binding | candidate field must equal the key; mismatch is corruption |
| Immutable source records and entity count | candidate payload | no second root/source-array payload |
| Source revision and handoff session | authority payload, exactly bound by candidate fields | equality required; neither copy may repair the other |
| Snapshot/root/manifest digests | candidate graph with exact authority binding | equality required |
| Terminal `read_only_handoff` state | authority payload | no alternate terminal marker |

The deterministic model receives each persisted payload as a separate JavaScript string standing in for the decoded bytes. K-328 must store immutable `Uint8Array` values and validate each `.byteLength` before fatal UTF-8 decoding. Limits are UTF-8 bytes, never UTF-16 code units. The allocation-free counter has permanent `TextEncoder` differential cases for full lengths and `stopAfter = length-1`, `length`, and `length+1`; valid pairs and lone/repeated/mixed invalid surrogates follow TextEncoder replacement semantics.

Each payload uses a recursive duplicate-aware JSON reader. Container depth is checked before entering every object or array; no terminal or nonterminal container may exceed 64. JSON whitespace is exactly SPACE, TAB, LF, or CR. Every object owns a fresh decoded-key set, and duplicate decoded keys are rejected before schema construction. Null-prototype temporary maps and own data properties prevent special-key semantics.

The limits are policy selections, not sizes reverse-engineered from one fixture. Candidate and session identifier invariants are distinct from source-record ID/value bounds:

| Bound | Value | Classification | Rationale |
|---|---:|---|---|
| Authority payload | 4,096 bytes | rejection ceiling only | small fixed state graph with substantial headroom over production-shaped identities |
| Candidate payload | 504,000 bytes | pre-parse rejection ceiling | approximately 500 KB immutable snapshot cap for bounded decode/parse memory and browser transaction margin; production-path reachability is not claimed |
| Demonstrated production-path candidate | 503,794 bytes | high-water evidence | maximum capture fixture with generated 34-byte candidate ID and 41-byte session ID |
| Transaction write aggregate | 509,000 bytes | parent/transaction ceiling | actual authority/candidate application payloads plus one 3,904-byte application reserve; legacy source excluded |
| Application transaction reserve | 3,904 bytes | deliberately reserved headroom | future bounded application-controlled object-store keys, versioned wrappers, and auxiliary metadata; not measured or estimated IndexedDB engine overhead |
| Aggregate source tuples | 499,000 bytes | reachable exact maximum | bounded capture/hash memory and CPU; punctuation is charged only by candidate parent |
| Source records | 4,096 | reachable exact maximum | bounded migration batch and iteration cost |
| Canonical `[id,value]` | 131,072 bytes | parent-only constraint | 128 KiB persisted-record denial-of-service boundary |
| Decoded source-record ID | 256 bytes | reachable subordinate maximum | bounded source-key processing; unrelated to candidate/session identifier schemas |
| Decoded source-record value | 20,000 bytes | provisional subordinate maximum | bounds capture/hash memory; K-328 must validate real migration inventory before activation |
| Candidate ID | 34 bytes | fixed schema invariant | internally generated `candidate-` plus 24 lowercase SHA-256 hex characters |
| Handoff session ID | 26..41 bytes | generated schema invariant | internally generated physical-digest prefix plus canonical safe-integer revision |
| JSON depth | 64 containers | parser ceiling | shape-independent parser stack/work bound |

The simultaneous worst-case record uses a 256-byte control-character ID and a 20,000-byte control-character value. Canonical `JSON.stringify([id,value])` is exactly `1,536 + 120,000 + 7 = 121,543` UTF-8 bytes, leaving 9,529 bytes beneath the 131,072-byte parent. The permanent fixture places both maxima in one record and passes. A 20,001-byte value fails the decoded-value check while remaining below the whole-record parent. Validation order is decoded ID, decoded value, canonical tuple serialization, whole-record bytes, overflow-safe aggregate accounting, then digest computation; the parent remains authoritative.

The maximum production-shaped capture fixture reaches aggregate tuples 499,000 bytes, count 4,096, decoded source-record ID 256, decoded source-record value 20,000, and worst-case tuple 121,543. Its candidate arithmetic is: 624 bytes of fixed canonical envelope (field names, fixed scalar/digest values, quotes, separators, and empty record-array brackets), 34 candidate-ID bytes, 41 session-ID bytes, 499,000 tuple bytes, and 4,095 record-array comma bytes = **503,794 bytes**, leaving 206 bytes below the candidate ceiling. It completes restart and terminal finalization with all digests and authority bindings regenerated from final content.

The 504,000-byte candidate bound is therefore a rejection ceiling, not a reachable exact maximum. Aggregate capture is the earlier production-valid constraint: adding the 207 content bytes required to reach 504,001 necessarily makes aggregate tuples 499,207 and is not a single-cause schema-valid pair. A canonical raw 504,001-byte candidate with generated identifiers confirms only that the independent pre-parse ceiling rejects before decode, coordinator construction, or writes; it is explicitly not reported as production-valid limit-plus-one evidence. Aggregate capture retains its canonical 499,000/499,001 single-cause pair. Authority likewise has no claimed reachable exact maximum.

Transaction evidence is independent of identifier padding. One fully valid graph uses 1,302 authority bytes + 503,794 candidate bytes + the 3,904-byte application reserve = exactly 509,000. Adding one ASCII byte to a valid logical-scope field changes only the authority payload to 1,303 bytes, regenerates fixed-length digests/bindings, and yields 509,001; both persisted objects remain individually valid and rejection occurs at the transaction graph bound. The reserve is applied once as enforceable application policy headroom, never as unknowable IndexedDB engine overhead. Legacy source data is read-only capture input and excluded.

The 504,000-byte policy protects decode/parse memory, transaction margin, and pathological snapshot handling. It is provisional until K-328 inventories the largest real legacy record, aggregate snapshot, record count, serialized candidate distribution, and revision/session ranges. Oversized sources remain ineligible; activation must not truncate, split, repair, or silently reinterpret them.

Serializer v1 uses `JSON.stringify` fixed field/array order, compact separators, literal forward slashes and supported non-ASCII characters, JSON escapes for controls, and ordinary finite decimal integer spelling. JavaScript lone-surrogate strings are allowed consistently with `JSON.parse`; well-formed `JSON.stringify` emits them as `\ud800`-style escapes. A literal unpaired surrogate is therefore noncanonical, and pre-parse UTF-8 measurement follows TextEncoder replacement semantics. No NFC/NFD normalization occurs. Leading/trailing/inter-token whitespace, BOM, LF/CRLF suffixes, reordered keys, alternate numeric spellings such as `1e0` or `-0`, optional forward-slash escaping, Unicode/surrogate/control escape alternatives, and escaped spellings of otherwise literal keys/values are rejected as `NONCANONICAL_PERSISTED_BYTES`. Number tokenization advances monotonically over the original string and creates only one bounded token substring after locating its end; it never slices the remaining suffix per token. A 400,000-number canonical array permanently verifies zero suffix copies and exact grammar/canonical behavior.

Byte-format version `1` independently binds each authority and candidate payload's UTF-8 representation, exact JSON grammar, field/order rules, string/number/surrogate policy, and applicable size/count/depth limits. Format evolution requires a new byte-format version and migration review. Rejection never repairs, rewrites, synthesizes, deletes, or recaptures evidence. Only after artifact-set shape, per-object raw bounds, payload schema, capture bounds, graph binding, transaction bound, and exact canonical equality may a coordinator be constructed.

Finalization rereads the canonical authority record and its candidate-store entry, then performs one compare-and-set only when discriminator, schema/coordinator/byte-format version, physical digest, logical-scope digest, handoff session, candidate key/ID, revision, snapshot digest, root digest, manifest digest, entity count, records, and recomputed record digest all agree. The composite snapshot/root/manifest binding covers the ordered records and every safety-critical candidate field; no third source array is required. Candidate fields never repair authority. Missing, substituted, mismatched, oversized, duplicate-key, noncanonical, or malformed evidence is a total restart rejection.

No-effect evidence is observable rather than expected-value driven. The production-shaped fake store has one authority byte record, a candidate-by-ID map, and a separate legacy-source map. Counted boundaries cover persistence reads/writes, authority/candidate/terminal writes, identical authority rewrites, authority/candidate creation, candidate deletion, source reads/captures/recaptures/mutations, digest computation, coordinator construction, and finalization invocation. `rewriteAuthority` replaces the actual authority-store value; identical bytes still increment persistence/authority/rewrite counters. `deleteCandidate` removes the actual candidate-map entry and increments persistence/record/candidate-delete counters; repeated absence is a no-op.

Counter overlap is fixed: terminal write is an authority and persistence write; candidate creation is a candidate/persistence write and record creation; authority rewrite is an authority/persistence write; candidate deletion is a record deletion and persistence write; source recapture is a source capture/read and persistence read; source mutation is a persistence write. Every rejection stage (`raw_input`, `raw_bounds`, `duplicate_scan`, artifact-set/authority/candidate/source schema, `capture_bounds`, `graph_bounds`, `graph_binding`, `canonical_bytes`, coordinator, and finalization CAS) has a direct permanent case and capability allowlist. Coordinator rejection proves two reads, one construction, zero finalization and zero writes. Injected finalization CAS rejection proves two reads, one construction, one invocation, zero writes, and unchanged detached authority/candidate/source observations.

The first terminal finalization, measured after coordinator construction, performs exactly two persistence reads, one finalization invocation, one terminal/authority/persistence write, and zero candidate/root/create/delete/source/digest effects. A second identical call on the same observed registry/context performs exactly two reads and zero coordinator construction, finalization, writes, create/delete, capture/recapture/mutation, or digest effects; bytes and counts remain identical.

## State machine and restart behavior

| Durable state | Writers | Snapshot | K-325 | K-326 | Restart | Cancellation |
|---|---|---|---|---|---|---|
| `writable` | allowed only through coordinator | absent | ineligible | ineligible | continue normal legacy writes | not applicable |
| `handoff_pending` | rejected | absent or uncommitted capture | ineligible | ineligible | reacquire lock; resume capture or explicitly cancel after graph validation | allowed only before snapshot commit |
| `snapshot_committed_pending_finalization` | rejected | append-only candidate, bound to physical/logical authority and revision | ineligible | ineligible | reacquire physical lock; validate exact candidate and unchanged revision; finalize idempotently or remain blocked | forbidden |
| `read_only_handoff` | rejected permanently | immutable and exact | eligible | potentially eligible after K-325/K-326 revalidation | idempotently revalidate; no mutation | forbidden |

Unknown state, unknown version, missing scope, digest mismatch, impossible transition, snapshot/authority mismatch, or malformed record is `CORRUPT_PERSISTED_RECORD` and fail-closed. No durable state requires a process-local capability to interpret.

`handoff_failed` and `cancelled_precommit` are operation outcomes, not durable authority states. A failure before exclusion leaves `writable`; a failure after exclusion leaves the last valid pending state for explicit diagnosis/resume. Pre-snapshot cancellation is one validated atomic transition from `handoff_pending` back to `writable`; no synthetic cancellation state is persisted.

### Crash boundaries

- Before pending commit: IDB abort leaves `writable`; lock releases on context termination.
- After pending commit, before capture: restart sees pending; writers reject; resume/cancel is explicit.
- During capture/hash: pending remains; partial external computation is not evidence.
- After append-only snapshot candidate commit, before terminal authority: restart sees `snapshot_committed_pending_finalization`; writers remain blocked, the candidate is ineligible, cancellation is forbidden, and retry may only validate the same candidate/revision and perform the terminal CAS. It never rebuilds, replaces, or silently discards the candidate.
- K-327D restart evidence crosses bounded, canonical, duplicate-safe JSON rehydration into a new registry/context. The original and rehydrated authority, logical-scope, candidate, and record-array references are distinct. One common structured rejection result covers raw size, syntax, duplicate keys, schema, graph bounds, binding, and canonical-byte failures. Counted capabilities and before/after durable observations prove no promotion, writable restoration, candidate/authority synthesis, source recapture, persistence write, evidence mutation, or skipped assertion path.
- After terminal commit: restart revalidates; never re-enables writers.
- Browser/OS power loss inherits the browser's IDB durability limitations; exact real-browser crash/power evidence remains a rollout prerequisite.

## Account and namespace isolation

The physical lock identity is separate from logical authority. It contains canonical origin, source family, backend, database, object store, and physical version only. The singleton durable authority then binds versioned hashes or bounded local fields for:

- user ID;
- Supabase project ref;
- device ID;
- physical legacy source database/store/root identity;
- source schema and adapter version;
- K-325 migration session, once created.

The Web Lock name is `absinthe:legacy-source-handoff:v1:<physical-source-digest>`. User/project/namespace/device are not inputs. A stale tab and a current-account tab addressing the same physical source therefore contend on one lock; the stale actor is rejected by the singleton durable authority after acquisition and before mutation. Logout/login, project switch, device change, imported database, restored profile, or stale cached capability cannot fork the authority. A copied profile is a distinct browser storage environment/lock manager and must fail its device/root authority checks rather than inherit runtime lock ownership.

## User-visible write availability

The future operation is a bounded maintenance/read-only interval:

1. Flush in-memory editor state through the ordinary coordinator and await its durable commit.
2. If flush cannot commit, abort before pending and show a bounded failure; do not capture.
3. During pending and terminal read-only, reject edits explicitly before persistence. Do not acknowledge them as saved.
4. Do not create a hidden retry queue. A future queue would need its own durable semantics and review.
5. Stale/background tabs learn by their next coordinator acquisition; advisory messages may update UI sooner.
6. Offline operation is supported only when Web Locks and IDB are available in the current secure origin. Unsupported contexts fail closed.
7. Precommit cancellation returns to writable atomically. Postcommit rollback is not supported.

## Future K-326 integration contract

K-326 may eventually accept a new adapter only when it can revalidate an exact, versioned, payload-free handoff evidence graph containing:

- record discriminator/version;
- canonical physical-source digest and a separately derived logical namespace/user/project/device authority digest;
- source backend and schema version;
- handoff session ID;
- source authority ID/version and predecessor authority digest;
- terminal state `read_only_handoff`;
- source revision and immutable snapshot record count;
- source-root digest and snapshot/manifest digest;
- writer-drain proof `web_locks_exclusive_v1`;
- coordinator version and physical-source-only lock-name digest;
- committed timestamp and bounded attempt/CAS version;
- K-325 migration session ID and verified target manifest digest.

Future K-326 must re-read the singleton physical-root authority and validate terminal state, exact snapshot digest, separate logical namespace binding, supported coordinator/version, no newer revision, no writable/pending authority, and exact K-325 session evidence immediately before activation. An account-keyed parallel authority record is invalid. Missing, malformed, mixed, unknown, superseded, or nonterminal evidence remains `CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE` or bounded corruption. K-327 changes none of the current acceptance code.

## K-328 implementation scope

### Exact follow-up

- Title: `K-328 — Implement Dormant Cross-Context Read-Only Handoff Foundation`
- Branch: `codex/k328-cross-context-read-only-handoff`
- Production state remains dormant and unavailable to startup/UI/auth/hydration/background execution.

### Expected files

- New `src/lib/localDatabase/legacyPhysicalSourceIdentity.ts` with strict unknown-input physical/scope parsers, own-data/accessor rejection, fresh validated values, versioned UTF-8 canonical serialization, exact production allowlists, malformed-input side-effect instrumentation, and complete physical/logical distinction matrices.
- New `src/lib/localDatabase/legacySourceHandoff.ts` with versioned discriminated authority/candidate byte schemas, pre-decode resource bounds, duplicate-decoded-key rejection, exact canonical JSON equality, singleton physical-root authority, logical scope validation under lock, exact pending-candidate CAS, serialized rehydration, total restart rejection, cancellation boundaries, and privacy-safe errors.
- New `src/lib/localDatabase/legacySourceCoordinator.ts` and tests wrapping Web Locks with internal physical lock-name derivation, no injected lock/queue identity, and unsupported-environment failure.
- Additive local database schema/constants/validation changes for authority and immutable snapshot metadata (reuse an existing generic store only if strict key/type isolation is proved).
- Coordinated changes to `src/lib/notePersistence.ts`, `src/lib/noteIndexedDb.ts`, `src/components/views/noteUtils.ts`, `src/store/useNotesStore.ts`, onboarding, cleanup, and the K-96/K-97 developer/audit writers.
- A test-only two-page browser fixture and Playwright configuration isolated from production exports.
- `docs/K-328-cross-context-read-only-handoff-foundation.md` plus necessary K-326/K-325 contract references.

### Implementation order

1. Add separate authority and candidate object stores. Persist one authority `Uint8Array` under the physical-source digest and one immutable candidate `Uint8Array` under the candidate ID. There is no combined payload and no second persisted source-record array. Validate each `.byteLength` before fatal UTF-8 decoding, then apply its per-object/count/depth limits, duplicate-aware parser, schema, graph/digest binding, transaction aggregate, and canonical re-encoding equality. Add populated-version upgrade tests; unsupported/imported/recovered evidence fails closed without repair.
2. Add an internal Web Lock coordinator deriving `absinthe:legacy-source-handoff:v1:<physical digest>` with no account inputs, queue injection, lease fallback, or `steal`; include bounded pre-grant abort and deterministic named-lock tests.
3. Move authority, revision, Notes/folders evidence, and conversion progress into IDB transactional scope. Treat localStorage plus legacy IndexedDB as one combined mutation domain under the IDB-anchored coordinator until localStorage becomes non-authoritative.
4. Convert every writer in the inventory; static tests reject bypasses and direct authoritative localStorage writes.
5. Implement dormant preflight, write-exclusion, append-only snapshot candidate, terminal linearization, restart, and pre-snapshot-only cancellation primitives.
6. Add K-325 snapshot adapter; keep K-326 production classification unchanged until a separate review proves the adapter.
7. Run Chromium two-page order/crash/reload/account tests; document Firefox/WebKit/PWA/private-mode support matrix.
8. Obtain persistence/concurrency and security/privacy review before any eligibility change.

### Required persisted storage decision

K-328 has one selected representation: separate authority and candidate object-store values are immutable `Uint8Array` UTF-8 canonical JSON payloads. Authority advances only through reviewed CAS transitions; the candidate is append-only and owns the sole immutable source snapshot. Indexed wrapper fields are lookup metadata, never another trusted graph. Legacy source records remain in their original stores and are captured under the physical lock; they are not counted as transaction writes. Reads check structured-clone type and per-object `.byteLength` before fatal UTF-8 decoding, then exact grammar, duplicate detection, depth 64, schema, capture/record bounds, graph/digest binding, transaction budget, and exact re-encoding equality.

Byte-format-v1 policy is: authority 4,096 bytes (rejection ceiling), candidate 504,000 bytes (rejection ceiling; 503,794 demonstrated production-path high-water), actual transaction writes 509,000 bytes including one 3,904-byte application-controlled reserve, 4,096 source records, 499,000 aggregate canonical tuple bytes, 131,072 canonical bytes per record, decoded source-record ID 256, decoded source-record value 20,000, and depth 64. Candidate IDs are fixed 34-byte generated values; session IDs are generated 26..41-byte values. Source-capture limits are distinct from persisted-object limits. K-328 must repeat canonical single-cause boundaries where reachable, raw rejection-ceiling evidence where not, real IndexedDB bytes, malformed UTF-8, fatal decoding, exact re-encoding, actual store effects, and no repair. It must also complete real-data size inventory before eligibility. K-326 eligibility remains separately gated.

### Required K-328 tests

- writer-first, handoff-first, two writers with handoff between them;
- tab close/crash before writer commit and at every handoff durable boundary;
- reload while queued and resume from every durable state;
- source revision/digest/manifest mutation and corruption;
- logout/login, project/device/scope mismatch, imported/restored source;
- same physical root across different user/project/namespace/device values always sharing one lock, stale-account rejection under that lock, and different physical roots progressing independently;
- every physical field independently changing canonical bytes/digest/lock/queue/authority key, while every logical field leaves the physical lock unchanged;
- malformed physical/scope matrices covering primitives, objects, arrays, boxed values, accessors, inherited keys, proxies, unknown/extra/missing fields, and `toJSON`, with no malformed physical lookup or queue creation;
- snapshot candidate crash before terminal finalization, serialization into unknown input, fresh rehydration in a new runtime, exact candidate promotion, duplicate retry, and cancellation rejection;
- candidate/session/root/scope/revision/snapshot/root/manifest digest/discriminator/schema/coordinator/byte-format mismatch, malformed JSON, impossible state, and unknown-version rejection without writable restoration or repair;
- duplicate decoded keys in authority, logical scope, candidate, and nested/array-element objects, including escaped-equivalent spellings, rejected before schema construction;
- canonical-byte matrix covering BOM, whitespace/newline, property order, escaped key/value spelling, alternate numeric spelling, truncation, primitives, special keys, and bounded deep nesting, with exact input-byte preservation and no normalization;
- separate authority/candidate/transaction/capture/record/source-record-ID/value/count/depth matrices using the reachability classifications above; capture and transaction exact/limit+1 inputs must be canonical, fully rebound, and single-cause, while authority and candidate payload sizes are explicit rejection ceilings with production high-water evidence rather than invented exact maxima;
- exact JSON whitespace tests for SPACE/TAB/LF/CR and grammar rejection of NBSP, BOM, vertical tab, form feed outside strings, line/paragraph separators, narrow no-break space, and other Unicode whitespace;
- structured restart-stage accounting with the K-327F stage-specific capability allowlists, directly asserting every persistence/source/digest/coordinator/finalization/create/delete/rewrite counter and real IndexedDB before/after state for every rejection;
- crash/restart tests at exact resource bounds, bounded IDB reads before decode/parse, malformed UTF-8 byte rejection, fatal decode and exact re-encoding, plus actual IndexedDB identical-value rewrite and create/delete observation at the modeled persistence boundary;
- measured first-finalization and idempotent-retry profiles with zero unexplained writes, captures, digests, or repairs;
- bounded monotonic number scanning with the adversarial numeric-array regression and no repeated remaining-suffix work;
- `Object.prototype` and null-prototype positive input normalization plus malformed negative cases, always returning fresh ordinary records;
- writer-first and handoff-first stale-account traces asserting unchanged source, revision, authority identity, session, candidate, and digests after rejection;
- Web Locks absent, insecure context, IDB failure/quota, pending timeout;
- preflight editor flush failure and explicit write rejection;
- direct-writer reachability scan, developer/audit writer coverage, no localStorage authority;
- no network, K-323 runner, K-326 activation, startup/UI/service-worker/timer wiring;
- populated previous IndexedDB version preserved exactly.

### Rollout restrictions

K-328 remains dormant. It cannot enable K-326, change Notes reads, initiate migration, stop production writers automatically, or expose UI. A later independent review must decide whether production source eligibility can change. Production rollout remains a separate task.

## Security and privacy

- Lock names and records use hashes; they expose no raw user/project/device IDs, Note IDs, titles, bodies, properties, relations, attachment data, tokens, or auth objects.
- Snapshot payload access stays inside the local persistence boundary; diagnostics expose only bounded codes, state, counts, versions, and digests.
- Same-origin scripts are cooperative participants, not a hostile-code security boundary. Content compromise can bypass app contracts; CSP/supply-chain security remains separate.
- Unknown browser capability or persisted evidence fails closed. There is no automatic repair, source substitution, lock stealing, or lease fallback.

## Verification evidence

The new deterministic harness is `src/lib/localDatabase/crossContextSourceHandoffSpike.test.ts`. It is a pure test model; it is not exported by production code and makes no browser-implementation claim.

| Command | Result |
|---|---|
| `npm test -- --run src/lib/localDatabase/crossContextSourceHandoffSpike.test.ts` | 373/373 passed, 2.22 s |
| `npm test -- --run src/lib/localDatabase/localFirstCutover.test.ts` | 77/77 passed, 2.41 s |
| `npm test -- --run src/lib/localDatabase/legacyNotesMigration.test.ts` | 150/150 passed, 1.32 s |
| `npm test -- --run src/lib/localDatabase/` | 888/888 passed across 9 files, 2.79 s |
| `npm test -- --run src/lib/recovery` | 70/70 passed across 2 files, 10.32 s |
| `npm run typecheck` | passed, 25.37 s wall time |
| `npm run build` | passed, 10.93 s Vite build; existing dynamic-import and chunk-size warnings only |
| `npm test -- --maxWorkers=4` | 5,166 passed / 7 skipped across 578 passed / 1 skipped files, 196.93 s / 198.7 s wall time |
| `git diff --check` | passed before publication |

Backend tests were not run because no backend file changed. No real-browser evidence was collected for the reasons stated above.

## Residual risks

### Browser support

Target-browser, PWA, storage-bucket, private-mode, and older-browser behavior lacks project-specific evidence. Unsupported environments must remain ineligible.

### Crash semantics

IDB transaction atomicity is browser-provided, but power-loss durability and quota/storage eviction need real-engine failure evidence. No protocol can promise survival beyond the user agent's storage durability.

### Real multi-tab limitations

The deterministic model proves the intended ordering, not Web Locks/IDB integration. Real two-page, reload, background suspension, and process restart tests are K-328 gates.

### Writer migration breadth

Safety holds only after every listed writer and future writer funnels through one mandatory persistence boundary. Static reachability is necessary but not sufficient; code review must reject new bypasses.

### Transaction liveness

K-328 must keep hashing/UI/timers/network outside IDB transactions and test every durable failure boundary.

### Account switching

The lock identity is now unambiguously physical-source-only. Product policy still must define an authorized logical owner transition, but it must update the one root authority under the same physical lock; it may never create an account-keyed lock or parallel authority.

### Maintenance UX

No UI exists. The future UI must flush or abort, display read-only explicitly, and never acknowledge rejected edits.

### Dormant protocol complexity

Durable pending/snapshot/terminal state adds recovery branches. Strict validation and no automatic repair are required.

### Actual defects found and closed in K-327A through K-327G

K-327 initially mixed account scope into the physical lock digest and manually shared a queue. K-327A separates physical exclusion from logical authority. K-327B closes identity aliases and requires strict rehydration. K-327C closes duplicate-key, canonical-byte, missing-evidence, null-prototype, and durable-state gaps. K-327D bounds parsing and makes effects observable. K-327E preserves real rewrite/delete controls, total counters, retry measurement, and monotonic number scanning, but its synthetic combined-root budget did not survive focused review. K-327F replaces that root with separate production-shaped authority/candidate stores, one candidate-owned snapshot, compatible record children, direct coordinator/CAS rejection tests, and UTF-8 early-stop differential proof. K-327G closes the remaining fixture-derived resource claim by enforcing fixed generated candidate/session identifiers, removing 153/154/128-byte valid identifier padding, classifying candidate 504,000 as a rejection ceiling, measuring the 503,794 production high-water, and establishing exact 509,000/509,001 transaction evidence. The production defect remains: current localStorage/legacy-IDB writers are not cross-context serializable, so K-326G continues to block them.

### Unresolved architecture decisions

The authoritative representation is no longer open: K-328 must use separate bounded byte-format-v1 authority and candidate `Uint8Array` values in additive IndexedDB stores. K-328 still must choose exact additive store/index names and establish the browser support floor without weakening this contract.

## Non-goals and runtime safety

K-327 performs no production K-326 eligibility change, source handoff activation, startup/UI wiring, network behavior, K-323 enablement, Notes read-path switch, legacy writer shutdown, source deletion/rewrite, silent write queue, payload logging, restore, migration, cleanup, or production rollout.

## Next action

`K-327G — Focused Identifier and Candidate-Bound Architecture Review`
