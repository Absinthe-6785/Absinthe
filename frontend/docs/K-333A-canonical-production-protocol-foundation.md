# K-333A — Canonical Production Protocol Foundation

## 1. Executive verdict

K-333A adds the first production canonical-protocol code after K-332. It supplies a bounded canonical
JSON subset, strict decoders, registered and length-framed digest preimages, explicit version/kind
dispatch, and four representative authority-critical records. It adds no persistence or runtime
consumer and does not complete K-333.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. K-332 handoff intake

K-332 assigns canonical envelopes, codecs, preimages, compatibility enforcement, proof formats, and
stable protocol errors to K-333. It assigns IndexedDB schema, repositories, persistent lookup, and
atomic source transactions to K-334. Runtime writer registration, source interception, eligibility,
and activation remain later work. K-333A consumes that split without importing the K-331G or K-332
test-support models.

The production subset preserves the inherited namespace, physical-source, generation, writer,
session, transaction-reference, source-revision, authority-digest, and MMR-state bindings. It does
not claim parity for records that K-333A does not implement.

## 3. K-333 ownership

K-333 owns production value rules, canonical bytes, registered domains, preimage framing, record
codecs, compatibility checks, proof encodings/verifiers, and production errors. K-333A establishes
the reusable low-level portion and a representative record slice only.

## 4. K-333A selected scope

Implemented production modules are:

- a canonical protocol value encoder/decoder;
- domain-registered, length-framed preimages and SHA-256 digests;
- total-result strict object and primitive decoders;
- an explicit four-kind, version-1 envelope dispatcher;
- codecs for writer identity, writer session, source authority, and source transaction reference;
- cross-record validation for the selected authority graph.

## 5. Explicit non-goals

K-333A does not implement receipts, compacted projections, Merkle or MMR proofs, bootstrap, restore,
lifecycle records, attachment classification, complete proofs, persistence, transactions, migration,
runtime calls, writer registration, source interception, admission, K-328 invocation, eligibility,
activation, compaction, or network/browser effects.

## 6. Existing utility audit

| Existing code | Decision | Reason |
|---|---|---|
| `outboxIdentity.sha256Hex` | Reused | Existing synchronous, browser-safe SHA-256 implementation; no new cryptographic algorithm is introduced. |
| `crossContextHandoff/canonical.ts` | Not generalized | Correctly specialized to K-328 source-entry tuples and async browser hashing, not a general record protocol. |
| `recoveryExportPackage` canonical JSON | Not reused | Recovery-specific pretty JSON permits finite non-integers and is not hardened against accessors/custom serialization. |
| restore/cutover/migration canonical helpers | Not reused | Private, task-shaped digests with incompatible payload contracts. |
| `namespace.ts` validation | Audited, not imported | Runtime namespace components and errors serve local DB construction; protocol identifiers follow the stricter inherited K-331G ASCII contract. |
| K-331G/K-332 test support | Never imported | Architecture/test evidence is not production protocol code. |

The new abstraction has a single narrow owner under `localDatabase/protocol`. Existing specialized
contracts remain unchanged. A barrel export was deliberately omitted because K-333A has no production
consumer. Duplicate-abstraction risk is controlled by documenting that only this directory owns the
new K-333 production protocol; older helpers retain their existing task-specific formats.

## 7. Canonical value domain

Accepted values are `null`, booleans, NFC strings with valid Unicode scalar sequences, safe integers
other than negative zero, dense arrays, and plain data objects whose prototype is `Object.prototype`
or `null`. Objects and arrays must contain only enumerable own data properties.

The encoder rejects `undefined`, non-integers, unsafe integers, NaN, infinities, negative zero,
bigints, dates, maps, sets, functions, symbols, class instances, cycles, sparse/extended arrays,
accessors, non-enumerable or symbol properties, and custom `toJSON` functions. There is no coercion or
fallback.

## 8. Unicode policy

Every string and object key must already be NFC and contain no unpaired UTF-16 surrogate. The protocol
rejects non-NFC input; it never normalizes implicitly. This makes a caller-visible spelling change
impossible during signing or digest verification. Keys are ordered by unsigned UTF-8 bytes, not by
locale or platform collation.

## 9. Canonical serialization format

