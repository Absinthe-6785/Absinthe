# K-334C3A: Canonical Semantic Registry Clarification

## Status and scope

This document is the authoritative v1 semantic registry for the canonical
K-334C3 durable-authority record shapes. It supplies the exact values and
scalar rules a future K-334D3A strict decoder must consume. It clarifies
semantic inputs only; it creates no record, storage, transaction, migration,
runtime caller, admission decision, eligibility decision, or activation.

The registries are deliberately closed. A decoder MUST reject a value outside
the named registry or grammar with a bounded invalid-semantic-field result. It
MUST NOT trim, case-fold, substitute a default, select a nearest literal, or
silently preserve an unknown value as valid canonical evidence. Preservation
of unsupported source bytes is a later K-334F responsibility and is not an
acceptance path.

All literal values in this document serialize as their exact lower-case ASCII
spelling in canonical protocol bytes. No alias, display label, ordinal, or
locale-aware ordering exists. A future extension requires a separately
reviewed, versioned registry change, an explicit record-schema/compatibility
decision, and new canonical test vectors; it cannot be introduced by a
decoder's permissive fallback.

This clarification preserves the K-334C2 policy choices without extending
them:

- D01-A remains an append-only lifecycle: historical records are immutable;
  revocation, supersession, and termination are prospective exact-evidence
  events only.
- D02-B remains an exact compatibility tuple: no wildcard, partial tuple, or
  compatible-by-default interpretation is added here.
- D03-A remains exact-subject fork quarantine: ambiguity remains preserved and
  fail-closed; this registry selects no fork winner.
- Canonical identity, digest domains, canonical encoding, and domain
  separation remain those defined by K-334C3. This document adds no digest
  field and changes no identity construction.

## 1. Shared decoding rule

For every closed registry below, exact string equality is the only membership
test. A field that is absent, non-string, duplicated in its canonical object,
contains a disallowed character, or is not one of the listed literals is
invalid. Unknown means *invalid for canonical decoding*, not a future literal
that a v1 decoder may carry forward.

When an enum is declared valid only for a record kind or field context, a
listed value in another context is also invalid. The rules therefore constrain
both token spelling and semantic placement.

## 2. `AuthorityAction`

`AuthorityAction` is a closed lower-case ASCII enum.

| Literal | Canonical meaning | Valid v1 placement |
|---|---|---|
| `grant` | Prospective grant evidence for one exact subject, issuer, action scope, generation, and compatibility tuple. It does not itself make a source eligible or active. | `authority evidence.action`, `issuer policy.action`, `compatibility tuple.action` |
| `revoke` | An exact, authorized, append-only event ending future applicability of the identified prior grant. It does not delete or rewrite the target. | `issuer policy.action`, `compatibility tuple.action` |
| `supersede` | An exact, authorized, append-only event ending future applicability of the identified prior grant while retaining the prior immutable evidence. It does not transfer authority implicitly. | `issuer policy.action`, `compatibility tuple.action` |
| `terminate` | An exact, authorized, prospective applicability boundary for an allowed termination target. It does not delete a record or infer generation-wide revocation. | `issuer policy.action`, `compatibility tuple.action` |

An `authority evidence` record in v1 uses `grant` only. Lifecycle actions are
represented by their dedicated immutable records and exact references; a
decoder MUST reject `revoke`, `supersede`, or `terminate` in
`authority evidence.action`. No action is implied by a lifecycle status,
timestamp, generation change, session loss, or source class.

## 3. `SourceClass` literal registry

`SourceClass` is a closed description of the provenance category, not a trust
verdict and not a migration classification. It uses the following literals.

| Literal | Canonical meaning | Relationship to migration classification |
|---|---|---|
| `k333_codec` | Bytes obtained from the K-333 canonical codec family. The codec is an input format, not a durable K-334 authority resolver. | No A–F classification is inferred; a future migration may classify a concrete source separately. |
| `owner_evidence` | A separately recorded owner-evidence source bound by the relevant K-334 publication/evidence contract. | No classification is inferred from the label alone. |
| `legacy` | A pre-K-334 source candidate such as the documented legacy Notes, handoff, or reviewed-manifest inputs. | Requires an explicit A–F migration classification before any future migration handling. |
| `migration` | A K-334 migration-produced metadata source, such as a classification, checkpoint, or recovery marker. | It is metadata only and cannot classify itself into authority. |

