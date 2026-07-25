# K-334P09I1 Canonical Descriptor Implementation Authorization Design

## 1. Design Identity and Governing Bindings

| Field | Value |
| --- | --- |
| Type | `K334CanonicalDescriptorImplementationAuthorizationDesign` |
| ID | `K-334P09I1-CANONICAL-DESCRIPTOR-IMPLEMENTATION-AUTHORIZATION-DESIGN-001` |
| Status | `DESCRIPTOR_IMPLEMENTATION_AUTHORIZATION_DESIGN_PROPOSED` |
| Effective authority | `PROPOSAL_ONLY_NO_IMPLEMENTATION_OR_SCHEMA_MUTATION_AUTHORITY` |
| Bound prerequisite proposal | `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` |
| Bound proposal SHA-256 | `E21782092CBB03BDD68D65C4E57D7AC87F14078A60561B9DD1E36F1E5827C92A` |
| Bound prerequisite acceptance | `K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001` |
| Bound blocked D0-P09 SHA-256 | `534826572479E88254C9666971026EB9C1DE6B846EBD00EB4218C8828741E625` |

This design defines a possible implementation-authorization package. Its
existence grants no implementation, schema mutation, proof execution,
runtime, or production authority.

## 2. Source-Fact Audit

Current code was inspected only to identify implementation surfaces. Existing
source behavior is not descriptor authority; the accepted proposal and
acceptance record remain authoritative.

| Existing surface | Classification | Source fact and design consequence |
| --- | --- | --- |
| `frontend/src/lib/localDatabase/schema.ts` | `REQUIRES_STRICT_EXTENSION` | Owns the current imperative v0-v4 schema construction, private index helper, and v4 upgrade. A future Layer B would need an exact descriptor-driven extension, but this package must not modify or import the mutator. |
| `frontend/src/lib/localDatabase/types.ts` | `OUT_OF_SCOPE` | Owns live `absinthe-local-v2` and version `4` constants. The accepted v4/v5 descriptor values cannot be derived from mutable live constants or used to increment them in this package. |
| `frontend/src/lib/localDatabase/repository.ts` | `OUT_OF_SCOPE` | Opens the live database at `LOCAL_DATABASE_VERSION`, invokes `createLocalDatabaseSchema`, and is runtime-capability reachable. It must not import or call the proposed mechanisms. |
| `frontend/src/lib/localDatabase/dormantWriterCoordinationRepository.ts` | `OUT_OF_SCOPE` | Contains a separate explicit open/upgrade boundary. It is not a descriptor snapshot or schema authority. |
| `frontend/src/lib/localDatabase/crossContextHandoff/database.ts` | `ABSINTHE_SPECIFIC_ADAPTER` | Its private exact-schema inspection demonstrates ordinary read-only access to store/index metadata, but it is bound to a different database and cannot be generalized or imported. |
| `frontend/src/lib/localDatabase/protocol/canonicalProtocolValue.ts` | `REUSABLE_ONLY_FOR_BOUNDED_PROTOCOL_VALUES_NOT_COMPLETE_DESCRIPTOR` | Its strict plain-data handling, deterministic encoding behavior, UTF-8 handling, hostile-object rejection, and preserved array order remain useful as a behavioral reference or optional small-value test cross-check. Its hard 32 KiB output limit makes it unsuitable for the complete accepted descriptor, whose `stores` and `indexes` arrays alone are 35,960 UTF-8 bytes. Future descriptor reconstruction must not call it, and its source file remains unchanged. |
| `frontend/src/lib/localDatabase/protocol/strictProtocolDecode.ts` | `REUSABLE_WITHOUT_SEMANTIC_CHANGE` | Provides exact-object, literal, enum, integer, tuple/array, duplicate, and unknown-field rejection within sufficient existing bounds. Descriptor-specific schemas remain in the new adapter. |
| `frontend/src/lib/localDatabase/protocol/protocolResult.ts` | `REQUIRES_STRICT_EXTENSION` | Its general errors do not contain the accepted descriptor classification reasons. Existing codes must not be changed; the new module needs a bounded descriptor-specific result union. |
| `frontend/src/lib/localDatabase/protocol/canonicalProtocolPreimage.ts` | `REQUIRES_REPLACEMENT` | Its registered-domain/version/length frame is intentionally different from the accepted descriptor domain + `0x00` + bytes frame and must not be called for descriptor digesting. |
| `frontend/src/lib/localDatabase/outboxIdentity.ts` | `OUT_OF_SCOPE` | Contains a synchronous string SHA-256 implementation owned by outbox identity. Descriptor code must not create semantic coupling to it. |
| `frontend/src/lib/localDatabase/crossContextHandoff/canonical.ts` | `OUT_OF_SCOPE` | Contains a Web Crypto digest helper scoped to the handoff module. The implementation may use the same browser primitive directly but must not import across that ownership boundary. |
| `frontend/src/lib/localDatabase/validation.ts` | `ABSINTHE_SPECIFIC_ADAPTER` | Demonstrates fail-closed scalar and record validation but is persisted-row oriented and cannot validate descriptor configuration. |
| `frontend/src/lib/localDatabase/legacyNotesMigration.ts` and `localFirstCutover.ts` | `OUT_OF_SCOPE` | These are migration/recovery orchestration and must remain unchanged and unreachable from the package. |
| `frontend/src/lib/localDatabase/localDatabase.test.ts` and `dormantWriterCoordinationRepository.test.ts` | `REUSABLE_WITHOUT_SEMANTIC_CHANGE` | Establish fake-indexeddb fixture, cleanup, previous-version, no-network, no-localStorage, and static dormancy test conventions. Their production subjects are not descriptor authority. |
| `frontend/src/lib/localDatabase/crossContextHandoff/crossContextHandoffDormancy.test.ts` | `REUSABLE_WITHOUT_SEMANTIC_CHANGE` | Establishes repository-wide source reachability and forbidden-import audit conventions. |
| `frontend/scripts/run-k328-browser-tests.mjs` | `ABSINTHE_SPECIFIC_ADAPTER` | Demonstrates a temporary-profile real-Chrome/Vite/CDP evidence pattern. K-334 needs a separate bounded fixture and runner, not imports from or edits to K-328. |
| Shared existing metadata snapshot helper | `NOT_FOUND` | No reusable helper produces the accepted full IndexedDB metadata shape with exact normalization and bounded descriptor outcomes. |
| Shared RFC 8785 descriptor digest helper with accepted framing | `NOT_FOUND` | No existing helper owns exactly the accepted descriptor framing; it must be implemented locally without a dependency. |

The current `schema.ts` confirms the accepted predecessor source facts: v4 has
the reviewed nine stores and 22 indexes. That observation does not replace the
accepted predecessor baseline embedded in the descriptor configuration.

## 3. Implementation Package Decision

Disposition: `ONE_BOUNDED_IMPLEMENTATION_PACKAGE`.

The smallest coherent package implements only:

- `ACCEPTED_DESCRIPTOR_CONFIGURATION_INPUT_V1`;
- `RECONSTRUCT_ACCEPTED_DESCRIPTOR_V1`;
- `DESCRIPTOR_PHYSICAL_METADATA_PROJECTION_V1`;
- `FRESH_INDEXEDDB_METADATA_SNAPSHOT_V1` over a caller-owned open connection;
- `COMPARE_DESCRIPTOR_PROJECTION_TO_METADATA_V1`;
- externally committed-state portions of `K334_DESCRIPTOR_INSTALLATION_STATE_V1`;
- document/configuration conformance and physical verification results; and
- static and dynamic proof that these mechanisms create no rows and mutate no schema.

It excludes schema creation, a versionchange mutator, live database opening,
barrel exports, repository integration, migration/checkpoint/marker behavior,
ROW/MAP codecs, evidence/audit writes, head reconstruction, D0-P09 execution,
and production activation. Splitting these pure/read-only mechanisms into
separate authorization packages would add drift at their shared type and
projection boundaries without improving data safety.

## 4. Authorization-Layer Separation

| Layer | Design disposition |
| --- | --- |
| `DESCRIPTOR_MECHANISM_IMPLEMENTATION_AUTHORITY` | May be proposed later for the exact bounded package in this document. It is not granted here. |
| `DESCRIPTOR_SCHEMA_MUTATION_IMPLEMENTATION_AUTHORITY` | Excluded. Requires a later separate authorization after mechanism conformance. |
| `D0_P09_EXECUTION_AUTHORITY` | Excluded and remains blocked. Requires later rebound after accepted implementation closure. |