The wire value is compact UTF-8 JSON restricted to the value domain above. Object keys use unsigned
UTF-8 bytewise lexicographic order. Arrays preserve input order. Safe integers use the single decimal
representation emitted for that domain. There is no whitespace or platform newline. String escaping
uses the language JSON string primitive only after Unicode validation; object serialization is manual,
so integer-looking keys cannot be reordered by ordinary JavaScript object serialization.

The byte decoder rejects an oversized byte sequence before JSON parsing, uses fatal UTF-8 decoding,
rejects a BOM, parses one JSON value, re-encodes it canonically, and requires byte-for-byte identity.
This rejects whitespace variants, trailing bytes, duplicate keys, noncanonical escapes, and key order.

## 10. Domain-separated preimage format

Only four immutable domain identifiers are registered in K-333A:

- `absinthe.writer_identity.v1`
- `absinthe.writer_session.v1`
- `absinthe.source_transaction_reference.v1`
- `absinthe.source_authority.v1`

The UTF-8 frame is:

```text
absinthe-protocol-preimage-v1\n
D:<domain-byte-length>:<registered-domain>\n
V:<positive-safe-record-version>\n
P:<payload-byte-length>:<canonical-payload-bytes>
```

Lengths are decimal byte lengths and the payload occupies the terminal framed region. Registered
domains, fixed labels, explicit versions, and lengths prevent prefix/concatenation ambiguity. Callers
cannot select an arbitrary raw hash prefix.

## 11. Digest failure semantics

`digestCanonicalProtocolRecord` first builds a valid canonical preimage and only then invokes the
existing SHA-256 primitive. Any validation failure returns the same typed `ProtocolResult` failure.
There is no empty, zero, fallback, error-string, or sentinel digest.

## 12. Envelope foundation

The envelope discriminator consists of record-specific `kind` and integer `version` fields. Dispatch
is a closed `switch` over four supported kinds. Each selected decoder then enforces its own exact field
set and digest. There is no payload bag, registry mutation, latest-version wildcard, or decode-and-cast
escape hatch.

## 13. Strict decoder architecture

`decodeExactObject` accepts only plain own-data objects, copies descriptor values without invoking
getters, requires exact required/optional keys, and rejects unknown keys. Primitive helpers validate
bounded strings, inherited canonical identifiers, lowercase SHA-256 digests, positive safe integers,
canonical decimal revisions, enums, bounded dense arrays, nested entries, and duplicate identities.
All exported protocol operations return bounded `ProtocolResult` failures rather than exposing raw
input or exceptions.

## 14. Representative record inventory

| Record | Production proof supplied by K-333A |
|---|---|
| `WriterIdentityRecord` | Writer ID/type, namespace, physical source, manifest digest, and self-verifying writer digest. |
| `WriterSessionRecord` | Writer ID/digest, namespace, generation, physical source, epoch, capability digest, and session digest. |
| `SourceAuthorityRecord` | Namespace/generation/source binding, canonical decimal source revision, registry/terminal/outbox roots, MMR pointer, paired optional lifecycle head, and authority digest. |
| `SourceTransactionReferenceRecord` | Transaction identity plus authority, operation, admission, writer, session, terminal, outbox, MMR, checkpoint, generation/source/revision, and reference digest bindings. |

Self-digest fields are excluded from their own canonical preimage and checked only after strict field
decoding. The selected graph validator revalidates every record digest before checking cross-record
identity, scope, revision, and MMR relationships.

## 15. Version framework

The canonical preimage format is version 1. Each representative record kind supports exactly integer
version 1, and the source transaction reference supports graph version 1. Encoders emit only these
versions. Unsupported versions fail before record payload use. No implicit compatibility is claimed.
Cross-kind capability versions and all unimplemented record relationships remain later K-333 work.

## 16. Production protocol error inventory

All 18 codes are public through `ProductionProtocolErrorCode`; every code has a production emission
path and an exact-code test. Reserved and unreachable counts are zero.