`SourceClass` serializes as the exact literal. `provenance.sourceKind` uses
the same four literals and the same meanings in v1; the two names must not be
mapped through an alias table. Strict K-334D3A decoding performs only literal,
type, and syntax validation. A value not listed above fails closed.

### Source-descriptor evidence validation boundary

The source descriptor, cross-record source binding, source digest provenance,
and A–F migration classification are not inputs to a single-record strict
decoder in v1. They are later-layer evidence validation responsibilities. A
strict decoder MUST NOT query storage, resolve a descriptor, decide whether a
`legacy` source is classified, infer authority, or make a migration decision.
Conversely, later evidence validation MUST NOT treat successful literal
decoding as proof of source authority.

## 4. Termination `targetKind`

`targetKind` is a closed enum for a termination record. It names the exact
immutable record category being prospectively bounded.

| Literal | Permitted target record identity prefix | Meaning |
|---|---|---|
| `authority_evidence` | `dar:v1:authority-evidence:` | One exact grant-evidence record. |
| `issuer_policy` | `dar:v1:issuer-policy:` | One exact issuer-policy record. |
| `rollback_permission` | `dar:v1:rollback-permission:` | One exact rollback-permission record. |
| `compatibility_tuple` | `dat:v1:` | One exact compatibility tuple. |
| `external_subject_mapping` | `dar:v1:external-subject-mapping:` | One exact external-subject mapping. |
| `external_issuer_mapping` | `dar:v1:external-issuer-mapping:` | One exact external-issuer mapping. |

Valid v1 transitions are prospective only: a termination identifies exactly
one target of the matching kind and may end only that target's future
applicability after its exact boundary. The target remains immutable and
preserved. A termination record may itself be superseded or terminated only
by later explicit evidence under the existing D01-A policy; that later
evidence is outside this decoder registry.

The following are invalid combinations: a prefix that does not match
`targetKind`; a target that is an observation, quarantine, migration session,
migration classification, checkpoint, marker, audit event, or derived head;
a target identifier equal to the termination record identifier; or any request
to delete, overwrite, retroactively reclassify, or broadly terminate a
namespace, generation, subject, or source class. Unknown target kinds fail
closed.

## 5. Migration `sourceKind` and A–F classification

The migration classification record uses the same closed `SourceClass` literals
for `sourceKind`: `k333_codec`, `owner_evidence`, `legacy`, and `migration`.
A strict decoder validates only that literal and the separately encoded source
digest; it does not resolve a descriptor or select a classification. In a later
authorized evidence-validation layer, any descriptor assignment MUST bind the
exact source descriptor and digest, never a filename, timestamp, account,
session, browser profile, arrival order, or payload resemblance. No descriptor,
more than one competing descriptor, or a descriptor/digest mismatch fails
closed in that later layer.

The `classification` field is a separate closed enum. Its letters are
serialized exactly as upper-case ASCII `A` through `F`.

| Class | Canonical value | Detection rule | Required future disposition |
|---|---|---|---|
| A | `A` | Exact source identity, digest, required policy, exact compatibility tuple, exact mapping, and all graph validation are present and non-conflicting. | May be considered for later verified migration only; classification alone never accepts or activates authority. |
| B | `B` | Source bytes and identity are preserved, but required policy, tuple, mapping, or other required authority evidence is absent. | Preserve as pending; no promotion. |
| C | `C` | Exact subject/source evidence is unsafe, conflicting, forked, ambiguous, foreign, or requires quarantine. | Preserve and quarantine/block the affected exact scope; no promotion. |
| D | `D` | Source is syntactically supported but is expressly non-authoritative for the asserted authority purpose. | Preserve as rejected/non-authoritative; no promotion or inferred retry. |
| E | `E` | Source is unsupported, malformed, corrupted, or has an invalid semantic field or canonical encoding. | Preserve only bounded unsupported/malformed evidence; no decoding acceptance. |
| F | `F` | No eligible authority source exists for the asserted input, including a known codec or coordination source that is not authority evidence. | Record no-source state only; no promotion. |

The later evidence-validation sequence is deterministic: validate the exact
source descriptor; bind and verify its digest; reject semantic/canonical
invalidity as `E`; detect exact-subject conflict or fork as `C`; determine the
explicit authority evidence set; select `A`, `B`, or `D` only from that
complete set; use `F` only when no candidate source exists. If more than one
class is plausible, select none and fail closed rather than ranking classes.
The class table records a future migration disposition; it does not authorize
migration execution.