Layer A produces declarations, proofs, snapshots, and classifications only.
It must not be able to call Layer B. Layer C must never be inferred from Layer
A or B completion.

## 5. Reusable Core and Absinthe-Specific Boundary

The package reuses existing strict decode primitives. It does **not** reuse
`encodeCanonicalProtocolValue` for the complete descriptor: that helper's
32 KiB bound is below the accepted descriptor's independently measured
43,010 canonical UTF-8 bytes. It adds no generic framework. A small private
mechanism boundary inside the descriptor module may:

- detach and deep-freeze validated plain data;
- encode the already-validated descriptor through the profile-limited
  `PRIVATE_DESCRIPTOR_LOCAL_RFC8785_ENCODER_V1` defined below;
- frame an already canonical byte array with supplied domain bytes and one
  `0x00` byte;
- digest copied bytes with `crypto.subtle.digest('SHA-256', ...)`;
- encode the digest as lowercase hex;
- compare byte arrays and UTF-8 byte ordering; and
- return bounded, payload-free failures.

Those private helpers contain no Absinthe store names, ROW/MAP/C identifiers,
state labels, D0 authority, or eligibility logic. They are not exported as a
new general-purpose framework.

The sole Absinthe-specific adapter is
`k334PhysicalSchemaDescriptor.ts`. It owns the exact 23-key root,
descriptor identity/version/revision, `absinthe-local-v2`, v4/v5 versions,
9-store/22-index predecessor baseline, 17 target stores, 38 dispositions,
C03 exclusion, ROW/MAP bindings, dependencies, transaction group, policies,
proof layers, authority exclusions, accepted state labels, the private
descriptor-profile encoder and resource counters, and bounded failure names.

No accepted fact may be independently re-declared in the metadata adapter or
tests. Tests consume the configuration and use independently fixed expected
vectors only for conformance assertions.

## 6. Static Configuration Representation

Choose one hand-authored literal validated at module initialization.

`ACCEPTED_K334_DESCRIPTOR_CONFIGURATION` is one `as const satisfies` literal
containing the four-field configuration envelope, complete root, and complete
predecessor baseline. A strict validator snapshots it into a recursively
frozen plain-data value before export. The raw literal is not exported.

Required safeguards:

- compile-time literal narrowing and exhaustive TypeScript shapes;
- runtime exact-own-object validation at every nesting level;
- exact required field count and unknown/inherited/accessor/symbol rejection;
- safe-integer and negative-zero rejection;
- explicit null versus omission checks;
- exact lengths 17 and 38 and exact ordinal/C-ID sequences;
- duplicate store identity/name, owner-index name, ROW, MAP, and C-ID rejection;
- exact array ordering and key-path component preservation;
- exact C03 excluded representation and exact installable disposition counts;
- no environment-variable, mutable global, database observation, user,
  project, device, session, or namespace-value input; and
- same descriptor ID with non-identical canonical bytes reported as conflict.

Projection is generated from this validated value. There is no second target
store/index table.

## 7. Canonicalization and Reconstruction Design

`reconstructAcceptedK334Descriptor(input)` accepts an unknown configuration
value and returns a promise of a bounded result. It must:

1. validate the four-field envelope;
2. validate the exact root and every nested schema;
3. verify inventories, uniqueness, counts, and normative order;
4. construct a detached canonical descriptor value;
5. encode it only through the private
   `PRIVATE_DESCRIPTOR_LOCAL_RFC8785_ENCODER_V1`;
6. prove through fixed tests that this accepted data profile is
   `RFC8785_EQUIVALENT_FOR_K334_DESCRIPTOR_PROFILE_V1`, including
   object-order and string escaping vectors;
7. UTF-8 encode the accepted domain, append exactly one `0x00`, then append
   canonical descriptor bytes;
8. digest a copied preimage using browser/Node Web Crypto SHA-256; and
9. lowercase-hex encode exactly 64 characters.

The existing `canonicalProtocolPreimage.ts` frame is prohibited. No new npm
dependency is needed. Web Crypto is already required by the browser target and
available in the supported Vitest runtime. Unsupported crypto, invalid JSON
values, resource-limit failures, or digest failures return stable bounded
errors without cause, stack, raw configuration, or database values.

The function has no IndexedDB/storage/network access. The implementation review
must supply an independently generated fixed full-descriptor byte and digest
test vector; expected bytes/digest must not be computed by the function under
test.

### 7.1 Descriptor-local encoder, accepted profile, and RFC 8785 boundary

The one selected implementation decision is
`PRIVATE_DESCRIPTOR_LOCAL_RFC8785_ENCODER_V1`. It is private to
`k334PhysicalSchemaDescriptor.ts`, side-effect free, unexported unless a
bounded test-only seam is strictly necessary, independent of IndexedDB and
runtime namespace values, and contains no authority decision beyond encoding
the already-validated descriptor. It is not a shared canonicalization framework.

Its exact accepted profile is
`RFC8785_EQUIVALENT_FOR_K334_DESCRIPTOR_PROFILE_V1`. It accepts only detached
plain exact objects, dense arrays, NFC-valid Unicode strings, safe integers,
booleans, and `null`. Every descriptor number is validated before encoder
entry: it is an integer in `[-9007199254740991, 9007199254740991]`, is not
`-0`, and is serialized by `String(value)` in ordinary base-10 integer form.
Fractional, non-finite, unsafe, and negative-zero numbers are rejected; there
is no exponent-form choice in the accepted profile.

The encoder rejects without normalization or repair: `undefined`, `bigint`,
`NaN`, either infinity, functions, symbols, dates, maps, sets, typed arrays,
array buffers, class instances, unsupported prototypes, sparse arrays,
inherited properties, accessors, symbols, cycles, and duplicate logical keys.
Strings and keys must already be NFC and contain no lone surrogate; malformed
Unicode is `INVALID_UNICODE`, never replacement text. Exact-object validation
means duplicate logical keys cannot arise in accepted input; a hostile object
whose own keys are not one-to-one exact strings fails before encoding.

`RAW_VALIDATED_UTF8_CONTENT_BYTES_V1` is the sole scalar/key resource-accounting
rule. After Unicode validity and NFC conformance validation, and without
performing normalization, one exact UTF-8 encoder measures the raw Unicode
scalar sequence: a value string is limited to 128 inclusive bytes and an
object key to 64 inclusive bytes. Quotation marks and JSON escape expansion
do not count toward those two scalar caps; exactly 128/64 bytes pass and
129/65 bytes fail. Malformed Unicode fails before the byte comparison, and no
truncation or normalization is permitted. The resulting quoted/escaped JSON
token can be larger than the raw scalar cap, but every such byte counts toward
the separate 65,536-byte canonical-output cap.

For this profile, canonical text has no whitespace; booleans and null are the
lowercase JSON literals; arrays preserve declared order; and strings use the
single JSON-compatible escaping representation produced by `JSON.stringify`
only after Unicode validation. Quotation marks, reverse solidus, control
characters (including newline, tab, and carriage return), BMP characters, and
well-formed supplementary characters therefore receive JSON-compatible
escaping without silent Unicode replacement. UTF-8 encoding occurs only after
the complete canonical JSON text is built.

Object keys use RFC 8785/JCS UTF-16-code-unit lexicographic ordering, not
unsigned UTF-8 ordering, `localeCompare`, case folding, or normalization. The
accepted descriptor's own field names are fixed ASCII, so this ordering choice
does not alter its reviewed bytes; hostile profile tests nevertheless cover
ASCII prefixes, upper/lowercase differences, numeric-looking keys, non-ASCII
keys, and surrogate validity. Array order is never sorted. Independent vectors
must prove the profile behavior rather than asserting unrestricted RFC 8785
support.

`DETERMINISTIC_CANONICAL_FAILURE_SELECTION_V1` defines one bounded first
failure for the same logical graph and limits, independent of object insertion
order, own-key enumeration history, engine, or prior validation attempt. For
an object the encoder performs this exact sequence before child recursion:

1. validate accepted plain-object form, then reject an unsupported prototype;
2. reject symbol keys, inspect all own descriptors, and reject an accessor or
   non-data/unsupported descriptor form in ascending UTF-16 code-unit order of
   the applicable string key (symbol-key rejection precedes that ordering);
3. collect every own string key, validate each key's Unicode/profile in
   UTF-16 code-unit order, then sort valid keys with the JCS comparator;
4. perform raw key-byte checks in that sorted order; and
5. recursively validate and emit each child in that same sorted order.

Arrays are structurally checked as dense before children. The depth and
container counters are checked first, then length against the per-array limit,
then the cumulative array-element counter; children are recursively visited in
ascending numeric index order from `0` through `length - 1`.

The global precedence is exact: (A) current-edge graph/path-independent
structural failures, in order unsupported prototype, symbol key, descriptor
form/accessor, sparse array, then cycle; (B) current-container resource
failures, in order depth, per-array elements, total properties, total array
elements, then visited nodes; (C) sorted-key failures, invalid Unicode then
raw key-byte cap; (D) sorted object child or ascending array child failures;
and (E) canonical-output and fragment limits at the attempted token append,
with `CANONICAL_FRAGMENT_LIMIT_EXCEEDED` checked before
`CANONICAL_OUTPUT_TOO_LARGE` when one append would cross both. Thus a
structural defect wins over every child defect, an oversized key wins over its
child, and insertion order never selects a child failure.

| Precedence | Check order within the level | Bounded result family |
| --- | --- | --- |
| A | unsupported prototype; symbol key; non-data/accessor descriptor; sparse array; cycle | `UNSUPPORTED_CANONICAL_VALUE`, `CYCLIC_CANONICAL_VALUE` |
| B | depth; per-array elements; total properties; total array elements; visited nodes | depth/array/property/node limit result |
| C | sorted key Unicode; sorted raw key bytes | `INVALID_UNICODE`, `CANONICAL_KEY_LIMIT_EXCEEDED` |
| D | sorted object child; ascending numeric array child | that child's first bounded result |
| E | fragment count; canonical output bytes at attempted append | `CANONICAL_FRAGMENT_LIMIT_EXCEEDED`, `CANONICAL_OUTPUT_TOO_LARGE` |

### 7.2 Resource, failure, and vector contract

> Historical-status notice: the measurement and temporary-derivation narrative
> below is retained only as prior design history. Sections 24-41 supersede its
> topology/count/script provenance with one derivation from the accepted JSON
> artifact and control every current I1 topology, checksum, count, and margin
> assertion.

`K334_DESCRIPTOR_CANONICALIZATION_LIMITS_V1` is fixed and inclusive:

| Limit | Exact value | Accepted descriptor measurement | Remaining margin |
| --- | ---: | ---: | ---: |
| Canonical UTF-8 bytes | 65,536 | 43,010 | 22,526 |
| Visited nodes | 2,048 | 1,418 | 630 |
| Total object properties | 1,024 | 977 | 47 |
| Total array elements | 512 | 440 | 72 |
| Per-array elements | 64 | 38 | 26 |
| Nesting depth from root (`root = 0`) | 8 | 4 | 4 |
| Value-string raw validated UTF-8 content bytes | 128 | 81 | 47 |
| Object-key raw validated UTF-8 content bytes | 64 | 29 | 35 |
| Canonical fragments | 8,192 | 2,580 | 5,612 |

The measurements are independent fixed expectations for the exact accepted
descriptor. The 81-string-byte and 29-key-byte measurements use exactly
`RAW_VALIDATED_UTF8_CONTENT_BYTES_V1`, not escaped token bytes; implementation
tests must independently reproduce them with that definition. A node is the
root plus every object, array, scalar, and null; object keys do not count as
nodes and instead count toward total properties; array elements count
separately; depth increments on descent from the root. Counters increment
before descent or emission and all limits are inclusive. The failure ordering
is the exact precedence in Section 7.1. The same descriptor ID/version/revision
may not grow beyond its fixed accepted bytes; larger content requires new
reviewed descriptor authority.

The selected strategy is `BOUNDED_BUFFERED_CANONICALIZATION`. The encoder uses
bounded UTF-8-accounted string fragments and one final join, never repeated
whole-text concatenation. `K334_DESCRIPTOR_MAX_CANONICAL_FRAGMENTS_V1` is
8,192 inclusive. One fragment is one deterministic append of an immutable
canonical text segment: a container opening, an object-property prelude
(optional comma plus quoted/escaped key and colon), a scalar token (with an
optional array comma), or a container close. This is independent of any
engine string-builder chunking. The accepted descriptor independently measures
2,580 fragments: 185 container openings + 977 property preludes + 1,233 scalar
tokens + 185 container closes. (The 1,233 scalar tokens are the 1,418 measured
nodes less the 185 containers.) The resulting 5,612-fragment margin is fixed.
Each final fragment's UTF-8 length is known before append; an append
that would exceed either cap fails before retention, has no deferred escaping,
and cannot expose partial joined output.

`ARRAY_CHILD_COMMA_PREFIX_FRAGMENT_RULE_V1` fixes array punctuation grouping.
For child index `i = 0`, emit its ordinary first fragment: a scalar token,
`{`, or `[`. For every `i > 0`, prefix exactly one comma to that child's first
fragment, regardless of whether the child is a string, number, boolean, null,
object, or array. Thus non-first scalar children use one fragment such as
`,"text"`, `,123`, `,true`, `,false`, or `,null`; a non-first object begins
with exactly `,{`; and a non-first nested array begins with exactly `,[`.
There is never a standalone array-comma fragment, a standalone `{` after `,`,
or a standalone `[` after `,`. The ordinary deterministic object or nested
array schedule then continues unchanged.

Every array, including an empty array, uses two separate fixed fragments:
its ordinary opening `[` (or `,[` when it is a non-first array child) and one
closing `]`. The closing fragment never absorbs a comma, is emitted once after
all children, and counts once. This applies identically at every nesting depth
and preserves the accepted 2,580-fragment measurement.

For example, `[1,{"a":2}]` emits exactly `[`, `1`, `,{`, `"a":`, `2`, `}`,
`]`. Nested arrays follow the same rule: `[[],[1]]` emits exactly `[`, `[`,
`]`, `,[`, `1`, `]`, `]`. These examples are normative fragment schedules, not
an alternate serialization representation.

The complete normative schedule for `[1,[2,3]]` is `[`, `1`, `,[`, `2`, `,3`,
`]`, `]` (seven fragments). The complete normative schedule for `[1,[]]` is
`[`, `1`, `,[`, `]`, `]` (five fragments). The complete normative schedule for
`[1,{"a":2},[3],null]` is `[`, `1`, `,{`, `"a":`, `2`, `}`, `,[`, `3`, `]`,
`,null`, `]` (eleven fragments). Each shows the entire array punctuation
schedule: no standalone comma fragment exists.

#### Historical provisional fragment-count provenance

The following former `INDEPENDENT_VECTOR_PROVENANCE_V1` record is
`SUPERSEDED_BY_ACCEPTED_ARTIFACT_DERIVATION`; it is not current evidence. It
formerly selected
`TWO_INDEPENDENT_MATCHING_DERIVATIONS` for the fragment count. The bounded
input was the detached accepted-descriptor topology representation with SHA-256
`EE624658E1CA3A9F476C1A5A34830E3F7539248D175FC9FC8D0BE1213D8C2F6E`:
descriptor proposal `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001`, acceptance
`K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001`, descriptor
`K-334-CANONICAL-PHYSICAL-SCHEMA-001` / version `1` /
`K334_PHYSICAL_SCHEMA_REVISION_1`, and
`ARRAY_CHILD_COMMA_PREFIX_FRAGMENT_RULE_V1`. It is bound to the authoritative
proposal SHA-256 `E21782092CBB03BDD68D65C4E57D7AC87F14078A60561B9DD1E36F1E5827C92A`
and the pre-correction design SHA-256
`25202C6DA7CC1ADECC8B75718AE6133A53F7CEC742E08D7C8E4431516E438AF6`.

