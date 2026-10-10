# REL-05G Health identity: prospective provenance capability decision

Task: `REL_05G_HEALTH_ID_PROSPECTIVE_PROVENANCE_CAPABILITY_DECISION_01`.

Status: `PROSPECTIVE_PROVENANCE_CAPABILITY_DECISION_PACKAGE_COMPLETE_PENDING_INDEPENDENT_REVIEW`.

`RECOMMENDED_PRODUCT_OPTION = NO_CAPABILITY_SELECTION_YET`; `RECOMMENDATION_CONFIDENCE = HIGH` for deferring commitment until a defensible issuer and support envelope are identified, **not** high confidence that any new capability will work.

`PRODUCT_OWNER_DECISION_STATUS = REQUIRES_EXPLICIT_APPROVAL`. No option is selected or approved by this document, publication, CI, review, or eventual merge. This is a bounded product/architecture comparison, not an implementation plan, issuer specification, recovery procedure, data-collection authorization, or platform qualification.

## 1. Merged baseline and authoritative inputs

| Item | Verified value |
| --- | --- |
| Repository / canonical workspace | `Absinthe-6785/Absinthe`; `C:\Users\이도현\GitRepos\Absinthe` |
| Base / live main | `d4979651d87312fec4f7204ae0e00093b45144d3` |
| [PR #767](https://github.com/Absinthe-6785/Absinthe/pull/767) | `MERGED / CLOSED`; reviewed head `081dea48bd262ffd10723052504df089bc811f54` |
| PR #767 merge commit | `d4979651d87312fec4f7204ae0e00093b45144d3` |
| [Post-merge CI 38054478051](https://github.com/Absinthe-6785/Absinthe/actions/runs/38054478051) | Exact merge SHA; completed/success for test, typecheck, build, backend-rel05g1, backend-recovery |
| Evidence date | 2026-10-10 |
| Current historical result | `NO_CURRENT_RETROACTIVE_TRUSTED_SOURCE_FOUND` in the current verified repository-defined source set |

All seven requested merged inputs were read completely:

- [Recovery contract and eight approved product decisions](REL-05G-health-parent-established-identity-recovery-contract-and-product-decision.md).
- [Exact-original provenance feasibility](REL-05G-health-id-exact-original-provenance-feasibility-characterization.md).
- [Established identity correction characterization](REL-05G-health-parent-established-device-id-correction-characterization.md).
- [E3 controlled-platform procedure feasibility](REL-05G-workout-device-lifetime-e3-controlled-platform-procedure-feasibility.md).
- [Admission evidence and writer-safe routing](REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md).
- [Bootstrap-admission prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md).
- [Device-lifetime authority contract and plan](REL-05G-workout-device-lifetime-authority-contract-and-plan.md).

Their publication-time pending-review/next-step text is historical. PR #767's verified closure supplies the present documentation baseline, not runtime acceptance. The later reviewed recovery contract's distinction between unproven continuity and an actually necessary semantic change governs this package; older planning text must not turn missing proof into an unconditional writer-transition requirement.

Source cross-checks at this base confirm: the [active helper](../src/lib/workoutLocalReaderAuthority.ts) retains one current mirror and has no history issuer; [namespace fingerprinting](../src/lib/localDatabase/namespace.ts) hashes exact user/project/device/schema inputs; [local types](../src/lib/localDatabase/types.ts) specify DB 7/schema 1. The helper preserves accepted case and can accept namespace-safe non-UUID historical values. No strict historical UUID conversion, alias, normalization, or rekeying is proposed. The [dormant lifetime foundation](../src/lib/workoutDeviceLifetimeAuthority.ts) is not a production provenance issuer. This task relies on #767's reviewed source inventory, not a claim to have performed a new repository-wide incident search.

No real localStorage, IDB, Supabase row, support archive, browser profile, backup, or physical device was inspected. Public platform documentation was checked for capability ceilings only; no target-browser behavior was qualified.

## 2. Decision question and preserved policy

**Should Absinthe commit to a new prospective capability able to establish `PROVEN_EXACT_ORIGINAL_ID` for future incidents, and accept its support, privacy, trust-root, and engineering costs?**

The answer cannot change the meaning of original identity to first server sighting, enrollment identity, current valid mirror, or whichever candidate still exists. Trustworthy issuance must precede the incident and prove originalness for the affected installation. Enrollment of an existing installation with no earlier chain cannot certify its first identity. A truly new installation could be eligible only with independently justified construction/first-issuance semantics; absence of current metadata is not that proof.

`APPROVED_POLICY = POLICY_F_PROVEN_ORIGINAL_OPERATOR_CONDITIONAL_NO_NEW_TARGET` remains unchanged. All eight already-approved selections are inherited, not new approval requests:

| ID | Preserved approved selection |
| --- | --- |
| HEALTH-ID-PD01-A | `B_PROVEN_EXACT_ORIGINAL_OR_DENY_ESCALATE` |
| HEALTH-ID-PD02-A | `NO_AUTOMATIC_REPLACEMENT` |
| HEALTH-ID-PD03-A | `NARROW_CURRENT_ACTIVE_GENERATION_WITH_PROVEN_EXACT_ID_AND_UNCHANGED_WRITERS` |
| HEALTH-ID-PD05-A | `A_NO_NEW_TARGET_RECOVERY_IN_THIS_WORKSTREAM` |
| HEALTH-ID-PD06-A | `CONDITIONAL_INTERNAL_OPERATOR_ONLY_NO_CURRENT_EXECUTION_END_USER_SELF_SERVICE_DEFERRED` |
| HEALTH-ID-PD07-A | `TYPED_LOCAL_RECOVERY_REQUIRED_UNAVAILABLE_CONDITIONAL_ASSISTED` |
| HEALTH-ID-PD08-A | `ONE_MANUAL_RETRY_PER_TRANSIENT_EPISODE_NONE_FOR_UNCHANGED_DETERMINISTIC_FAILURE_FRESH_READ_AFTER_AUTHORIZED_CORRECTION` |
| HEALTH-ID-PD09-A | `PROVENANCE_FEASIBILITY_FIRST_FOR_CONTROLLED_OPERATOR_PATH_REMAIN_UNSUPPORTED_UNTIL_QUALIFIED` |

This new decision concerns prospective investment only. It does not reopen those selections, DEVLIFE/ADMIT/ER approvals, exact historical compatibility, or technically fixed evidence/writer/review constraints. Any proposal needing a different definition of originalness or broader support must return for a separately reviewed policy revision, not quietly reinterpret this package.

## 3. Fixed proof standard and platform evidence ceiling

Any future `AUTHORITATIVE_PROVENANCE` claim must satisfy **all ten**, not a weighted score:

1. Exact device-ID bytes in the original supported representation.
2. Exact case; UUID-value equality is not namespace equality.
3. Trustworthy original issuance before the future incident, not an operator's later timestamp.
4. Historical authenticated account binding, including account transitions and the affected history.
5. Same origin/storage-installation/container binding or a specifically justified equivalent; account, domain, random installation label, IP, and device name alone are insufficient.
6. Authenticity/integrity excluding guessing or user/operator fabrication; signer trust must cover the asserted proposition.
7. History distinguishing original, replacement, other device/profile/container, copying, and rollback.
8. No circular derivation from damaged/replacement state being repaired.
9. No post-incident self-issued record promoted to earlier proof.
10. A reviewable issuer/collection/custody/verification/scope/precedence/applicability trust chain.

The merged contract's current narrowly scoped permit, consent, real retained-scope reachability, complete affected-account coverage, and privacy/security requirements remain additional recovery gates. A historical provenance record is not a permanent permit to mutate identity.

| Primary source checked | Documented ceiling | Inference for this decision, not physical proof |
| --- | --- | --- |
| [HTML Storage interface](https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface) | Application access to the current key/value map | Another local key is not independently authenticated issuance history. |
| [Storage keys/sheds](https://storage.spec.whatwg.org/#storage-keys) | Storage placement is scoped through origin/user-agent storage structures | A web origin is not a unique authenticated historical browser-profile identifier; actual installation/partition mapping remains unqualified. |
| [Web Crypto key storage/security](https://www.w3.org/TR/webcrypto/#security-considerations) | Cryptographic primitives and key storage rely on the execution/storage security environment | A page-created signing key, including a non-extractable key, does not by itself authenticate original creation; permitted signing operations can still sign claims. No anti-rollback hardware guarantee is inferred. |
| [WebAuthn RP ID](https://www.w3.org/TR/webauthn-3/#rp-id), [credential backup state](https://www.w3.org/TR/webauthn-3/#sctn-credential-backup-state) | RP-scoped credential authentication; credentials can be multi-device/backup eligible | Credential possession or user verification is not first Health mirror issuance or unique storage-container identity. Even a single-device credential needs a separate issuance/container chain. |
| [Supabase JWT](https://supabase.com/docs/guides/auth/jwts) | Authenticated user subject and authorization claims | Account submission is useful corroboration, not an installation issuer. |
| [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) | Row authorization and table/API grants are separate controls | Any future C/D registry needs explicit exposure/owner controls; neither RLS nor append-only storage proves client originalness. No deployed grant state was inspected or inferred. |

The Supabase changelog was checked; its published new-table exposure rollout does not establish this project's actual configuration. No SQL, endpoint, policy, key, or advisor mutation follows. Standards describe capabilities, not Edge/iPhone qualification or an approved new issuer. These inferences reject naive constructions, not every possible future web/platform architecture.

Threat boundaries must remain explicit: accidental mirror corruption, ordinary editable local records, stale clients, copied/rolled-back profiles, authenticated false claims, compromised accounts, and compromised issuers are different risks. This package does not expand the approved runtime threat model into a promise to withstand fully compromised browsers/origins. It also cannot dismiss fabrication/copy ambiguity when claiming the stronger ten-property provenance standard. A future security review must identify which evidence survives each threat; excluding a threat from runtime support does not make ambiguous evidence authoritative.

## 4. Option A — no new provenance capability

`OPTION_A_NO_NEW_CAPABILITY = FEASIBLE` as a product posture, **not** feasible recovery of currently unproven incidents.

Keep current local-first identity behavior and Policy F deny/escalate when independent proof is absent. Add no identifier history, registry, trusted issuer, telemetry, or new retention surface. Simplicity/privacy/core offline behavior are strongest; no new trusted infrastructure or enrollment friction is introduced. Ordinary acquisition behavior remains unchanged, including the distinction between raw creator and established reader.

The cost is an explicit recovery ceiling: future malformed/lost-established cases lacking independent evidence remain unsupported indefinitely under this choice. Retained bytes may be inaccessible; unavailable must never be presented as verified empty, safe replacement, or cloud-complete recovery. Retry/restart is not original-ID repair. Support can explain/escalate, not manufacture provenance or advise clearing data.

`CAN_EVENTUALLY_SUPPORT_REL05G5A_001_CORRECTION = NO` **from this option/current verified sources alone**. Acceptance of unrecoverable cases cannot close the runtime prerequisite through copy alone. If a genuinely independent historical source is later proven, that source-specific path requires separate review; A is not a universal assertion that no external evidence can ever exist. A permanent support-limit commitment needs explicit owner choice and honest future UX, neither implemented here.

`WRITER_SEMANTIC_CHANGE_REQUIRED = NO` for retaining the current posture; existing recovery continuity remains unproven. `E3_DEPENDENCY = NOT_APPLICABLE` to adding provenance because A adds none; E3 remains independently unresolved for any future recovery/admission.

## 5. Option B — prospective trusted local provenance

`OPTION_B_TRUSTED_LOCAL = CONDITIONAL`; no qualifying local issuer has been identified in the current ordinary-web product.

Distinguish **B0 `LOCAL_REDUNDANT_COPY`** from **B1 `TRUSTED_LOCAL_PROVENANCE`**. B0 stores the mirror twice, possibly with a hash/local clock/page-controlled signature. It can improve availability after a mirror-only accident but cannot satisfy the independent original-issuance/account/container/history chain. B0 is **INFEASIBLE as authoritative proof**, not an acceptable low-cost implementation of B1. It is not selected as an alternative recovery feature here.

B1 needs a source whose authority covers original creation and the relevant installation, plus integrity, trustworthy pre-incident precedence, account history, anti-rollback/copy discrimination, and incident survival. An authenticated external issuer's record retained locally is possible in principle but inherits C/D/E trust dependencies; local storage location alone is not its root. A privileged platform-local issuer could support offline issuance only if its actual guarantees are qualified. Neither source is present or approved.

| Required question | B1 boundary |
| --- | --- |
| Who issues / initial authority? | Independently justified creation witness or platform root before first identity use; ordinary page assertion/adoption of unproven existing bytes is insufficient. |
| Exact bytes/case and historical accounts? | Authenticated literal and account-specific history, not namespace inversion; pre-login creation needs a separately evidenced later account-binding rule, not guessed ownership. |
| Can app code rewrite? | If it can rewrite/re-sign authoritative claims without independently constrained issuance, the result is B0. Non-extractability alone does not constrain claim truth. |
| Rollback / old clients? | Need independent freshness/history or explicitly deny ambiguous rollback; old builds bypassing issuance remain unqualified, not silently upgraded. |
| Incident survival / offline? | Mirror-only corruption may leave the artifact; origin-wide loss can destroy both. Offline verification may be possible with retained trusted material; trustworthy offline issuance/precedence is a separate missing capability. |
| Sign-out / account change? | Preserve device continuity without leaking another account's history; account auth alone never confers all shared-mirror scopes. |
| Profile copy / restore? | A copied record/key cannot automatically identify the original container. Content portability does not transfer identity authority; importing dormant lifetime/adoption state remains prohibited. |
| Privilege / admission / writer? | Native/browser-managed root may be needed; any use of admitted lifetime must first satisfy bootstrap evidence. Creation/retry/readiness timing changes trigger the separate writer prerequisite. |

Pure web-only redundancy is the only concrete local mechanism found in the current contracts; it is insufficient. No broader browser impossibility theorem or platform-key support claim is made. A distinct future portable provenance envelope would require separate approval/design; it cannot silently change today's data-only export/restore contract.

`CAN_EVENTUALLY_SUPPORT_REL05G5A_001_CORRECTION = CONDITIONAL` on actual ten-property proof and all recovery gates. `WRITER_SEMANTIC_CHANGE_REQUIRED = CONDITIONAL`; `E3_DEPENDENCY = INTERACTS` if issuance uses lifetime/admission. Admitted variants require qualified admission first; local authenticity never proves creator quiescence.

## 6. Option C — prospective remote provenance

`OPTION_C_REMOTE = CONDITIONAL`; a first-client-report registry alone is **INFEASIBLE as authoritative original-installation proof**.

An authenticated server can retain exact ID text/case, account submission, chronology, version history, and custody independently of later local storage loss. It must not normalize device text or repurpose existing mutation receipts/bindings as a new issuer. First server sighting can follow offline first creation, replacement, or a second profile; a signed/immutable record of that sighting preserves the claim, not proof that it was first local issuance.

For illustration only, a separately approved server-issued identity at genuinely attested new-container construction could supply stronger issuance semantics. The server must still justify that construction and bind the issued value to the affected local scope before its first use; server-generated bytes alone do not do that. This is not a command to make identity creation online, rotate an existing ID, select an enrollment algorithm, or change Policy F.

| Concern | Required product/architecture boundary for C |
| --- | --- |
| Issuance / account / container | Authenticate issuer and historical owner; demonstrate first creation and independent installation binding, not user/device-label self-report. |
| Offline first creation / local-only | Ordinary core use must remain local. Without a qualified offline witness, later registration cannot authenticate earlier originalness; those installations/incidents stay unsupported. Remote-first issuance would change the core contract and require new explicit scope. |
| Multiple devices/profiles | Distinct installation histories; one account can have many valid IDs. Copied same-account tuple or earliest timestamp cannot select the affected original. |
| Reinstall / reset / replacement | Keep originals and later events distinguishable; data reset is not identity reset. New container/rotation/migration requires separate decisions; no reuse of an old installation credential by assumption. |
| Integrity / replay / rollback | Ordinary clients cannot rewrite history; privileged custody, issuer-key compromise, duplicate claims, replayed receipts, local rollback, and revocation require reviewed controls. Server ordering alone cannot detect an unobserved copied profile. |
| Privacy / deletion / transparency | Minimal account-linked identity history only, not Health payload/transport telemetry; disclose purpose, retention, operator access and deletion consequences. No retention duration or collection opt-in is approved here. |
| Least privilege / backend | New backend/schema/API/RLS or equivalent service and separate security/privacy review; owner-scoped access, no frontend privileged keys, no user-editable metadata as issuance authority, no blanket operator access. |
| Network failure | Core use continues unchanged; optional provenance enrollment/retrieval can be unavailable. Do not silently block/retry writers or mark unrecorded identity authoritative. Offline recovery cannot presume a live server or fresh revocation data. |

`CAN_EVENTUALLY_SUPPORT_REL05G5A_001_CORRECTION = CONDITIONAL`. `WRITER_SEMANTIC_CHANGE_REQUIRED = CONDITIONAL`: passive optional notarization might not change writers but does not prove originalness; making server issuance authoritative before identity/repository use **would** change acquisition/timing/readiness and trigger the separate high-risk prerequisite. No writer-neutral sufficient variant is proven. `E3_DEPENDENCY = INDEPENDENT` for the historical proof proposition; any construction/admission interaction must be separately qualified, and safe recovery still requires lifecycle proof.

## 7. Option D — hybrid provenance

`OPTION_D_HYBRID = CONDITIONAL`. Local retention plus remote custody can improve survival/availability, but two copies of one unverified claim are not two independent issuers. D is not selected merely because it combines B/C.

| Conceptual structure | Potential value | Missing proposition / verdict ceiling |
| --- | --- | --- |
| Local ID + server notarization | Exact claim, independently dated submission, local proof cache | Original local creation/container still unproven; corroboration only absent a qualified witness. |
| Server-issued ID + local durable binding | Server can witness its own issuance, local core may operate after enrollment | Must prove genuinely first use in the correct construction scope; offline-first gap, copies and writer changes remain. |
| Challenge/receipt chain | Fresh possession and authenticated chronology | Possession is not originalness; a copied credential/false initial claim can answer challenges. |
| Local creation event + immutable remote append | Can outlive later local mirror loss | Needs independent authentic local event/precedence/container; immutable append cannot authenticate a fabricated event. |
| Future authority/adoption record + server custody | Could bind reviewed prospective control events to account history | Dormant/adopted current bytes are not first issuance, admission is unqualified, and custody does not close E3. |

A plausible future D needs a demonstrably independent original-creation witness plus authenticated retention, justified installation scope, exact historical account binding and freshness/history/copy semantics. That could involve a new E-like root. It remains a hypothesis requiring source-specific feasibility, not an endorsed implementation. No challenge algorithm, record schema, transaction sequence, key-management protocol or recovery commit design is defined.

Local-first compatibility is conditional: ordinary use must not wait for the registry, while unqualified offline/local-only/pre-enrollment incidents must be clearly excluded. If the proof actually requires network before first identity use, the ordinary-use dependency cannot be hidden behind an optional-recovery label; return for an explicit core-product/writer decision. Local proof caches cannot extend revoked permits indefinitely or recreate deleted history.

`CAN_EVENTUALLY_SUPPORT_REL05G5A_001_CORRECTION = CONDITIONAL`; `WRITER_SEMANTIC_CHANGE_REQUIRED = CONDITIONAL`; `E3_DEPENDENCY = INTERACTS`. Issuance/adoption participation can depend on admission, but identity proof, current lifecycle and recovery control remain separate.

## 8. Option E — privileged/platform issuer

`OPTION_E_PRIVILEGED = CONDITIONAL`, evaluated because no ordinary-web independent installation issuer is currently established. Stronger privilege is not itself a recommendation.

| Candidate root | Potentially stronger fact | Limit / product burden |
| --- | --- | --- |
| Native bridge / managed launcher | May witness controlled installation creation and constrain first entry | Must cover alternate launches/copies and bind actual storage scope; new install/update/support and trust chain, no deployed capability. |
| Extension | May observe browser-specific profile/entry facts under permissions | Coverage/permissions vary; no assumed iPhone equivalent or complete-scope authority. New distribution/security/platform scope. |
| OS/platform keystore or hardware-backed key | Potentially protected key custody and offline signing | Key possession does not attest Health's first ID, account history or browser-container origin. Key loss/backup/transfer and authorized signing remain unresolved. |
| Browser-managed credential | RP authentication and protected credential operations | RP/origin/user verification is not storage-installation attestation; sync/backup and multiple profiles defeat a naive one-key/one-container inference. No WebAuthn support qualification performed. |
| External trusted issuer | Independently verified construction/history/custody | Issuer must actually witness the required proposition, not sign user/operator declarations after the incident. |

Desktop/mobile and normal browser/installed-app scope may require different implementations, permissions and support programs. A managed platform restriction could be expensive and reduce portability/local-first independence. Any hardware/container link creates privacy/linkability and loss/revocation risks. No native tool, extension, OS observer, hardware binding, fresh-container migration or support service is authorized. This is **PATH B**: explicit new product/platform approval must precede further platform architecture work, followed by separate security, privacy and qualification gates.

`CAN_EVENTUALLY_SUPPORT_REL05G5A_001_CORRECTION = CONDITIONAL`; `WRITER_SEMANTIC_CHANGE_REQUIRED = CONDITIONAL` (enforced launcher/acquisition behavior changes trigger high-risk work); `E3_DEPENDENCY = INTERACTS`. A privileged identity witness is not automatically a complete continuous creator-exclusion/lifecycle issuer.

## 9. Local-first compatibility and support envelope

| Principle | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| Core use without network / offline mutation | Preserved | Must preserve; local root might operate offline | Must preserve optionality; remote-first core not authorized | Must preserve; enrollment-first dependency must be disclosed | Conditional platform availability; core cannot silently become host-dependent |
| Offline creation | Existing semantics | Trustworthy offline witness unresolved | Unsupported proof unless separate witness; later upload not original proof | Conditional independently authenticated local witness | Potential only after qualified root/precedence |
| No forced cloud for ordinary use | Yes | Yes for genuinely local root | Only optional future recovery aid; no compulsory enrollment | Conditional; fail if core waits on cloud without new approval | Cloud optional, platform dependency still a product cost |
| Account independence where applicable | Current behavior retained | Historical binding must not force login for ordinary use | Account-based recovery excludes unbound/local-only histories | Same explicit exclusion without forced core login | Host/credential enrollment must disclose account limits |
| Portability | Existing data-only portability | Proof is installation-scoped, not portable identity by copying | Account access is not transfer of installation identity | Cached proof cannot transfer authority | Often platform-bound; key/container transfer unqualified |
| Transparent failure / graceful degradation | Unsupported, not empty | Missing/ambiguous proof -> deny, unaffected core remains | Enrollment/network/retention failure -> no proof; core unchanged | Missing one essential chain -> no authoritative proof | Unsupported/root loss -> deny; no new target fallback |

`CORE_FUNCTION_REQUIRES_REMOTE = NO` for the preserved current product. `OPTIONAL_FUTURE_RECOVERY_PROVENANCE_REQUIRES_REMOTE = CONDITIONAL` for C/D (enrollment, retrieval, or freshness may need it); B/E depend on the proposed root. These are product constraints to be approved, not completed implementations. A recovery aid can be local-first-compatible while having explicit unsupported offline cases; it cannot advertise universal offline recovery or hide an ordinary-use cloud dependency.

## 10. Security/privacy decision matrix

Cells describe potential capability costs **if later selected**, not approved collection or present operational controls. B means B1, not B0; C/D mean a future qualified chain, not today's server records. Unknown controls remain prerequisites.

| Dimension | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| IDENTIFIER_RETENTION | No new history; current retention unchanged | Local exact issuance/history; lifecycle/limit undecided | New server history; duration/revocation/deletion undecided | Local proof plus remote history; two retention policies | Platform issuance/key history; custody/limits undecided |
| ACCOUNT_LINKABILITY | Existing only | Historical account associations locally sensitive | Persistent account/install linkage at service | Both locations link histories | Credential/host account association; avoid global hardware identity |
| DEVICE_LINKABILITY | Existing only | Container/key links may exceed current mirror | Remote installation/activity correlation risk | Combined correlation surface | Hardware/platform link potentially stronger |
| CROSS_ACCOUNT_RISK | Shared mirror still does not grant other-account access | Shared origin history must not expose other users | Wrong owner/support query can misattribute history | Local/remote owner mismatch cannot be merged | Device key must not authorize all users sharing it |
| MULTI_DEVICE_RISK | Unproven incidents remain unsupported | Copied proof/keys confuse originals | First report/earliest account record confuses devices | Correlated claims still ambiguous | Credential sync/host coverage can span devices |
| PROFILE_CONTAINER_BINDING_STRENGTH | No new binding | Unresolved independent root; local duplicate weak | Client claim weak unless independent witness | Conditional on witness, not receipt count | Potentially stronger, actual guarantees unqualified |
| SERVER_VISIBILITY | No new visibility | None for purely local root; external validation conditional | Exact minimal ID/account/history visible | Same plus cross-component associations | None or conditional external verifier/service |
| OPERATOR_VISIBILITY | No new access | No entitlement; narrowly consented future verification only | Least-privilege incident view required | Minimal paired verification, no payload dumps | Permissioned host/support facts; not blanket profile access |
| USER_VISIBILITY | Explicit unsupported ceiling needed | Enrollment/proof loss/coverage disclosures | Consent/purpose/retention/delete/support disclosures | Explain each dependency and gap | Permissions/platform/root/loss disclosures |
| DELETION_SEMANTICS | Existing behavior unchanged | Proof deletion ends coverage; no device/data reset | Delete policy can end recovery; backup/revocation retention unresolved | Explain partial deletion and custody lag | Key/root loss ends eligible chain; no silent reissue as original |
| ROLLBACK_RISK | Existing limits; no new detection | Same-storage rollback defeats naive proof; independent freshness needed | Server history helps chronology, not copied local container | Need cross-component freshness without false continuity | Keystore/key counter alone may not bind app history |
| REPLAY_RISK | No new protocol | Old artifact/permit cannot grant current recovery | Old registration/receipt cannot authorize new episode | Challenges cannot validate a false original enrollment | Valid credential signature is not original-ID permission |
| COMPROMISE_BLAST_RADIUS | No new root; existing incidents remain | Local compromise or common issuer-key compromise, root-dependent | Account compromise versus service/issuer compromise must be separated | Local compromise plus centralized root risks | Host/platform/supply-chain compromise can widen scope |
| DATA_MINIMIZATION | No additional data | Minimal exact ID/scope/trust references; no Health content | No IP fingerprinting, browsing logs, Health payloads or broad sync telemetry | Minimal identity evidence only, not duplicate content ledgers | No biometrics/raw hardware IDs/profile dumps by default |
| OFFLINE_BEHAVIOR | Core unchanged; no new recovery | Verification conditional retained chain/freshness; issuance unresolved | Core unchanged; unavailable enrollment/retrieval/freshness means no proof | Cache may help, never fabricate missing remote trust | Potential offline witness after qualified setup, not guaranteed |
| LOCAL_ONLY_USER_BEHAVIOR | Current use; unsupported without independent proof | Account history may be unbound; no automatic coverage | No registry proof if never enrolled; no forced login | Explicit local-only gap unless qualified alternate witness | Root availability/account binding must be demonstrated |

A future retained history must have explicit purpose, lawful/appropriate deletion and backup handling, minimal access, user transparency and cross-account separation. This task selects no retention duration, collection default, support entitlement or identifier schema. Consent is necessary where applicable but is not proof of originalness. Never expose service-role secrets in clients or treat user-editable auth metadata as issuer authority. No incident data is included in this public package.

## 11. Product experience matrix

| Dimension | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| NORMAL_USER_FRICTION | No new setup; loss may remain unrecoverable | Enrollment/proof retention, root-dependent | Optional enrollment/login/network, if approved | Multi-component enrollment/status complexity | Install/permissions/credential/managed platform friction |
| SETUP_REQUIRED | None new | Qualified root and exact historical binding | Qualified issuer/container enrollment | Qualified independent witness plus custody | Qualified platform/host/root and scope mapping |
| NETWORK_REQUIRED | None new | No for purely local qualified root; external trust conditional | Issuance/retrieval/freshness may require network | Depends on chain; offline gaps explicit | Root-dependent; no universal offline guarantee |
| LOGIN_REQUIRED | Current rules only | Ordinary use unchanged; recovery account binding required | Account-scoped service proof requires authenticated binding | Authenticated historical binding required | Platform identity is not account history; binding required |
| RECOVERY_SUCCESS_ENVELOPE | No newly supported cases | Post-qualified issuance, retained valid chain plus all recovery gates | Post-qualified first issuance, correct container/account and retained server chain | Complete independent chain and surviving components | Qualified platform scope/issuance plus all recovery gates |
| UNSUPPORTED_CASES | All without independent proof | B0, lost/copy/rollback/old-client/unbound/pre-issuance ambiguity | First-seen only, never-enrolled/offline-first ambiguity, lost custody | Correlated duplicates, incomplete chain, pre-enrollment ambiguity | Unsupported platform/permissions/root loss/copy/unproven scope |
| FAILURE_COPY_REQUIREMENT | Unavailable/unsupported != empty; no restart/clear repair promise | Proof unavailable/ambiguous, not inferred empty or replacement | Network/enrollment unavailable != lost data; no cloud-complete promise | State missing trust component without implying all history absent | Unsupported mode/root loss; no destructive setup workaround |
| SUPPORT_BURDEN | Explain ceiling; no repair service promised | Root/history verification and proof-loss cases | Account/custody/retention/network incident triage | Cross-component/key/version incident triage | Platform-specific installation/update/security/permission support |
| PLATFORM_COVERAGE | Existing use; no new recovery qualification | Edge/iPhone root/container guarantees unknown | Server may be portable; installation proof not yet cross-platform | Each local/platform link needs qualification | Fragmented desktop/mobile/PWA/browser; no inferred parity |
| MIGRATION_REQUIRED | No | No data migration approved; existing users may remain ineligible | No retroactive backfill as original; eligibility only by qualified source | No adoption-as-first-proof or silent identity migration | Existing browser move/profile/container transfer not authorized |
| OLD_VERSION_COMPATIBILITY | Existing behavior | Bypass issuers -> no trusted coverage | Legacy clients can report claims, not manufacture issuance | Partial participants cannot be promoted | Host/old-client bypass invalidates claimed scope |

Any future failure wording must preserve the merged finite read-Retry policy, typed distrust versus ordinary source failure, conditional legacy partial limits, local-only uncertainty, and warnings against clear-site-data/reinstall/profile switching/console edits. Translation/accessibility and actual supported-mode UX testing remain separate. No UI or support workflow is implemented.

## 12. Engineering cost and prerequisite matrix

These are qualitative comparative estimates for a **real sufficient capability**, not scheduling promises or authority to implement. A is retention of current posture; B0's cheaper duplicate is excluded. `SCHEMA_CHANGE` means potential new record/backend/platform schema in future scope, not a requirement to bump local DB 7.

| Dimension | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| IMPLEMENTATION_SCOPE | SMALL | LARGE | LARGE | VERY_LARGE | VERY_LARGE |
| BACKEND_CHANGE | NO | CONDITIONAL | YES | YES | CONDITIONAL |
| SCHEMA_CHANGE | NO | CONDITIONAL | YES | YES | CONDITIONAL |
| NEW_PERSISTED_STATE | NO | YES | YES | YES | YES |
| SECURITY_REVIEW | NOT_REQUIRED for no new capability; this document still reviewed | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| PRIVACY_REVIEW | NOT_REQUIRED for no new collection; support ceiling needs owner choice | REQUIRED | REQUIRED | REQUIRED | REQUIRED |
| WRITER_HIGH_RISK_PREREQUISITE | NOT_REQUIRED for unchanged posture | CONDITIONAL | CONDITIONAL | CONDITIONAL | CONDITIONAL |
| PHYSICAL_QUALIFICATION | NOT_REQUIRED for this no-capability choice; existing prerequisites not waived | REQUIRED | REQUIRED for installation binding/recovery mode | REQUIRED | REQUIRED |
| CROSS_PLATFORM_QUALIFICATION | NOT_REQUIRED for no new claim; existing obligations retained | REQUIRED | REQUIRED for advertised scope | REQUIRED | REQUIRED |

No finite estimate converts B/C/D/E into implementation-ready. Missing trust roots, account/container proof, incident survival, rollout compatibility and security/privacy choices are architecture blockers, not ordinary implementation details. DB/schema/backend needs require a new separately authorized scope; none may be added to this docs PR.

## 13. E3, writers, exact-target control and acceptance

| Option | CAN_EVENTUALLY_SUPPORT_REL05G5A_001_CORRECTION | WRITER_SEMANTIC_CHANGE_REQUIRED | E3_DEPENDENCY |
| --- | --- | --- | --- |
| A | NO from the chosen no-capability/current verified sources; a later independent source is a separate exception path | NO for keeping current posture | NOT_APPLICABLE to adding no provenance; recovery still independently blocked |
| B | CONDITIONAL | CONDITIONAL | INTERACTS; admitted-lifetime variants REQUIRES qualified admission |
| C | CONDITIONAL | CONDITIONAL; server-first authoritative acquisition would be YES for that variant | INDEPENDENT historical proposition; construction/admission interactions separately assessed |
| D | CONDITIONAL | CONDITIONAL | INTERACTS |
| E | CONDITIONAL | CONDITIONAL; enforced new launcher/acquisition semantics trigger separate work | INTERACTS; identity observer not automatically lifecycle issuer |

`WRITER_CONTINUITY_STATUS = NOT_YET_PROVEN`; `WRITER_SEMANTIC_CHANGE_REQUIRED = NOT_ESTABLISHED` for the unselected current recovery route; `SEPARATE_HIGH_RISK_WRITER_TRANSITION_PREREQUISITE_REQUIRED = CONDITIONAL`; `EXECUTABLE_RECOVERY_WITH_UNPROVEN_WRITER_CONTINUITY = BLOCKED`.

For **every** option, actual changes to productionSession cache (successful/rejected/in-flight), creator timing, identity acquisition, recovery timing, retry/failure behavior, repository reopen, readiness, queue/outbox ownership, bind/push/pull/reset semantics, or unsaved-work handling mean `SEPARATE_HIGH_RISK_WRITER_TRANSITION_PREREQUISITE = TRIGGERED` for that concrete proposal. Stop for separate explicit authorization/design/review/closure. An owner choosing a provenance option cannot waive this. Missing continuity proof alone does not establish that change is necessary, or prove that no change is needed; unresolved cases STOP pending proof/design. No eviction, forced logout/reload, drain or request rewrite is smuggled in as provenance setup.

`E3_FEASIBILITY = NOT_ESTABLISHED`; `LIFECYCLE_EVIDENCE_SOURCE = REMAINS_UNAVAILABLE`. Historical identity evidence answers WHAT exact target may be trusted, not `compatibleCreatorsQuiesced`, complete creator exclusion, lifecycle continuity or a safe recovery episode. A future root may interact with issuance/admission, but no option closes E3. Existing one-episode evidence limits and PATH A/PATH B boundaries remain intact.

`EXACT_TARGET_CONTROL_PROTOCOL = NOT_IMPLEMENTED`. A separately reviewed control protocol must determine HOW a future authorized exact target is safely committed, revoked/publication-fenced, crash-resumed and verified without orphaning or altering pending work. It is not designed here. Provenance is not permission to execute recovery or activate readers/writers.

`HEALTH-ID-C01` through `HEALTH-ID-C15 = REQUIRED / NOT EXECUTED` without exception. C04 needs the missing qualified chain; C05/C06 need real scope reachability and immutable pending evidence; C07/C08 need writer/creator continuity; C09 needs separate control/crash proof; C10 needs actual supported-case liveness, not unsupported copy; C11-C13 need currentness/source-truth/UX acceptance; C01-C03/C14/C15 remain implementation/regression/review/authorization obligations. Matrix feasibility, review PASS or selecting an option is not any criterion's PASS.

`REL05G5A_001_STATUS = ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION`. Even a qualified future issuer only supplies one prerequisite. No option selection alone closes this finding or any seven live-writer blocker.

## 14. Retroactive support ceiling

`FUTURE_PROVENANCE_DOES_NOT_RETROACTIVELY_RECOVER_OLD_INCIDENTS = YES` for A/B/C/D/E.

`RETROACTIVE_EXISTING_INCIDENT_SUPPORT = UNSUPPORTED_UNLESS_INDEPENDENT_HISTORICAL_SOURCE_IS_LATER_PROVEN`.

Current unproven historical incidents remain `DENY / ESCALATE / UNSUPPORTED`. A future enrollment, signed current file, restored outbox, immutable append, valid login or privileged observation after the loss cannot manufacture earlier issuance. An unknown external archive remains `UNKNOWN_EXTERNAL_OPERATIONAL_SOURCE`, not absent, available or authoritative. A source genuinely discovered later may change a particular incident's result only after authorized acquisition and source-specific proof/review. No such collection is authorized here.

For prospective eligibility, trustworthy issuance before an incident is necessary but not sufficient: it must prove original creation, installation applicability, account history and all remaining properties. An incident after server enrollment can still be ineligible if enrollment followed an earlier unproven replacement. This is not merely a timestamp cutoff.

## 15. Explicit feasibility verdicts and one recommendation

| Required verdict | Value | Exact meaning |
| --- | --- | --- |
| OPTION_A_NO_NEW_CAPABILITY | FEASIBLE | Available product posture with permanent unsupported ceiling absent independent evidence; not recovery completion. |
| OPTION_B_TRUSTED_LOCAL | CONDITIONAL | Requires a new justified issuer/root; ordinary local redundancy is insufficient; no practical authoritative ordinary-web-only mechanism established. |
| OPTION_C_REMOTE | CONDITIONAL | Requires true original-issuance/container semantics; first-reported registry is insufficient. |
| OPTION_D_HYBRID | CONDITIONAL | Requires independent creation evidence, not duplicated client claim; survival benefits alone are insufficient. |
| OPTION_E_PRIVILEGED | CONDITIONAL | New platform root and exact scope guarantees remain unqualified; explicit PATH B decision required. |

`CONDITIONAL` means a strategic option requiring unresolved prerequisite research/approval, not proof that a buildable sufficient mechanism exists, a promised future service, or permission to start architecture/implementation. No B/C/D/E option is `FEASIBLE` today under the unchanged proof standard.

**One recommendation: `NO_CAPABILITY_SELECTION_YET`.** Retain the already-approved current deny/escalate posture while asking the owner to choose an investment/support direction after independent review. This is not approval of A as a permanent ceiling. B lacks an identified practical independent local root; C first-seen semantics do not meet originalness; D cannot fix that by duplication; E may supply different facts but carries the largest platform/privacy/deployment commitment and no established cross-platform path. Selecting a registry now risks promising unsupported recovery or changing local-first writers to make a proof appear available.

Proof sufficiency therefore outweighs the attraction of prospective recovery value. Optional remote assistance could be compatible with local-first if its gaps are approved, but current unknown trust roots, privacy/retention choices, platform fragmentation, E3/writer/control blockers and substantial engineering cost do not justify self-committing to one. Confidence HIGH applies to this bounded deferral, not to infeasibility of every future mechanism. There is genuine potential value for future properly issued installations; that value warrants a human decision, not automatic implementation.

## 16. Product-owner decision request

`PROSPECTIVE_PROVENANCE_PD01`: **Which capability/investment direction, if any, should Absinthe commit to pursuing for future incidents under the unchanged ten-property proof standard?** All choices below remain `REQUIRES_EXPLICIT_APPROVAL`. No row is marked approved.

| Explicit choice | Commitment requested / tradeoff | Authorization ceiling of a future recorded selection |
| --- | --- | --- |
| A_NO_NEW_PROVENANCE_CAPABILITY | Accept no new recovery capability and ongoing unsupported malformed/lost-established cases without independent proof; simplest/private/local-first | Product support/investment policy only; no REL05G5A-001 closure, new UI or data mutation |
| B_TRUSTED_LOCAL_PROVENANCE | Pursue a genuinely independent locally retained issuer; accept root qualification and incident-survival limitations, not B0 duplication | Separate bounded trust-root/architecture request after decision publication closure; no root assumed available or storage rollout |
| C_REMOTE_PROVENANCE | Pursue authenticated prospective server custody with qualified first-issuance/container chain; explicitly assess optional network/login and excluded local-only/offline histories | Separate architecture/security/privacy request; no registry/table/API/RLS, collection or writer authorization |
| D_HYBRID_PROVENANCE | Pursue independent creation proof plus local/remote retention; accept combined cost and failure/privacy surfaces | Separate feasibility/architecture request; no correlated-claim promotion or challenge protocol approved |
| E_PRIVILEGED_PLATFORM_PROVENANCE | Pursue a new platform/privileged issuer and accept possible restricted coverage, setup/support and permissions | Explicit PATH B product/platform commitment first, then separately scoped architecture; no native/extension/keystore/managed deployment |
| HOLD_NO_CAPABILITY_SELECTION_YET | Defer selection; retain current denial posture without accepting it as permanent, specify whether any narrowly scoped root-feasibility research is wanted | No automatic follow-up research, collection, architecture or implementation; requires a separate bounded request |

The owner must state one exact choice or request a package revision, with scope constraints (core offline behavior, eligible users/platforms, permitted trust boundary and privacy/support commitment). No ambiguous “approve all recommendations” should silently select a capability: this package recommends HOLD, not an A-E bundle. If choosing B-E, retention, deletion, enrollment/defaults, account/container and unsupported-case policy remain **unresolved subsequent decisions**, not invented technical details or approved values. A conflict with inherited constraints must be revised/reviewed explicitly, not waived by approval.

Approval must come from a separate explicit human instruction referencing the reviewed decision package/head; publication must record its exact choice/provenance and non-authorization ceiling. Review, CI, Draft publication, silence, or this recommendation are not approval. This task requests no actual user-data collection and implements no selected capability.

## 17. Next-work branches and STOP gates

The immediate next action is **`REL_05G_HEALTH_ID_PROSPECTIVE_PROVENANCE_CAPABILITY_DECISION_INDEPENDENT_REVIEW_01`** on this publication's exact head. Independent review must check options, trust-root/originalness distinctions, privacy/local-first tradeoffs, approved-policy preservation, writer/E3/control separation, unsupported historical scope and absence of self-approval. Then obtain the explicit human selection and separately review its approval publication before Final Merge Gate, human merge and exact-main/post-merge verification. None of those later steps is executed by this package.

| Later owner branch | Required separately authorized work after reviewed canonical decision closure |
| --- | --- |
| A selected | Record the accepted support ceiling without claiming runtime closure; any user-facing changes need a separate scope/review. Preserve independent-source exceptions. |
| B selected | Qualify an actual issuer/root, original-creation/account/container/history and survival model before record design; B0 must not be relabeled trusted. Missing root -> STOP/return to owner. |
| C selected | Resolve first-local-creation versus first-server-seen and independently justified container chain, optionality/privacy/retention/least privilege, then separate architecture review. Backend/schema/API/RLS implementation and collection require additional authorization. |
| D selected | Demonstrate genuine source independence and which component attests each property, then separate architecture/security/privacy review; no counting duplicate claims as proof. |
| E selected | Explicit platform/PATH B commitment, then source-specific capability/permission/coverage/security qualification and architecture review. No ordinary PATH A inference grants privileged work. |
| HOLD selected / no choice | Remain current fail-closed/unsupported; no new capability. Any documentary root-feasibility follow-up requires its own bounded authorization. |

Every branch preserves no new recovery target, no historical rekey/adoption/migration, and no portable lifetime import. If a proposed sufficient issuer changes writer timing/acquisition/cache/readiness/retry/recovery or a frozen control contract, STOP for the separate high-risk prerequisite before implementation. If continuity is unresolved, STOP pending proof/design without asserting necessity. E3/lifecycle, exact-target control, implementation/regression/physical acceptance and activation remain separate gates. No selection may turn the current docs package into implementation-ready.

## 18. Frozen current authority and publication validation

| State | Retained value |
| --- | --- |
| APPROVED_POLICY | `POLICY_F_PROVEN_ORIGINAL_OPERATOR_CONDITIONAL_NO_NEW_TARGET` |
| CURRENT_PRODUCTION_AUTHORITATIVE_PROVENANCE_SOURCE | `NOT_FOUND` within current verified repository-defined sources |
| PRODUCTION_EXACT_ORIGINAL_PROVENANCE_AVAILABLE | `NO` |
| CURRENT_RETROACTIVE_EXACT_ORIGINAL_RECOVERY_PROVENANCE | `NOT_FEASIBLE` within `CURRENT_VERIFIED_SOURCE_SET / CURRENT_UNPROVEN_HISTORICAL_INCIDENTS` |
| CONTROLLED_OPERATOR_PROVENANCE_PATH | `NOT_FEASIBLE` for current unproven historical incidents |
| PROSPECTIVE_TRUSTED_LOCAL_RECORD / PROSPECTIVE_REMOTE_PROVENANCE_RECORD | `CONDITIONAL / CONDITIONAL`; no capability selected/approved |
| MULTI_SOURCE_AUTHORITATIVE_PROOF | `NOT_ESTABLISHED_FROM_CURRENT_VERIFIED_SOURCES` |
| UNKNOWN_EXTERNAL_ARCHIVES | `UNKNOWN_EXTERNAL_OPERATIONAL_SOURCE` |
| WRITER_CONTINUITY_STATUS | `NOT_YET_PROVEN` |
| WRITER_SEMANTIC_CHANGE_REQUIRED | `NOT_ESTABLISHED` for unselected current route |
| SEPARATE_HIGH_RISK_WRITER_TRANSITION_PREREQUISITE_REQUIRED | `CONDITIONAL` on actually required frozen writer/control-contract change |
| EXECUTABLE_RECOVERY_WITH_UNPROVEN_WRITER_CONTINUITY | `BLOCKED` |
| E3_FEASIBILITY / LIFECYCLE_EVIDENCE_SOURCE | `NOT_ESTABLISHED / REMAINS_UNAVAILABLE` |
| EXACT_TARGET_CONTROL_PROTOCOL | `NOT_IMPLEMENTED` |
| HEALTH-ID-C01-C15 | `REQUIRED / NOT EXECUTED` |
| REL05G5A-001 | `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION` |
| [Health selected-day gate](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts) | `false` |
| [Health range gate](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts) | `false` |
| [Exercise comparison preview gate](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts) | `false` |
| [Home gate](../src/components/views/features/home/homeWorkoutCompositeConfig.ts) | `false` |
| [Search gate](../src/components/views/features/search/searchWorkoutCompositeConfig.ts) | `false` |
| PUBLIC_READER_ACTIVATION / HEALTH_PARENT_PUBLIC_READER_ACTIVATION | `NOT_AUTHORIZED / NOT_AUTHORIZED` |
| ASSISTED_RECOVERY_RUNTIME_AVAILABILITY | `NOT_AVAILABLE` |
| TRACK_A | `TRACK_PARTIAL / PATH_A_QUALIFICATION_PARTIAL` |
| TRACKS_B_C_D | `NOT_EXECUTED` |
| BOOTSTRAP_ADMISSION | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |
| R2-U | `NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF` |
| SEVEN_LIVE_WRITER_BLOCKERS | `OPEN`: unbound pre-reset create; rollback visibility; old/new coexistence; mounted UI identity; canonical field ownership; analytics projection/public claims; reset-fenced local-edit policy |
| WRITER_DATA_PLANE_G6_ACTIVATION | `NONE`; no canonical writer/bind/push/pull/resync/reset activation |
| PHYSICAL_QUALIFICATION_STATE | `DEFERRED_UNCHANGED` |
| LOCAL_DATABASE_VERSION / LOCAL_SCHEMA_VERSION | `7 / 1` |
| WorkoutSessionV1 / stores / indexes / keyPaths | Unchanged |
| Supabase/RLS/backend API/remote schema | Unchanged; no registry, endpoint, logging or telemetry |
| NEW_PRODUCT_DECISION_MADE / NEW_CAPABILITY_IMPLEMENTED | `NO / NO` |
| PROVENANCE_COLLECTION / IMPLEMENTATION / ACTIVATION | `NOT_AUTHORIZED / NOT_AUTHORIZED / NOT_AUTHORIZED` |
| REAL_USER_DATA_ACCESSED | `NO` |
| Independent review / Final Merge Gate / Ready / merge / auto-merge | `NOT_PERFORMED` for this new package |

Publication scope: this one new Markdown artifact on `codex/rel05g-health-id-prospective-provenance-decision`, normal commit/push and a new Draft PR. Validate relative links and unstaged/staged/committed `git diff --check`, exact one-file docs-only delta and clean repository after commit. No local full frontend suite is required solely for this document; hosted exact-head Push/PR CI is the regression signal, reported separately. CI cannot qualify original issuance, physical support, writer continuity, E3, recovery control or HEALTH-ID acceptance.

Supabase guidance influenced the account-authentication-versus-issuance distinction and the future least-privilege/RLS/API-exposure prerequisites; it caused no backend or user-data action. Stop after Draft publication and exact-head CI observation. Do not mark Ready, merge, enable auto-merge, self-approve PD01, begin a follow-up branch, implement provenance/control or activate any path.