## 6. `LifecycleStatus` registry

`LifecycleStatus` is a closed lower-case ASCII enum. It serializes as the
exact literal, has no aliases, and rejects case variants and unknown values.

| Literal | Canonical semantic meaning |
|---|---|
| `proposed` | Immutable evidence is proposed but has no inferred applicability. |
| `recorded` | Immutable evidence has been recorded; recording alone is not acceptance. |
| `accepted` | A later policy layer has accepted exact evidence; decoding the literal does not make that decision. |
| `superseded` | Exact prior evidence has a later explicit prospective supersession; historical evidence remains preserved. |
| `terminated` | Exact prior evidence has a later explicit prospective termination; no deletion or retrospective rewrite occurs. |
| `rollback_applied` | A later exact rollback policy/evidence transition has been recorded; no decoder performs rollback. |
| `unsupported` | The retained input is unsupported and not accepted authority. |
| `malformed` | The retained input is malformed and not accepted authority. |

The field's allowed record-kind placement follows K-334C3 record shapes. A
future extension requires an explicit versioned registry and compatibility
change; it cannot be accepted by a v1 fallback.

## 7. `MappingKind` registry

`MappingKind` is a closed lower-case ASCII enum.

| Literal | Required record kind and `internalId` role | Meaning |
|---|---|---|
| `subject` | `external_subject_mapping`; `internalId` is a `SubjectId` | One explicit external-to-subject association. |
| `issuer` | `external_issuer_mapping`; `internalId` is an `IssuerId` | One explicit external-to-issuer association. |

The value serializes as the exact literal. A mismatch between the literal,
record kind, or internal-identifier role is invalid. `MappingKind` validation
means literal and record-shape validity only; it does not resolve authority,
select a mapping, resolve conflict, or make a migration decision. Unknown
values, aliases, and case variants fail closed.

## 8. `QuarantineState` and `permanent`

`QuarantineState` has one v1 literal: `forked`. It serializes exactly as
lower-case ASCII. It represents the K-334C2 D03-A permanent quarantine for one
exact subject after fork evidence; it selects no winner and has no release,
remediation, or automatic transition. A value other than `forked` is invalid.
Any future state requires a separately reviewed versioned policy decision.

`permanent` is a JSON boolean scalar: `true` and `false` are the only valid
serialized values. Strings, numbers, `null`, omitted values where required,
and truthy/falsy coercion are invalid. In the v1 `subject_quarantine` record,
`permanent` MUST be exactly `true`; `false` is a valid boolean scalar in the
abstract but invalid in that record context.

## 9. `AuthorityBoundary` contract

The existing canonical `AuthorityBoundary` fields are, in fixed K-334C3 field
order: `effectiveSequence` (positive safe integer),
`effectiveAfterRecordId` (strict `RecordId` or explicit `null`), and
`prospectiveOnly` (boolean literal exactly `true`). They serialize as their
native canonical number, string-or-null, and boolean representations. A zero,
negative, unsafe, fractional, string-encoded, or omitted sequence; malformed
record ID; or `false`/coerced `prospectiveOnly` value is invalid.

Authority scope is expressed by existing record fields, not by adding a second
boundary object: `issuerId` and `subjectId` are required strict identifiers
where the K-334C3 record kind declares them; the exact namespace and
compatibility tuple bind scope; and `action` is the applicable
`AuthorityAction`. There is no v1 `deniedAction` field. Denial is represented
by the absence of an exact allowed action/tuple/policy at a later policy layer;
a decoder MUST reject an invented `deniedAction` field as unknown.

Strict decoder validation is limited to required field presence, scalar type,
closed-registry membership, identifier/digest syntax, fixed field order, and
the context restrictions stated here. Policy validation separately decides
relationships, authority, compatibility, lifecycle applicability, conflicts,
and migration effects. A strict decoder makes none of those policy decisions.

## 10. `ReasonCode`

`ReasonCode` is a closed enum of bounded, privacy-safe diagnostic semantics.
It serializes as the exact lower-case ASCII literal.