Derivation A, `A-recursive-topology-traversal-v1`, was an in-memory Node
`v24.14.0` recursive traversal of the detached topology; temporary script
SHA-256 `6C493379BCFCD46E7BEECA8CA76D4E8E2C7C525E5808F0A3565195DF0D091446`;
invocation `PowerShell here-string | node -`; result `2,580`. It imported no
production, reconstruction, digest, or reference helper. Derivation B,
`B-closed-form-inventory-invariant-v1`, was independently authored in-memory
Node `v24.14.0` arithmetic over the same detached input; temporary script
SHA-256 `D8E7E095B6017B866A5C5A7AF265B36563503A5E57C8CBAD2C7BC665FF1BEE95`;
the same invocation; result `2,580`. It did not import or consume A or any
production helper. Those historical scripts and aggregate-topology evidence are
superseded by the accepted-artifact derivation in Sections 26-34. Temporary
derivation scripts and outputs are not retained, committed, or in the six-file
implementation scope.

The total canonical UTF-8 counter includes every final encoded byte: braces,
brackets, commas, colons, quotation marks, reverse solidi, escaped controls,
keys, value strings, numbers, booleans, and null. The 65,536-byte cap is
inclusive and rejects before returning output. `CANONICAL_FRAGMENT_LIMIT_EXCEEDED`
returns no canonical output or digest, no fragment data, and blocks
reconstruction, projection, and classification.