| Code | Primary emission path |
|---|---|
| `INPUT_TOO_LARGE` | Canonical encoded input/output ceiling. |
| `RESOURCE_LIMIT_EXCEEDED` | Depth/node/key/array/string bounds and bounded helpers. |
| `INVALID_ENCODED_INPUT` | Non-UTF-8, BOM, or invalid JSON. |
| `NON_CANONICAL_VALUE` | Unsupported values/prototypes/properties or canonical byte mismatch. |
| `INVALID_PREIMAGE_DOMAIN` | Domain outside the closed preimage registry. |
| `RECORD_KIND_MISMATCH` | Envelope or record-specific kind mismatch. |
| `UNSUPPORTED_RECORD_VERSION` | Envelope, record, or graph version mismatch. |
| `MISSING_FIELD` | Required exact-object field absent. |
| `UNKNOWN_FIELD` | Extra exact-object field present. |
| `INVALID_FIELD_TYPE` | Wrong object or primitive type/accessor. |
| `INVALID_IDENTIFIER` | Identifier outside inherited ASCII syntax/size. |
| `INVALID_DIGEST` | Digest not 64 lowercase hexadecimal characters. |
| `INVALID_INTEGER` | Unsafe/range-invalid integer or noncanonical revision. |
| `INVALID_ARRAY` | Non-array or sparse array helper input. |
| `INVALID_ENUM_VALUE` | Unsupported closed enum member. |
| `DUPLICATE_ENTRY` | Duplicate semantic identity in a bounded array. |
| `CANONICAL_DIGEST_MISMATCH` | Recomputed record digest differs. |
| `RELATIONSHIP_MISMATCH` | Paired local fields or selected graph bindings disagree. |

Errors contain only a stable code, bounded operation label, and optional schema field name. They do
not contain raw values, payloads, stack traces, or causes.

## 17. Security and resource bounds

| Limit | K-333A value | Basis |
|---|---:|---|
| Canonical encoded input/output | 32 KiB | Inherited K-331 maximum encoded proof ceiling; ample for the small selected records. |
| Maximum nesting | 32 | Bounds recursive validation for the flat representative subset. |
| Maximum visited nodes | 2,048 | Global work ceiling independent of per-container limits. |
| Object keys | 128 | Matches inherited bounded collection scale. |
| Array entries | 128 | Inherited K-331G array ceiling. |
| String value | 4,096 UTF-8 bytes | Ample for K-333A metadata; prevents payload-like unbounded fields. |
| Object key | 256 UTF-8 bytes | Prevents adversarial property names. |
| Identifier | 256 ASCII bytes | Inherited K-331G identifier ceiling and syntax. |
| Digest | 64 lowercase hex characters | SHA-256 width. |
| Source revision | 1–16 canonical decimal digits | Inherited K-331 revision domain. |

These are K-333A canonical/representative-record bounds, not final bounds for later proof, restore, or
bootstrap formats. Those owners must justify separate structures and limits without weakening these
decoders.

## 18. Semantic parity coverage

Deterministic production tests cover namespace, physical source, generation, writer identity,
writer/session lineage, source transaction identity, canonical source revision, authority digest,
and MMR-state pointer bindings. Production modules do not import the K-331G/K-332 model. Receipt,
compaction, proof, bootstrap, restore, lifecycle, and attachment parity is deliberately not asserted.

## 19. Deferred K-333 work

Later K-333 tasks still own raw receipt and compacted-projection codecs; operation/admission/terminal/
outbox/checkpoint records beyond the representative reference; lifecycle lineage; segment Merkle and
MMR proofs; bootstrap; restore; attachment classification; full compatibility relationships; proof
resource derivations; and complete protocol integration. K-333A is not the complete source-authority
protocol.

## 20. K-334 boundary

K-333A changes no IndexedDB version, store, index, migration, repository, durable lookup, or atomic
transaction. K-334 must persist and transact the exact reviewed K-333 contracts rather than inventing
a second serialization or weakening validation.

## 21. Runtime non-reachability

No production module outside `localDatabase/protocol` imports K-333A. Static tests reject browser,
network, K-331G/K-332 test-support, persistence, and external production callers. There is no writer,
source interception, K-330 admission caller, K-328 invocation, shadow rollout, eligibility, or
activation path.

## 22. Validation evidence

Focused tests exercise supported values, fixed vectors, all rejection classes, canonical byte
round-trips, all four record codecs, deterministic digests, strict version/kind dispatch, graph
relationships, all 18 error paths, and dormancy/ownership guards. The final PR report records exact
focused predecessor, local-database, recovery, typecheck, build, diff, and full-suite results. No
real-browser behavior is required or claimed because the implementation is pure and dormant.

## 23. Production eligibility verdict

K-333A creates protocol capability only. Repository capability, runtime evidence, shadow validation,
eligibility, and activation remain absent.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