| Literal | Permitted semantic use |
|---|---|
| `ambiguous_mapping` | More than one mapping candidate or no unique exact mapping. |
| `competing_successor` | More than one distinct successor claims an exact predecessor position. |
| `conflicting_candidate` | Distinct canonical candidates occupy one exact logical position. |
| `confirmed_fork` | Exact-subject fork evidence requires permanent quarantine. |
| `incompatible_tuple` | Required exact compatibility tuple is missing, duplicated, or not exact. |
| `incomplete_source` | A declared source lacks required bounded evidence. |
| `invalid_canonical_bytes` | Canonical bytes, framing, digest binding, or field order is invalid. |
| `invalid_semantic_field` | A value violates a registry, scalar, or record-kind semantic rule. |
| `missing_required_evidence` | Required authority, policy, mapping, or lifecycle evidence is absent. |
| `unavailable_source` | No declared source can be read or bound to the exact descriptor. |
| `unsupported_record` | A record type, schema version, or source representation is unsupported. |

The grammar is `^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`, with a maximum length of
64 bytes. It is ASCII-only, lower-case, and NFC by construction. Whitespace,
hyphens, leading/trailing underscores, empty strings, case variants, and
unlisted grammar-valid values are invalid. A reason code is bounded context;
it MUST NOT contain payload, identifiers, secrets, exception text, or a stack
trace.

## 11. Namespace scalars

All namespace scalars are lower-case ASCII, exact, and opaque outside their
declared role. A decoder MUST reject rather than normalize a value. In
particular, it MUST NOT trim whitespace, Unicode-normalize, change case,
decode percent escapes, or infer one namespace from another field.

For every K-334C3 record field named `namespaceKey`, the v1 scalar type is
`NamespaceKeyV1`; `NamespaceKeyV1` replaces the earlier incompatible
`namespace.<IdentifierSegment>` notation in this clarification.

| Scalar | Format and limits | Meaning and invalid handling |
|---|---|---|
| `RepositoryNamespace` | `absinthe.installation.` followed by an `IdentifierSegment`; total 24–128 bytes. | Names the repository installation scope. Missing, wrong prefix, or different exact value is invalid. |
| `NamespaceKeyV1` | Exactly 64 lower-case ASCII hexadecimal characters: `^[a-f0-9]{64}$`. | The exact K-321 `namespaceFingerprint()` SHA-256 representation. It is not a user ID, project ref, or device ID and cannot be reconstructed by a decoder. |
| `SubjectNamespace` | `subject.` followed by an `IdentifierSegment`; total 9–128 bytes. | Names the subject identity namespace for exact subject binding. |
| `IssuerNamespace` | `issuer.` followed by an `IdentifierSegment`; total 8–128 bytes. | Names the issuer identity namespace for exact issuer binding. |
| `InstallationNamespace` | Exact `RepositoryNamespace` spelling. | Compatibility tuples bind an installation namespace to the same exact installation scope; aliases are invalid. |

`IdentifierSegment` is `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`, 1–96 bytes,
with no repeated separator, no leading/trailing separator, and no Unicode.
`NamespaceKeyV1` is lower-case ASCII hex only: uppercase, non-hex characters,
incorrect lengths, alternate textual forms, and empty values are invalid. The
field's exact serialized value is its canonical value. K-334 namespace identity
reuses K-321 `namespaceFingerprint()`; no second namespace identity or decoder
invented representation exists. A valid scalar is still not proof of
authority, compatibility, membership, source eligibility, or activation.

## 12. Decoder handoff and non-authorization

A future K-334D3A strict decoder can consume this document directly: validate
closed literals by exact membership, validate namespace scalars before record
construction, enforce the record-kind placement rules, and reject all unknown
or malformed semantic input. It can determine allowed literals, scalar formats,
registry membership, serialization representation, and unknown behavior. It
must retain the existing K-334C3 canonical field order, identifier, framing,
digest, and domain rules rather than constructing alternate representations.

The decoder still must not infer authority, perform migration decisions,
resolve conflicts, execute quarantine, modify runtime behavior, or use a
successful decode as acceptance.

This document does **not**:

- authorize K-334D implementation or create any new implementation authority;
- modify existing codecs or create runtime behavior;
- satisfy D0-P09 or D0-P10;
- authorize schema, migrations, IndexedDB, repositories, transactions,
  admission, eligibility, activation, source migration, or production rollout.

It is semantic clarification only. Existing authorization boundaries and the
current production-inactive posture are unchanged.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