The conservative logical retained-payload ceiling is 327,788 bytes, excluding
JavaScript engine string/object overhead: 65,536 fragment text + 65,536 final
joined text + 65,536 canonical UTF-8 bytes + 65,590 framed bytes + 65,590
copied Web Crypto input. It applies even if garbage collection does not run.
The fragment-reference array has at most 8,192 entries; traversal has at most
depth+1 frames, cycle tracking at most 2,048 entries, sorted-key arrays at
most 1,024 properties (and one object's own bounded property count), and path
components at most the depth bound. These are count bounds, not heap-byte
claims. The deterministic sequence is validate/build fragments, join, release
fragment references where implementation permits, UTF-8 encode, frame, release
canonical text where permitted, pass a copied or safely isolated frame to Web
Crypto, then release temporary bytes after digest completion. Correctness may
not depend on any release or garbage-collection timing.

Failures are bounded and return no partial canonical bytes, no digest, no raw
value dump, and no relaxation advice:
`CANONICAL_OUTPUT_TOO_LARGE`, `CANONICAL_NODE_LIMIT_EXCEEDED`,
`CANONICAL_PROPERTY_LIMIT_EXCEEDED`, `CANONICAL_ARRAY_LIMIT_EXCEEDED`,
`CANONICAL_DEPTH_LIMIT_EXCEEDED`, `CANONICAL_STRING_LIMIT_EXCEEDED`,
`CANONICAL_KEY_LIMIT_EXCEEDED`, `CANONICAL_FRAGMENT_LIMIT_EXCEEDED`,
`UNSUPPORTED_CANONICAL_VALUE`,
`INVALID_UNICODE`, and `CYCLIC_CANONICAL_VALUE`. Reconstruction failure blocks
projection and classification; digest failure is separately mapped to the
existing bounded reconstruction failure result without exposing a cause.

`INDEPENDENT_VECTOR_PROVENANCE_V1` permits fixed complete-descriptor vectors
only through either `TWO_INDEPENDENT_MATCHING_DERIVATIONS` (two independently
implemented derivations that neither import production/reconstruction helpers
nor each other, with identical bytes, digest, and measurements) or
`SEPARATELY_REVIEWED_REFERENCE_IMPLEMENTATION` (an RFC-8785-compatible
reference whose relevant profile and measurement procedure are separately
reviewed, independently verified, and archived). A single unreviewed script is
insufficient. Neither derivation may import `k334PhysicalSchemaDescriptor.ts`,
its private encoder, production reconstruction/digest helpers, production-made
fixtures, or `encodeCanonicalProtocolValue` for the complete descriptor, nor
share copied traversal/accounting code with production. Shared third-party
libraries count only under the separately reviewed-reference option.

Every fixed vector archives its option; tool/implementation name; immutable
version, commit, or artifact digest; runtime and relevant environment; exact
input SHA-256; accepted proposal/configuration identity; invocation; canonical
length and bytes/checksum; descriptor and separately recorded framed-preimage
digests; every node/property/array/depth/string/key/fragment measurement; and
review-record identity. Immutable expected literals may live only in
`k334PhysicalSchemaDescriptor.test.ts`, must not be regenerated at runtime,
and must carry this provenance in comments or the later closure record.

Tests additionally require insertion-order-independent multi-defect objects
(two over-limit children; invalid Unicode plus unsupported number; cycle plus
oversize; oversized key plus invalid child; nested invalid descendants), and
multi-defect arrays whose lowest index wins after container checks. They cover
raw 128/129 value bytes, raw 64/65 key bytes, expanded escaped tokens, escaped
output overflow, the accepted fragment count/margin, exact/one-over fragment
limits, fragment/output precedence, no output/digest after fragment failure,
and conservative logical-payload arithmetic without process-heap measurement.

`encodeCanonicalProtocolValue` may optionally cross-check small values below
32 KiB that belong to both profiles, but it must not encode the complete
descriptor, determine any fixed descriptor vector, serve as the sole oracle,
or be called by production reconstruction. `canonicalProtocolValue.ts` is not
modified.

## 8. Physical Metadata Projection Design

`projectAcceptedK334PhysicalMetadata(reconstruction)` is pure and derives:

- database name and source/target versions;
- exact predecessor store/index projection from the accepted baseline;
- target store names, ordered key paths, `autoIncrement`, and installable
  index-name membership directly from `stores` and `indexes`;
- every installable index owner/name/key path/`unique`/`multiEntry`;
- C03 exclusion; and
- `ALL_UNLISTED_INDEXES_PROHIBITED`.

It verifies each installable index has one accepted owner, every owner exists,
all 17 stores appear once, 37 installable indexes appear once, C03 appears
once only as excluded, and predecessor and target names do not conflict.
Set-like output names are copied and sorted by unsigned UTF-8 bytes; declared
construction arrays retain normative order. It filters out all row, codec,
MAP, lifecycle, reference, authority, and digest-as-metadata fields.

Projection failure is `PROJECTION_DERIVATION_FAILED`; no fallback table is
allowed.

## 9. Fresh Metadata Snapshot Design

`snapshotK334IndexedDbMetadata(db)` accepts one caller-owned, already-open
`IDBDatabase`. The package must not open a database because an open without a
version can create a missing database and an open with v5 can trigger upgrade.
Open/create/upgrade authority therefore remains outside Layer A.

For each classification attempt the function creates one fresh `readonly`
transaction over the copied complete store-name set when non-empty. It copies,
without row requests:

- `db.name`, `db.version`, and `db.objectStoreNames`;
- each store's name, keyPath, `autoIncrement`, and `indexNames`; and
- each index's name, keyPath, `unique`, and `multiEntry`.

Ordinary read-only transaction metadata is sufficient. A versionchange
transaction is neither required nor allowed: schema metadata is exposed by
`IDBDatabase`, `IDBObjectStore`, and `IDBIndex`; a live connection retains its
version while an upgrade waits for prior connections to close. The function
records a concurrent `versionchange` notification as
`METADATA_SNAPSHOT_FAILED` and returns no partial snapshot.

Normalization copies DOMStringList values, rejects duplicates, and sorts
membership-only names by unsigned UTF-8 bytes. Key paths remain exact `string`,
ordered `string[]`, or `null`; string and one-element array differ; absent
metadata is not normalized to null. Booleans compare exactly. No locale, case,
Unicode, or heuristic normalization is allowed.

The implementation uses a fixed bounded completion timeout for the read-only
transaction, removes its temporary event listener, and returns
`METADATA_SNAPSHOT_FAILED` for transaction/versionchange/timeout/access errors.
It never calls `get`, `getAll`, `count`, cursor methods, or any write method.
Because the function does not own the connection, it must not close it; every
integration/browser fixture owns and closes its connection in `finally`.

## 10. Comparator and State Classifier Design

The operation context is exactly:

- `initial_classification`;
- `post_install_verification`; or
- `reopen_retry_classification`.

The result union is exactly:

- `EXACT_ACCEPTED_DESCRIPTOR_PREDECESSOR_V4`;
- `EXACT_ACCEPTED_DESCRIPTOR_TARGET_V5`;
- `EXACT_ACCEPTED_DESCRIPTOR_RETRY_V5`; or
- `CONFLICTING_OR_PARTIAL_STATE` with one bounded reason.

Bounded reasons are exactly those accepted by the prerequisite:
`ACCEPTED_CONFIGURATION_UNAVAILABLE`, `CONFIGURATION_SCHEMA_INVALID`,
`DESCRIPTOR_DIGEST_MISMATCH`, `SAME_ID_DIFFERENT_BYTES`,
`UNACCEPTED_DESCRIPTOR_CONFIGURATION`, `PROJECTION_DERIVATION_FAILED`,
`METADATA_SNAPSHOT_FAILED`, `PHYSICAL_METADATA_MISMATCH`,
`UNEXPECTED_K334_SCHEMA_OBJECT`, and `PARTIAL_TARGET_PROJECTION`.
Diagnostics may add only a bounded field category/ordinal, never raw names,
configuration, rows, exceptions, or stack.

Comparison order is configuration conformance, reconstructed identity/digest,
database name/version, complete accepted store membership, predecessor/target
membership, store key path and `autoIncrement`, exact per-store index names,
index key path/`unique`/`multiEntry`, C03 absence, and unlisted-index absence.
Every set comparison first uses the fixed normalization. No subset, first,
fallback, or best-effort match exists.

Exact physical v5 plus `post_install_verification` maps to
`POST_INSTALL_V5_EXACT_STATE` and
`EXACT_ACCEPTED_DESCRIPTOR_TARGET_V5`. The same physical match plus
`reopen_retry_classification` maps to `EXACT_V5_RETRY_STATE` and
`EXACT_ACCEPTED_DESCRIPTOR_RETRY_V5`. Exact v4 maps only to
`PRE_INSTALL_V4_EXPECTED_STATE`. The type contains
`IN_TRANSACTION_TARGET_CONSTRUCTION`, but no Layer A public function can
produce it; only a future authorized Layer B versionchange implementation may
enter that internal state. All other committed states are conflict/partial.

## 11. Schema-Mutation Boundary Decision

`MECHANISMS_ONLY_NO_SCHEMA_MUTATION`

A dormant mutator is unnecessary for proving configuration, reconstruction,
projection, metadata normalization, and comparison. Including one would create
real schema-changing capability before a separate authority decision and would
couple Layer A to the live database version/open path.

The package must not modify `types.ts`, `schema.ts`, `repository.ts`, any barrel,
startup, migration, recovery, worker, or UI file. It must not export a
versionchange callback, call `createObjectStore`/`createIndex`, increment
`LOCAL_DATABASE_VERSION`, or open `absinthe-local-v2`.

## 12. No-Row-Creation Enforcement

For this mechanisms-only package,
`DESCRIPTOR_INSTALLATION_CREATES_NO_AUTHORITY_ROWS_V1` remains a future Layer B
requirement. Layer A proves the stronger immediate fact that it performs no
database or web-storage writes at all.

Static tests must scan the proposed production files and reject:
`indexedDB.open`, `createObjectStore`, `createIndex`, readwrite/versionchange
transactions, `add`, `put`, `delete`, `clear`, cursor mutation, localStorage,
sessionStorage, network, workers, timers other than the bounded snapshot
timeout, and imports from repository/schema/migration/recovery/runtime modules.
The metadata adapter may contain only caller-owned `readonly` transaction and
metadata-property access.

Instrumented tests must prove zero row requests, zero schema changes, zero
storage calls, zero authority-state changes, and unchanged object counts.
Schema fixtures may create isolated temporary stores/indexes but must never
seed authority rows.

## 13. Implementation Conformance Proof

The bounded proof package must include:

1. **Configuration:** exact root/nested validation, exact 17/38 counts and
   order, C03 form, duplicates/omissions/unknown fields, safe integers/nulls,
   same-ID different-content conflict, deep immutability.
2. **Canonicalization:** independent complete-descriptor bytes/digest and
   framed-preimage vectors; `PRIVATE_DESCRIPTOR_LOCAL_RFC8785_ENCODER_V1`;
   accepted-profile RFC 8785 vectors; insertion-order invariance; array-order
   digest change; framing; lowercase hex; hostile/unsupported value rejection;
   exact-at-limit and one-over-limit byte/node/property/array/depth/string/key
   failures under `RAW_VALIDATED_UTF8_CONTENT_BYTES_V1`; escaped-token output
   accounting; sorted-key and ascending-array first-failure selection;
   structural-before-child and fragment-before-output multi-defect precedence;
   exact-at-limit and one-over-limit fragment failures; no partial bytes; and
   no digest after a canonicalization failure. Complete fixed vectors require
   `INDEPENDENT_VECTOR_PROVENANCE_V1`, including their option, immutable tool,
   runtime, input, output, measurement, and review provenance.
   Fragment tests additionally cover every non-first scalar token, non-first
   empty/populated object, non-first empty/populated nested array, multiple
   nesting depths, mixed scalar/object/array/null arrays, and multiple
   container-valued non-first children. They prove no standalone array comma,
   no comma on the first child, exactly one comma-prefixed first fragment for
   every later child, and insertion-order-invariant counts. The immutable
   complete-descriptor expectation is `2,580`, copied only from the accepted
   rule-bound provenance above; it is never regenerated by production code,
   temporary scripts, or `canonicalProtocolValue` at test runtime.
3. **Projection:** complete 9/22 predecessor and 17/37 target projection,
   owner membership, C03 exclusion, unlisted policy, no semantic fields, no
   duplicated physical table.
4. **Snapshot:** DOMStringList normalization, key-path category/order,
   null/absent and boolean equality, duplicate names, versionchange/timeout/
   transaction failure, fresh call, zero row requests.
5. **Comparator:** exact v4, exact post-install v5, retry v5, all bounded
   mismatch classes, every physical field mismatch, unexpected store/index,
   C03, subset, same projection/unaccepted descriptor, context-sensitive v5.
6. **Side effects/dormancy:** no writes, no open/upgrade, no localStorage/
   network/runtime import, no barrel export or external production caller.

Focused commands must run the two unit/integration tests, the native browser
runner, typecheck, build, `git diff --check`, and a static import/reachability
audit. Broad unrelated application tests are not an implementation acceptance
criterion unless the independent reviewer identifies a concrete interaction.

## 14. IndexedDB Integration and Browser Evidence

Fake-indexeddb is sufficient for deterministic unit coverage of copied metadata
shapes and mismatch classification, but not by itself for final conformance:
native DOMStringList, keyPath exposure, transaction completion, and
versionchange notification are browser-owned behaviors.

The exact real-Chrome matrix uses randomized temporary database names and no
rows:

- exact v4 physical fixture;
- exact v5 physical fixture;
- partial v5 fixture;
- wrong key-path/index-flag fixture;
- C03-present fixture;
- unknown-store and unknown-index fixtures;
- close/reopen after simulated uncertain outcome;
- versionchange-during-snapshot failure; and
- connection close plus database deletion proving cleanup.

The browser harness may create only isolated test schema fixtures, never the
live `absinthe-local-v2` database and never authority rows. It must use a fresh
temporary browser profile and close pages/connections/server/profile in
`finally`.

## 15. Exact Source File Plan

| Proposed path | Status / boundary | Exported API and necessity | Test |
| --- | --- | --- | --- |
| `frontend/src/lib/localDatabase/protocol/k334PhysicalSchemaDescriptor.ts` | New; Absinthe-specific | Exports validated frozen configuration, descriptor/projection/result types, `validateAcceptedK334DescriptorConfiguration`, `reconstructAcceptedK334Descriptor`, `projectAcceptedK334PhysicalMetadata`, and `compareK334DescriptorProjectionToMetadata`. Privately implements `PRIVATE_DESCRIPTOR_LOCAL_RFC8785_ENCODER_V1`, fixed resource enforcement, accepted configuration, reconstruction, digest, projection, comparator, and committed-state classifier. | `k334PhysicalSchemaDescriptor.test.ts` |
| `frontend/src/lib/localDatabase/protocol/k334IndexedDbMetadata.ts` | New; narrow IndexedDB adapter | Exports snapshot types and `snapshotK334IndexedDbMetadata(db)`. Accepts an already-open caller-owned connection and reads metadata only. | `k334IndexedDbMetadata.test.ts` |
| `frontend/src/lib/localDatabase/protocol/k334PhysicalSchemaDescriptor.test.ts` | New; focused unit/dormancy test | Covers configuration, canonical vector/digest, projection, classifier, hostile values, no side effects, no external production caller, and forbidden imports. | Self |
| `frontend/src/lib/localDatabase/protocol/k334IndexedDbMetadata.test.ts` | New; fake-indexeddb integration | Covers fresh metadata normalization, all metadata categories/failures, fixture matrix, zero row requests/writes, and cleanup. | Self |
| `frontend/tests/k334-descriptor-browser-fixture.html` | New; test-only native fixture | Imports only the two new modules through Vite and exposes bounded temporary-database fixture/snapshot operations to the runner. No live name or row writes. | Browser runner |
| `frontend/scripts/run-k334-descriptor-browser-tests.mjs` | New; test-only audit | Uses the established temporary-profile Vite/CDP pattern to run the exact native matrix and verify cleanup. Run directly with Node; no package script or dependency change. | Self |

No existing file is modified. In particular, `index.ts`, `schema.ts`,
`types.ts`, `repository.ts`, package manifests, migration/recovery modules, and
all production entry points remain byte-unchanged. Tests import the modules by
direct path; no production barrel exposes them.

## 16. Existing Source Impact

The selected package changes no existing source. Consequently:

- runtime behavior does not change;
- `LOCAL_DATABASE_VERSION` remains `4`;
- live open/upgrade paths do not change;
- no new code is reachable from application startup, repositories, workers,
  service workers, UI, sync, migration, recovery, or production;
- existing tests require no semantic update; and
- no database opens, stores, indexes, or records are introduced by production code.

Any future need to alter an existing runtime/open/schema file is a stop
condition requiring a separate Layer B authorization decision.

## 17. Future Implementation Authorization Package

A future `K334CanonicalDescriptorMechanismImplementationAuthorizationRecord`
must bind:

- proposal `K-334P09P-DESCRIPTOR-AUTHORITY-PROPOSAL-001` and SHA
  `E21782092CBB03BDD68D65C4E57D7AC87F14078A60561B9DD1E36F1E5827C92A`;
- acceptance `K-334P09P8-DESCRIPTOR-AUTHORITY-PREREQUISITE-ACCEPTANCE-001`;
- this reviewed design ID and final artifact SHA;
- `ONE_BOUNDED_IMPLEMENTATION_PACKAGE` and
  `MECHANISMS_ONLY_NO_SCHEMA_MUTATION`;
- `PRIVATE_DESCRIPTOR_LOCAL_RFC8785_ENCODER_V1` and
  `RFC8785_EQUIVALENT_FOR_K334_DESCRIPTOR_PROFILE_V1`;
- `K334_DESCRIPTOR_CANONICALIZATION_LIMITS_V1` with the exact 65,536-byte,
  2,048-node, 1,024-property, 512-total-array-element, 64-per-array,
  8-depth, 128-value-string raw-byte, 64-object-key raw-byte, and
  8,192-fragment limits;
- `RAW_VALIDATED_UTF8_CONTENT_BYTES_V1`,
  `DETERMINISTIC_CANONICAL_FAILURE_SELECTION_V1`,
  `INDEPENDENT_VECTOR_PROVENANCE_V1`, `CANONICAL_FRAGMENT_LIMIT_EXCEEDED`,
  exact 2,580-fragment acceptance measurement, and the 327,788-byte
  conservative logical retained-payload bound;
- `ARRAY_CHILD_COMMA_PREFIX_FRAGMENT_RULE_V1`, its complete normative
  schedules, the selected Option-A derivation identities, exact detached input
  SHA-256, and immutable 2,580 test-literal provenance;
- independently fixed complete-descriptor measurements and vectors under the
  selected provenance option, plus the
  prohibition on complete-descriptor use of `encodeCanonicalProtocolValue`;
- the exact six paths in Section 15 and no others;
- the exact exported APIs in Section 15;
- no existing-file modification, no barrel export, and no production caller;
- no schema mutation/open/live version change/row/web-storage/network boundary;
- exact conformance and native-browser criteria in Sections 13-14;
- one independent implementation review and exact-head validation;
- closure evidence binding source/test commit and fixed descriptor vector; and
- explicit non-authorization of Layer B, D0-P09/D0-P10, K-334E/F, runtime,
  and production.

The authorization record is not created by this design.

## 18. Review Strategy

Use one reviewer: **GPT-5.6 / Medium**.

The package is mechanisms-only, bounded to two inert source modules, focused
tests, and one native IndexedDB audit. The review must jointly verify package
minimality, accepted-profile RFC 8785 equivalence, single configuration source,
metadata fidelity, complete classifier behavior, no side effects, and static
production dormancy. The native browser results are evidence inside the same
review, not a second broad architecture audit.

## 19. D0-P09 Rebound Prerequisites

D0-P09 may be reconsidered only after all of the following:

- a separately published descriptor mechanism implementation authorization is accepted;
- the exact authorized package is implemented with no scope expansion;
- implementation conformance and independent review pass;
- the independent complete-descriptor canonical bytes/digest vector passes;
- configuration, projection, snapshot, comparator, fake-indexeddb, and native-browser tests pass;
- static evidence proves no schema mutation, database open, row creation, or production reachability;
- source/test exact-head commit and implementation closure are archived;
- descriptor implementation authority is accepted if the closure model requires that state; and
- the unchanged blocked D0-P09 document is reconsidered in a separate task.

This design neither rebounds nor executes D0-P09.

## 20. Implementation-Authorization Readiness

| Readiness item | State |
| --- | --- |
| Existing source ownership | `READY_FOR_REVIEW` |
| Implementation package scope | `READY_FOR_REVIEW` |
| Reusable boundary | `READY_FOR_REVIEW` |
| Absinthe-specific boundary | `READY_FOR_REVIEW` |
| Configuration representation | `READY_FOR_REVIEW` |
| Canonical encoder ownership | `READY_FOR_REVIEW` |
| Accepted descriptor value profile | `READY_FOR_REVIEW` |
| RFC 8785 equivalence proof boundary | `READY_FOR_REVIEW` |
| Canonical output-byte limit | `READY_FOR_REVIEW` |
| Raw scalar/key byte-accounting semantics | `READY_FOR_REVIEW` |
| Node/property/array/depth/string/key limits | `READY_FOR_REVIEW` |
| Fixed complete-descriptor measurements | `READY_FOR_REVIEW` |
| Deterministic object traversal and failure precedence | `READY_FOR_REVIEW` |
| Independent canonicalization vectors and provenance threshold | `READY_FOR_REVIEW` |
| Fragment-count and buffered logical-allocation bounds | `READY_FOR_REVIEW` |
| Fragment failure behavior and tests | `READY_FOR_REVIEW` |
| Rule-bound independent fragment-count derivation | `READY_FOR_REVIEW` |
| Complete comma-prefix schedules and test inventory | `READY_FOR_REVIEW` |
| Limit-failure behavior | `READY_FOR_REVIEW` |
| Existing encoder reference boundary | `READY_FOR_REVIEW` |
| Projection design | `READY_FOR_REVIEW` |
| Snapshot design | `READY_FOR_REVIEW` |
| Comparator/classifier design | `READY_FOR_REVIEW` |
| Schema-mutation boundary | `READY_FOR_REVIEW` |
| No-row-creation enforcement | `READY_FOR_REVIEW` |
| Source file plan | `READY_FOR_REVIEW` |
| Unit tests | `READY_FOR_REVIEW` |
| IndexedDB integration tests | `READY_FOR_REVIEW` |
| Native browser evidence | `READY_FOR_REVIEW` |
| Conformance proof | `READY_FOR_REVIEW` |
| Review strategy | `READY_FOR_REVIEW` |
| D0-P09 rebound prerequisites | `READY_FOR_REVIEW` |
| Authority exclusions | `READY_FOR_REVIEW` |

`IMPLEMENTATION_AUTHORIZATION_PACKAGE_READY_FOR_ARCHITECTURE_REVIEW` is
`SUPERSEDED_NONCONTROLLING_HISTORICAL_READINESS_RESULT`; it has no downstream
authority and cannot be bound by a later acceptance action.

## 21. Authorization State

This is the single controlling authority-state ledger. Accepted descriptor-input
authority exists; implementation and schema-mutation authority do not. An I1
review PASS can permit only a later acceptance/archive action.

| State | Value |
| --- | ---: |
| Machine-readable descriptor input proposed | 1 |
| Machine-readable descriptor input accepted | 1 |
| M3 independent review | PASS |
| M4 acceptance | 1 |
| M4A archive binding | 1 |
| Descriptor implementation authorization proposed | 0 |
| Descriptor implementation authorization accepted | 0 |
| Descriptor implementation | 0 |
| Schema mutation | 0 |
| D0-P09 authorization rebound proposed | 0 |
| D0-P09 authorization rebound accepted | 0 |
| D0-P09 execution | 0 |
| D0-P09 satisfaction | 0 |
| D0-P10 execution | 0 |
| D0-P10 satisfaction | 0 |
| K-334E | 0 |
| K-334F | 0 |
| Runtime authorization | 0 |
| Production eligibility | 0 |

## 22. Production Boundary

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 23. Historical Readiness Disposition

`IMPLEMENTATION_AUTHORIZATION_PACKAGE_READY_FOR_ARCHITECTURE_REVIEW` is
`SUPERSEDED_NONCONTROLLING_HISTORICAL_READINESS_RESULT`. It has no downstream
authority and cannot be used by a later acceptance action. Only the final
readiness token in Section 40 controls.

## 24. Accepted Descriptor Authority Binding

This I1C1 addendum supersedes every earlier provisional topology, fragment-count,
margin, aggregate-topology, and temporary-script statement in this design. The
sole machine-readable configuration content input is
`ACCEPTED_DESCRIPTOR_CONFIGURATION_INPUT_V1`, with exactly
`configurationKind`, `configurationVersion`, `canonicalDescriptor`, and
`predecessorObservableMetadataBaseline` components. The canonical descriptor
component is the accepted documentation artifact at
`frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json`.

The artifact is `K-334-CANONICAL-PHYSICAL-SCHEMA-001`, descriptor version `1`,
physical revision `K334_PHYSICAL_SCHEMA_REVISION_1`, format
`K334_MACHINE_READABLE_DESCRIPTOR_JSON_V1`. It was accepted by
`K-334P09M4-MACHINE-READABLE-DESCRIPTOR-INPUT-ACCEPTANCE-001` and archive-bound
by `K-334P09M4A-MACHINE-READABLE-DESCRIPTOR-ACCEPTANCE-ARCHIVE-BINDING-001`.
Implementation must not hand-transcribe descriptor literals or parse Markdown.
The JSON is configuration authority only: it is not runtime-loaded production
data unless separately authorized.

## 25. Accepted Artifact Identity Inventory

All identities use `LOWERCASE_HEX64_SHA256_V1`.

| Identity | Value |
| --- | --- |
| M1 | `ed7b0c2cd25f08be41313fdb18c5830ce88d55fb734b5b4a53d01cd93fadc1f5` |
| I01 raw JSON | `8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313` |
| I02 canonical bytes | `127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02` |
| I03 domain-framed digest | `bf5609cada6425f6a82bec65d7574d60a71c334b92ec98e41e7f5d6234d22e07` |
| I04 governing proposal | `e21782092cbb03bdd68d65c4e57d7ac87f14078a60561b9dd1e36f1e5827c92a` |
| I05 M2 proposal | `ac638857475fbc8dd1b352ddaef1728a5e636c6016e76f17a363ca7a59559723` |
| I06 M4 acceptance | `a714e39b46ba41ded333d7c71f88e1ec3deefba6c53dd1e16c78f1ec92d96260` |

## 26. Derivation Tool Identity

The temporary, documentation-only derivation used
`K334_P09_I1C1_ACCEPTED_ARTIFACT_DERIVATION_TOOL_V1`, SHA-256
`c0cbdaa16d7aca4518c19aee00573bbf035dc6412a2cb05eafece836e473db9a`, on
Node `v24.14.0`, invoked as `node .k334p09i1c1-derive.mjs`. It strictly
rejected duplicate object keys, parsed one root object, rejected non-integer
numeric grammar, canonicalized the parsed value with the accepted RFC 8785
compatible profile, and derived evidence without an expected historical count
or topology checksum as an input.

Persistent cleanup record: temporary derivation scripts, canonical-byte files,
fragment schedules, topology JSON/preimages, dumps, logs, and checksum outputs
were removed; remaining temporary artifacts: `0`. The tool exists only through
this identity, SHA-256, runtime, invocation, algorithm contract, and output
evidence. It is not a production dependency.

## 27. Complete Canonical Topology

Evidence identity: `K334_ACCEPTED_DESCRIPTOR_FRAGMENT_TOPOLOGY_V1`.
The accepted artifact has 55,437 raw bytes, 43,010 canonical bytes, 1,418
nodes, 977 properties, 116 JSON array nodes, and 440 total array child
elements. Its maximum array length is 38, maximum depth is 4, maximum raw
UTF-8 string length is 81, and maximum object-key UTF-8 length is 29.

The complete topology accounts for every opening/closing delimiter, object
member key/colon schedule, scalar token, null, integer, boolean, escaped
string, and comma-prefixed non-first array child. It uses
`ARRAY_CHILD_COMMA_PREFIX_FRAGMENT_RULE_V1`: no standalone comma fragment is
emitted; a non-first array child's first fragment carries its comma prefix.

Its normative RFC 8785 JSON checksum preimage is the following exact value.
It binds `derivationToolSha256` inside the preimage, rather than only in prose.

```json
{"I01":"8fb8e8604cd26a2da91bc7537f0fb17cbc4ec0195e5a95271928d6e1def73313","I02":"127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02","artifactNodeCount":1418,"artifactPath":"frontend/docs/authority/k334-canonical-physical-schema-descriptor-v1.json","canonicalByteLength":43010,"concatenatedCanonicalByteChecksum":"127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02","derivationToolIdentity":"K334_P09_I1C1_ACCEPTED_ARTIFACT_DERIVATION_TOOL_V1","derivationToolSha256":"c0cbdaa16d7aca4518c19aee00573bbf035dc6412a2cb05eafece836e473db9a","descriptorId":"K-334-CANONICAL-PHYSICAL-SCHEMA-001","descriptorVersion":1,"evidenceKind":"K334_ACCEPTED_DESCRIPTOR_FRAGMENT_TOPOLOGY_V1","fragmentClassCounts":{"ARRAY_CLOSE":116,"ARRAY_NON_FIRST_CHILD_COMMA_PREFIXED_OBJECT_OPEN":59,"ARRAY_NON_FIRST_CHILD_COMMA_PREFIXED_STRING_TOKEN":266,"ARRAY_OPEN":116,"BOOLEAN_TOKEN":101,"INTEGER_TOKEN":91,"NULL_TOKEN":45,"OBJECT_CLOSE":69,"OBJECT_KEY_COLON":69,"OBJECT_KEY_COLON_COMMA_PREFIX":908,"OBJECT_OPEN":10,"STRING_TOKEN":730},"fragmentRuleIdentity":"ARRAY_CHILD_COMMA_PREFIX_FRAGMENT_RULE_V1","invocation":"node .k334p09i1c1-derive.mjs","orderedFragmentScheduleChecksum":"fcef386158b66a36f1bf93957d6d76d46a1c426425297234d160cba173d79e7e","orderedFragmentScheduleIdentity":"K334_ACCEPTED_DESCRIPTOR_ORDERED_FRAGMENT_SCHEDULE_V1","physicalSchemaRevision":"K334_PHYSICAL_SCHEMA_REVISION_1","runtimeIdentity":"Node v24.14.0","totalFragmentCount":2580}
```

## 28. Ordered Fragment Schedule

The schedule preimage is
`K334_ACCEPTED_DESCRIPTOR_ORDERED_FRAGMENT_SCHEDULE_V1`. Every record contains
its ordinal, fragment class, source JSON pointer, UTF-8 byte length,
fragment-value SHA-256, and prefix/child role. The schedule has 2,580 ordered
entries; duplicate, missing, and extra ordinal counts are `0 / 0 / 0`.

## 29. Fragment Schedule Checksum

The RFC 8785 canonical JSON schedule checksum is
`fcef386158b66a36f1bf93957d6d76d46a1c426425297234d160cba173d79e7e`.
The deterministic topology-evidence checksum is
`943cdbc34104056522f65e84c6d1ab1b1b6865488d17de7dfc7baca22cf06796`.
The prior result
`24b5c3f8f2b2ed47b08d191495a379625a5f3461f8cd1fdc97259f3d4a91679e` is
`SUPERSEDED_BY_TOOL_SHA_BOUND_TOPOLOGY_PREIMAGE` and is non-normative.

The I1C2 correction verifier was
`K334_P09_I1C2_TOPOLOGY_PREIMAGE_CORRECTION_TOOL_V1`, SHA-256
`aa6092ff7c1571c4abcd0b38c3a65160ed350978a1759af0e6712315793e98c0`, on
Node `v24.14.0`, invoked as `node .k334p09i1c2-topology-verify.mjs`. It
verified the normative preimage and corrected checksum, then was removed with
no remaining correction-tool artifacts.

## 30. Canonical Fragment Classes

| Fragment class | Count |
| --- | ---: |
| `OBJECT_OPEN` | 10 |
| `OBJECT_CLOSE` | 69 |
| `ARRAY_OPEN` | 116 |
| `ARRAY_CLOSE` | 116 |
| `OBJECT_KEY_COLON` | 69 |
| `OBJECT_KEY_COLON_COMMA_PREFIX` | 908 |
| `STRING_TOKEN` | 730 |
| `INTEGER_TOKEN` | 91 |
| `BOOLEAN_TOKEN` | 101 |
| `NULL_TOKEN` | 45 |
| `ARRAY_NON_FIRST_CHILD_COMMA_PREFIXED_STRING_TOKEN` | 266 |
| `ARRAY_NON_FIRST_CHILD_COMMA_PREFIXED_OBJECT_OPEN` | 59 |
| **Total** | **2,580** |

The prefix classes subsume the first fragment of every non-first array child:
266 strings and 59 object openings. Together with the 10 unprefixed object
openings, they account for all 69 object openings. The class counts are
disjoint and sum exactly to the fragment count.

## 31. Canonical Concatenation Proof

Ordinal concatenation produced 43,010 bytes, I02
`127916e6d6008bd03b68eaef1c4bf128772ce007ee56207d9481e9ad08f70d02`, and
I03 `bf5609cada6425f6a82bec65d7574d60a71c334b92ec98e41e7f5d6234d22e07`.
The byte mismatch count is zero and there is no first mismatch offset.

## 32. Re-derived Fragment Count and Remaining Margin

`ACTUAL_ACCEPTED_DESCRIPTOR_FRAGMENT_COUNT` is `2,580`. Against the proposed
8,192 fragment-count ceiling, `REMAINING_FRAGMENT_MARGIN` is `5,612` and
utilization is `31.49%`. The ceiling remains
`PROPOSED_DESIGN_LIMIT_NOT_IMPLEMENTATION_AUTHORITY`; it is not a byte ceiling.

## 33. Historical Evidence Disposition

| Prior item | Disposition |
| --- | --- |
| Historical fragment count `2,580` | `INDEPENDENTLY_REDERIVED_MATCH` |
| Historical remaining margin `5,612` | `INDEPENDENTLY_REDERIVED_MATCH` |
| Historical aggregate topology SHA | `SUPERSEDED_BY_ACCEPTED_ARTIFACT_DERIVATION` |
| Historical temporary-script identities | `SUPERSEDED_BY_ACCEPTED_ARTIFACT_DERIVATION` |
| Former missing machine-readable-input blocker | `NOT_APPLICABLE` |

The matching count and margin were not derivation inputs. They are
accepted-artifact design evidence only after final I1 review.

## 34. Accepted-Artifact Measurement Table

All limits remain `PROPOSED_IMPLEMENTATION_DESIGN_LIMITS_NO_IMPLEMENTATION_AUTHORITY`.

| Metric | Proposed limit | Actual | Remaining | Utilization | Result | Evidence |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Canonical bytes | 65,536 | 43,010 | 22,526 | 65.63% | PASS | `K334_ACCEPTED_DESCRIPTOR_FRAGMENT_TOPOLOGY_V1` / `943cdbc34104056522f65e84c6d1ab1b1b6865488d17de7dfc7baca22cf06796` |
| Nodes | 2,048 | 1,418 | 630 | 69.24% | PASS | same |
| Properties | 1,024 | 977 | 47 | 95.41% | PASS | same |
| Array elements | 512 | 440 | 72 | 85.94% | PASS | same |
| Maximum array length | 64 | 38 | 26 | 59.38% | PASS | same |
| Maximum depth | 8 | 4 | 4 | 50.00% | PASS | same |
| Maximum string bytes | 128 | 81 | 47 | 63.28% | PASS | same |
| Maximum key bytes | 64 | 29 | 35 | 45.31% | PASS | same |
| Fragments | 8,192 | 2,580 | 5,612 | 31.49% | PASS | same |

`same` in this table means the exact topology identity and
`943cdbc34104056522f65e84c6d1ab1b1b6865488d17de7dfc7baca22cf06796` above.
Current-artifact margin does not independently prove future production safety.

## 35. Updated Future Test Vectors

After separate implementation authorization, tests must bind I01 where a
documentation-input test needs it, canonical length 43,010, I02, I03, exact
node/structure counts, fragment count 2,580, margin 5,612, schedule checksum
`fcef386158b66a36f1bf93957d6d76d46a1c426425297234d160cba173d79e7e`, and
topology checksum `943cdbc34104056522f65e84c6d1ab1b1b6865488d17de7dfc7baca22cf06796`.

The proposed future negative-vector inventory requires separate fixtures for:

1. malformed JSON;
2. duplicate object keys at the root;
3. duplicate object keys at nested levels;
4. unsupported root structure;
5. unsupported nested structure;
6. unsupported numeric form;
7. malformed Unicode or invalid UTF-8 where applicable;
8. canonical-byte limit exceeded;
9. node limit exceeded;
10. property limit exceeded;
11. array-element limit exceeded;
12. maximum-array-length exceeded;
13. depth limit exceeded;
14. string-byte limit exceeded;
15. key-byte limit exceeded;
16. fragment-count limit exceeded;
17. canonicalization output mismatch;
18. I02 mismatch;
19. I03 domain-framed digest mismatch;
20. descriptor reconstruction mismatch;
21. physical metadata conflict;
22. partial installation; and
23. invalid retry-state classification.

This inventory is part of the proposed implementation design only. No test
file or fixture is created now; no vector authorizes schema mutation or runtime
activation; later tests must preserve deterministic fail-closed precedence.

## 36. Configuration Input Binding

Future reconstruction must validate the exact configuration envelope, strict
23-key root and nested schemas, canonical bytes, I02, I03, exact descriptor
projection, and exact predecessor observable metadata projection. A generated
literal with provenance not tied to these accepted JSON identities is forbidden.
Production must not dynamically load the documentation artifact, and no
build-time generation is authorized.

## 37. Implementation Boundary

The preserved direction is `ONE_BOUNDED_IMPLEMENTATION_PACKAGE` and
`MECHANISMS_ONLY_NO_SCHEMA_MUTATION`: Layer A mechanism implementation only;
Layer B schema mutation excluded; Layer C D0-P09 excluded. The future six-file
scope remains unchanged, and this correction creates none of those files.

## 38. Schema-Mutation Exclusion

No `versionchange`, IndexedDB store/index alteration, live database opening,
migration, recovery, runtime integration, or production behavior is authorized
or implemented by this correction.

## 39. D0-P09 Exclusion

D0-P09 is not rebound, executed, or satisfied. This evidence correction does
not create D0-P09, D0-P10, K-334E/F, runtime, or production authority.

## 40. Final I1 Review Readiness

`CANONICAL_DESCRIPTOR_IMPLEMENTATION_AUTHORIZATION_DESIGN_READY_FOR_FINAL_ARCHITECTURE_REVIEW`

The accepted identities match; topology, schedule, concatenation, count,
margin, and measurements are fully re-derived; the SHA-bound topology checksum
is `943cdbc34104056522f65e84c6d1ab1b1b6865488d17de7dfc7baca22cf06796`; no
source/schema/runtime change occurred; and implementation authority remains
ungranted. This is the sole controlling readiness result.

## 41. Production Boundary

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
