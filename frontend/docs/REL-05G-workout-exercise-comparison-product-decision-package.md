# Workout exercise comparison: bounded product-owner decision package

## 1. Status, authority, and baseline

- Task: `REL_05G_WORKOUT_EXERCISE_COMPARISON_PRODUCT_DECISION_PACKAGE`.
- Status: **PRODUCT_OWNER_DECISION_REQUIRED**. This document prepares decisions; it does not approve them.
- Naming: a proposed task/package name, not a new established numbered REL workstream.
- Repository/workspace: `Absinthe-6785/Absinthe`, `C:\Users\이도현\GitRepos\Absinthe`; never `D:\Projects\Absinthe`.
- Authoritative main/base: `bbc892bfd0397767a7ea231d111a3e0cf51f2441`.
- PR #742: merged at that commit; independently reviewed characterization head: `a452c8cc5d23dd1b75d62850f7dc95c25b2e61b4`.
- Authority: [merged characterization](REL-05G-workout-exercise-comparison-truth-characterization.md), **CLOSED_IN_MAIN**. Its corrected document is unchanged by this package.
- Current complete-source ceiling: `COMPARISON_BLOCKED_BY_PRODUCT_DECISION_AND_LEGACY_ISOLATION_PREREQUISITE`, scoped to source-symmetric complete-source comparison.
- Publication scope: this one Markdown file, a dedicated branch and a Draft PR. No runtime fix, comparison implementation, product approval, activation, Ready, merge, or G6.

All EXCOMP-PD01–PD14 remain **OPEN / PRODUCT_DECISION_REQUIRED**. All characterization EXCOMP-C01–C32 remain **REQUIRED / NOT EXECUTED**. Recommendations below have no repository decision authority until the product owner explicitly approves a version and its bundles; approval still does not authorize implementation or activation.

## 2. Frozen source facts and evidence limits

The merged characterization, not the old PR body, is the source authority. These facts frame choices, not product policy:

| Source fact | Decision consequence |
| --- | --- |
| Mounted per-exercise `prev_sets`/`pr_kg` use verified legacy history only; canonical-only history does not populate them | A new canonical evidence panel must not imply that existing badge/suggestion already consumes canonical records |
| Current lookup is exact `block_id` and `date < selectedDate`; it selects one prior legacy row technically | Preserve compatibility explicitly or approve a changed Previous contract; selectedDate is not today or the Previous browser date |
| Current historical PR threshold is maximum finite kg over all matching prior local legacy rows, including unfinished sets; current badge maximum is positive completed draft kg | Preserving it is not a completed-only historical PR and not a persisted achievement/global personal record |
| Micro-cues use completed usable sets; suggestions use the prior row's full array length and create fresh empty sets | Comparison eligibility and planning count are separate decisions |
| Previous browser is a one-calendar-year date-browser with weekday initial selection | It is not the per-exercise latest lookup and not all-local-prior PR coverage |
| V1 is `{version:1,id,localDate,entries}`; no performedAt/timeZone/session memo/label/session sort | Latest calendar date is available; chronological last session on that day is not |
| Legacy row IDs, canonical session/entry/set IDs and source-qualified read IDs remain distinct | Analytical matching never grants identity, adoption, dedupe, source suppression, or session equivalence |
| Canonical exercise has frozen nullable string ID/name/type; legacy display often uses mutable current catalog metadata | ID/name matching has rename/recreation ambiguity; missing evidence cannot be invented |
| Shared source snapshot reads all local active-domain evidence; current Previous view is one year | An approved owner-derived all-prior view can reuse the snapshot, but is future reviewed work, not an existing consumer API |
| Canonical typed isolation and legacy generic validation failure are asymmetric | Current partial evidence is not source-symmetric completeness; the legacy classification gap remains unresolved |

No new source-function probe, runtime test, mounted QA, accuracy measurement, or EXCOMP acceptance execution is claimed by this document. Existing characterization evidence keeps its recorded limits. Complexity assessments below are qualitative engineering judgments, not measured performance or schedules.

## 3. Four top-level strategies

These strategies are alternatives for approval, not four simultaneous features. Public examples describe semantic disclosure, not final localized copy.

| Dimension | A — explicitly legacy-only Previous/PR | B — collapsed complete-source composite | C — separate legacy/canonical evidence | D — unavailable/hide when completeness is insufficient |
| --- | --- | --- | --- | --- |
| Exact visible behavior | Legacy cue/badge/count retained and clearly labelled legacy-only | One analytical Previous result and/or PR across the approved pair | Source/date-labelled evidence groups; no cross-source winner or global PR; existing legacy badge/count separately labelled | No comparison claim when the chosen trust/coverage requirement is unmet; show unavailable, not empty |
| Truth guarantee | Only declared verified local legacy scope; never all-source | Complete only within approved matching/horizon/eligibility and successful trusted pair | Each surviving source proves only its own declared evidence scope | Withheld claim is not absence; a displayed claim still needs an approved source/metric contract |
| Canonical-only history | Explicitly outside the feature, not 'no workout history' | Can supply comparison if verified, matching and covered | Matching canonical evidence visible; legacy component has no eligible match or is unavailable according to actual status | Hidden/unavailable if chosen full-source contract cannot be proven; canonical presence alone is not failure |
| Mixed sources | Canonical intentionally omitted from comparison | Approved aggregation/selection; no implicit canonical priority | Both remain separate even for equal dates/values; distinct observations retained | Show only if the chosen predicate is satisfied; otherwise suppress the claim |
| Error/partial | Legacy failure unavailable; typed pair failure cannot be caught as a fallback if consuming paired evidence | Partial pair cannot support global PR/no-PR or absence; hide the collapsed claim or show a separately qualified fallback | Ordinary source error may leave surviving labelled evidence and an incomplete state; typed isolation suppresses the pair | Ordinary error becomes unavailable/hide; never verified empty; typed isolation suppresses pair |
| Complexity | Low-to-medium copy/scope/currentness; not merely changing one label | Highest: matching, selection, PR/variants, trust and owner/currentness integration | Medium: evidence projection/owner view/currentness/UI; avoids a unified formula | Low-to-medium guard/copy, but coverage/trust detection may still require shared evidence |
| Legacy isolation impact | Not necessarily needed for explicit legacy-only scope | Required for source-symmetric complete-source claims, or another reviewed safe trust boundary | Not necessarily needed for an explicitly reviewed source-qualified partial contract | Not necessarily needed if generic failure yields unavailable and no completeness claim |
| Reader activation | Separate approval, review, QA and honest source/error/copy required | Separate approval plus trust prerequisite and complete-source acceptance | Separate approval plus real-path partial/isolation/currentness acceptance and QA | Separate approval of hiding predicate/error/currentness and QA |
| Staged writer | Possible limitation, not authority; canonical achievements intentionally excluded | Complete-source promise depends on trust and metric policy plus separate writer blockers | Coexistence-friendly limitation; canonical evidence does not imply writer/convergence readiness | Possible temporary limitation/feature loss, not writer approval |
| Future migration cost | Later composite behavior needs re-education and matching/formula approval | Early irreversible metric/matching semantics carry highest migration risk | Preserves provenance and can add aggregation later under a separate decision | Later restore requires a chosen metric/trust contract and feature rediscovery |
| Still unresolved | Exact disclosure, compatibility horizon/error and rollout approval | All relevant selection/metric/variant/horizon decisions, trust prerequisite and public acceptance | Matching, bounded evidence contract, compatibility exceptions, partial disclosure and rollout | Exact completeness predicate, conditions for display, fallback scope and rollout |

### RECOMMENDED_OPTION_FOR_PRODUCT_OWNER_APPROVAL

**Recommendation: Option C, source-separated strength evidence, with a preserved explicitly legacy-only compatibility lane.** This is not an approved selection.

It avoids fabricating chronology or one global PR, lets canonical-only valid evidence become visible, preserves current legacy behavior, and keeps observation identities available for later migration. Unlike A it does not make canonical history permanently invisible; unlike B it does not commit to a new formula/precedence before they are needed; unlike D it can use safe surviving evidence instead of discarding it. Its cost is more provenance/UI/currentness work and deliberate match omissions. It remains default-OFF, read-only and compatible with a future separately authorized canonical writer, without claiming that writer is ready.

The recommendation changes neither mounted code nor current behavior. The proposed new evidence projection is not a replacement input to `prev_sets`, `pr_kg`, badge computation or planning helpers.

## 4. Four coherent approval bundles, not fourteen independent questions

The owner may approve all four recommended bundles together, modify a bundle explicitly, or choose another strategy and supply its necessary semantics. No response is inferred from publication/merge of this package.

| Bundle | Owner choice needed for the next slice | Recommended answer, subject to approval | EXCOMP coverage |
| --- | --- | --- | --- |
| S — scope, trust UX and disclosure | A/B/C/D; incomplete/unavailable behavior; source/copy and rollout limitation | C; keep sources separate, show surviving evidence with incomplete state, suppress typed-isolation pair, disclose legacy-only badge/count; default-OFF only | PD04, PD12–PD14 |
| T — association, Previous and coverage | Matching key, rename/null/recreation omissions, prior-date/same-day rule, history horizon | All-local-prior active history, strict date < selectedDate and approved analytical association, then M's new-evidence eligibility BEFORE maximum eligible prior date selection independently per successful source; exact nonnull retained ID + exact name/type guard for canonical association, no fallback; retain every eligible observation on that source/date, no same-day chronology | PD01–PD03, PD04 |
| M — metrics and supported variants | PR change or deferral; completed versus stored sets; strength/bodyweight/assistance/drop/cardio; unit inconsistency | No new/global PR; retain legacy PR compatibility separately; new strength evidence is completed + usable + normal/non-dropset + external-weight + trustworthy required numeric/unit evidence. This eligibility defines T's eligible dates, not merely a display filter after date selection; factual kg/reps/assistance only, other new variants deferred, inconsistent-unit derived comparisons withheld | PD05–PD11 |
| P — planning compatibility | Whether evidence drives automated set counts/values | Existing legacy-only count/default/preset behavior unchanged; new canonical evidence never auto-plans | PD02, PD05, PD06, PD13–PD14 |

Public activation, a canonical writer, a trust fix, new metrics and Search decisions are **not** approvals requested in these bundles. If a modification leaves matching/horizon/eligibility/error behavior unspecified, the next ceiling stays `COMPARISON_REQUIRES_MORE_PRODUCT_DECISION`.

## 5. Analytical association choices (EXCOMP-PD01)

Risk statements are conditional, not measured error rates. No candidate proves catalog-era continuity or equivalence of two workout records.

| Candidate | Rename | Null/missing ID | Deleted/recreated catalog | False-positive risk | False-negative risk |
| --- | --- | --- | --- | --- | --- |
| Retained legacy `block_id == canonical exercise.id` | Retained ID survives name rename | Cannot bridge null/unlinked IDs | Retained old ID may match; genuinely new ID does not; ID reuse is unproven | Reused/reassigned/imported IDs can associate unrelated exercises | Real continuation with changed/null ID is missed |
| ID plus name check | Rejects frozen old name versus renamed mutable catalog | No ID means no match; no trustworthy name means unavailable association | New ID rejected; same ID/different name rejected; same ID/name reuse still ambiguous | Lower than ID/name alone under stated assumptions, not zero | Legitimate rename or unavailable catalog name is missed |
| Name + type | Rename-sensitive | Can associate without ID only when actual name/type exist | Same-name/type recreation may associate incorrectly | Homonyms/same family; legacy mutable/fallback type may be weak | Rename/type change/missing frozen legacy metadata |
| Normalized name | Normalization does not restore rename lineage | Allows name-only bridge, not identity | Same-name new exercise may collide | Homonyms, Unicode/case/transliteration collisions; highest weak-key risk | Rename/spelling differences even after normalization |
| No cross-source matching | No cross-source rename claim | Preserve entries unassociated | No recreation equivalence | No cross-source false-positive association | Every genuine continuation deliberately omitted |

**Recommendation, approval required:** for a selected current catalog exercise, retain current legacy exact `block_id` lookup; associate a canonical entry only if its nonnull ID exactly equals that selected block ID and its frozen name and type exactly equal available current catalog name/type. No trimming/case folding/name fallback/UUID-case normalization is approved. This is the narrow ID-plus-name candidate with an additional family guard, not a record join. A missing catalog, null ID, rename disagreement, or type disagreement means *not associated under this policy*, not 'never performed'. Unassociated canonical records remain available in their existing source history; this slice does not invent a name-based recovery UI.

If cross-source numerical aggregation is requested later, this same conservative candidate is the recommendation to evaluate first, with explicitly accepted false negatives; it still needs independent trust/matching review. A safe alternative now is no cross-source association and source-history browsing only, but it would be a different approved T bundle.

## 6. Previous, same-day behavior and history horizon (PD02–PD04)

| Previous meaning | Available truth | Required tradeoff |
| --- | --- | --- |
| Latest prior date containing any matching persisted record (date-first alternative, not recommended C) | Maximum matching `localDate < selectedDate` can be computed before set eligibility | Can yield no eligible evidence on that date; owner would need explicit fallback/no-match behavior; cannot choose chronological last session |
| Latest prior persisted observation | Persistence IDs/revisions are not performance timestamps | May use a disclosed technical representative only after a separate policy; must not call it latest performed |
| Source-separated latest dates/observations | Each successful source has its own maximum eligible prior date | Different dates can appear together; no source wins; multiple observations on a date remain separate |
| One-year bounded history | Existing Previous logical view supplies that window | Cannot claim all-prior absence/PR or silently replace unlimited legacy threshold |
| All locally available prior history | Shared full active-domain snapshot can support an approved pure owner-derived view | Local-only scope, not all-time/cross-device truth; full-history CPU/memory QA required |
| Same-day inclusion | Date-only V1 cannot tell which session preceded the current workout | Exclude selected date now, or separately approve date-group evidence without 'previous chronological session' |

**Recommended exact contract — PRODUCT OWNER APPROVAL REQUIRED:** for the NEW Option C evidence projection, evaluate each successful source independently, only while its verified evidence is current and valid for publication:

1. Start with records inside the declared all-locally-available-prior active-history horizon; this is not remote/all-time completeness.
2. Apply the strict prior boundary: `localDate/date < selectedDate` using Health's selected date, not today or the Previous browser date.
3. Apply the approved analytical exercise association policy from section 5. It grants no identity, adoption or dedupe authority.
4. BEFORE selecting a Previous date, apply the approved new-evidence eligibility from M/sections 7–8: supported strength evidence, completed, usable, normal/non-dropset, external-weight, with required numeric evidence trustworthy under the unit policy. Eligibility is observation/claim-specific; withhold an untrustworthy numeric claim without discarding other eligible factual evidence merely because an unrelated field is not comparable.
5. Remove records/dates with no surviving eligible observation from this projection's date candidates; do not delete or rewrite persisted records.
6. Select the maximum prior calendar date among the remaining eligible evidence for that successful source. This is the **latest eligible Previous evidence date**, not the latest date containing any associated persisted record.
7. On that source/date, retain every eligible matching observation and its existing row/session/entry/set identity as applicable; no equal-date collapse, chronological winner or fabricated identity.
8. Keep each source's selected date separate. Do not derive a cross-source global latest date or infer that groups displayed together belong to the same workout/session.

In short: **prior boundary + analytical association + supported evidence/unit eligibility BEFORE latest eligible Previous-date selection**. Dates label evidence; ID/order is presentation only, not performed chronology, source precedence, averaging, merging or a tie winner. A source that failed is not evaluated as an empty successful source; the section 9 partial/error/currentness rules remain authoritative.

**Recommended example — PRODUCT OWNER APPROVAL REQUIRED, not runtime acceptance:** selectedDate is `2026-10-02`. A matching entry on `2026-10-01` has only unfinished sets or only dropsets; a matching entry on `2026-09-30` has completed usable normal external-weight evidence under the unit policy. The first date contributes no eligible evidence, so `2026-09-30` is that source's latest eligible Previous date for the NEW projection. Selecting `2026-10-01` first and then displaying zero eligible evidence is not the recommended contract.

**Separate legacy compatibility lane:** do NOT apply this new eligibility-before-date rule to the existing mounted exact `block_id` lookup, technically selected latest prior legacy row, full `prev_sets`, historical `pr_kg`, completed micro-cues, or count/preset/default planning. The recommendation preserves those existing semantics. The new evidence group and legacy compatibility cue may legitimately show different prior dates, including within the legacy source. Label their distinct source/meaning/date; do not force agreement or call either the authoritative overall Previous workout.

| Horizon choice | Migration and user-expectation consequence |
| --- | --- |
| Preserve all-local-prior | Keeps legacy threshold/lookup coverage expectations; new view must declare all currently verified local active history, not all human/cloud history |
| Intentionally one year | Smaller visible promise, but older valid Previous/threshold evidence can disappear; requires copy and an approved intentional behavior change |
| Configurable bounded horizon | Adds setting/default/persistence/currentness and transition semantics; no silent 'all-time' label |
| Legacy threshold all-local, canonical evidence separately bounded | Preserves badge but creates two scopes that must be continuously disclosed; no single full-source PR |

**Recommendation, approval required:** preserve all-local-prior for the legacy compatibility lane and use the same declared all-local-prior date filter for the new source evidence, restricted to successful verified sources and the approved analytical key. 'No eligible match in verified local history under this key' is permissible only for that successful source; omitted rename/null-ID entries and failed sources prevent broader absence claims. Nothing promises remote completeness or historical tombstones. Reuse the shared snapshot via a separately reviewed owner-derived view; do not pass its private snapshot/DB handle to UI or rescan canonical per exercise. Existing one-year Previous browser stays unchanged. The view/owner API and performance acceptance are future implementation requirements, not work included here.

## 7. PR, comparison eligibility and planning are separate (PD05–PD06)

Current legacy PR remains the exact characterized historical kg-threshold/draft badge, including unfinished historical kg and the known assistance/drop/bodyweight-predicate asymmetries. Preserving it is a compatibility choice, not endorsement of a complete-source achievement definition.

| Candidate PR policy | Can honestly use both sources? | Decisions/cost before claiming it |
| --- | --- | --- |
| Preserve current legacy PR only | No; expressly legacy-scoped | Label source/local-prior horizon/draft nature and existing eligibility asymmetry; no new formula |
| Completed external-weight max kg | Conditionally yes, within trusted successful pair and approved matching/range | Explicit done, assistance, drop, missing/zero, draft-versus-saved and complete-source trust policy; changes current historical threshold |
| Source-separated strength evidence without global PR | Yes as distinct provenance-labelled observations, including source-qualified partial | No combined record/badge; preserve original identities and approved units/eligibility |
| Rep-constrained PR | Conditionally; relation is a new policy | Define target reps, null/assisted handling, ties, eligible variants and trust/coverage |
| Estimated 1RM | Data may allow an estimate, not an approved PR | New formula, validity/domain limits and product rationale; not recommended for this slice |
| No new composite PR yet | Yes for comparison evidence, not a new PR claim | Explicitly withhold canonical/global badges; existing legacy badge remains separate |

**Recommendation, approval required:** choose source-separated evidence plus no new composite PR. Keep existing legacy PR computation unchanged in the labelled compatibility lane; do not feed new projection values into it. A canonical-only observation can show factual prior kg/reps but cannot establish a global PR or disprove/confirm the legacy badge. No draft badge is relabelled as a saved canonical achievement.

| Set eligibility | PR effect | Previous cue/evidence effect | Planning count effect |
| --- | --- | --- | --- |
| All stored sets | Planned/not-done data may affect threshold; this is current legacy historical compatibility | Can display planned sets as planned, not performed | Matches current legacy array-length planning, including unfinished sets |
| Completed sets only | Changes current historical legacy threshold if adopted for PR | Good performed-evidence boundary where values usable | Would change current suggested counts; not automatic |
| Completed comparison, all-set planning | Keeps performed comparison separate from planning | Need explicit distinction between two consumers | May preserve count compatibility but not derive a canonical count without a selection policy |
| Source-specific compatibility | Legacy badge/cues/count retain their existing different eligibility; new evidence has its own declared policy | Honest only with clear lane labels, not one unified metric | Lowest compatibility disruption; no new canonical planning behavior |

**Recommendation, approval required:** source-specific compatibility. New evidence accepts `done=true`, usable normal/non-dropset external-weight strength observations with required numeric evidence trustworthy under the unit policy; displays stored normalized kg and reps without a ranking formula. Apply this eligibility BEFORE date selection as section 6 defines: it determines which dates contain new evidence, not only which values to hide after choosing a matching date. A missing/null field remains unknown, not zero; an explicit numeric zero may be displayed as a fact but never creates a PR. New evidence excludes dropsets and does not rank assisted versus unassisted work. Existing legacy badge threshold, completed cues, technically selected prior row and all-set count are not silently made identical or changed to eligibility-first selection.

### Previous-set suggestion options

| Choice | Consequence |
| --- | --- |
| Preserve legacy-only count | Existing direct-add/routine/preset defaults and clamping stay intact; fresh empty sets, not historic values |
| Source-separated canonical evidence as a manual planning reference | Explicit user selection; no implied best training input; a future UI/control contract is needed |
| Unified previous count | Must decide observation/ties/source precedence/planned-versus-done and defaults; a closest date alone is insufficient |
| Disable canonical-aware suggestion | Canonical comparison cannot influence automation; can coexist with legacy-only count |
| Show comparison, do not auto-plan from it | Safest new evidence boundary; data display does not prescribe training |

**Recommendation, approval required:** preserve legacy-only automatic count and preset/direct-add defaults; show new canonical evidence without count/load/reps copying or auto-planning. No new manual 'use these sets' action is in this bounded scope. Do not select one same-day canonical entry merely to obtain a count.

## 8. Variant and units menu (PD07–PD11)

These are product options, not implemented features. 'Deferred' below applies to *new comparison semantics*, not removal of existing history displays or legacy compatibility.

| Dimension | Choices to make explicit | Recommended bounded subset, approval required |
| --- | --- | --- |
| Strength | External-weight facts; reps; assistance-aware ranking; dropset aggregation | Completed usable normal external-weight kg/reps evidence, no new ranking/PR; preserve legacy lane separately |
| Bodyweight | No bodyweight PR/evidence-only; max total reps; max unassisted reps; separate assisted/unassisted evidence | Defer new bodyweight comparison/PR; existing source history and legacy cues unchanged. No body mass or kg synthesized; evidence-only bodyweight can be a later slice |
| Assistance | Display total; unassisted; both; ranking or no ranking | New strength evidence displays total and valid assisted/unassisted breakdown, with no assistance ranking or discount. Derive unassisted only when valid subset is proved; missing assistance is not invented |
| Dropsets | Include with normal; exclude PR; separate groups; comparison-only/no PR | Exclude from new comparable strength evidence and identify scope exclusion; keep historical records and existing legacy behavior. Separate drop evidence/ranking deferred |
| Cardio | Defer PR; raw duration/distance evidence; comparable-mode distance/duration PR; pace | Defer new cardio comparison and all cardio PR. Existing history display unchanged. Later raw-evidence display needs valid parse/units, while optimization direction needs separate rationale |
| Units | Valid normalized internal units; original source/display unit; inconsistent legacy handling; rounding | Validated canonical kg/seconds/meters are numeric evidence only where the selected feature uses them; preserve original display/source unit. Withhold derived numeric comparison for inconsistent/unknown legacy metadata; never compare rounded labels or rewrite records |

Cardio time/distance availability does not make longer/shorter/better universal; mode, equal distance/time and target event must precede metric ranking. Bodyweight V1 has no external-weight field. Assistance display and PR semantics are distinct; zero unassisted from a valid all-assisted set is evidence, not an inferred performance rank. Normal/drop differences cannot be decided from a historical implementation accident.

**Precise units recommendation, approval required:** use V1 validated `weightKg` and valid saved source metadata for display, not display rounding as numeric input. Legacy kg-only records are kg under the current contract; if paired source metadata is present, verify consistency using existing conversion/rounding conventions before a new numeric comparison. Do not silently prefer source value or stored kg on disagreement. Withhold affected derived comparison and retain provenance/status without relabelling the whole source as verified empty. Missing/null is unknown and numeric zero is distinct. No normalization backfill is authorized. Existing legacy badge arithmetic is preserved and explicitly not promoted into the new normalized comparison contract; consistent data in other eligible observations may still be displayed.

For the new projection, this required numeric/unit trust check participates in eligibility BEFORE latest-date selection. Withhold the affected claim, not an entire historical record just because an unrelated field is incomparable: other completed normal external-weight evidence may still be factually presented if it satisfies the approved claim's required-value policy. A date qualifies when at least one eligible observation remains; a date with none cannot mask an older eligible date. No unit rule here changes the existing legacy compatibility lane.

## 9. Partial/error UX versus technical trust (PD12–PD13)

| Current verified read outcome | Permitted recommended C presentation, if approved | Forbidden inference |
| --- | --- | --- |
| Both sources succeed | Separate source/date evidence under the approved key/horizon; still no global PR | Technical presentation order as source priority/session chronology |
| Legacy generic validation/availability error, canonical success | Canonical evidence + explicit legacy-unavailable/incomplete state; no stale legacy comparison lane value for this publication | Verified legacy absence, global PR/no-PR, or source-symmetric paired-isolation success |
| Canonical trusted-content/ordinary I/O error, legacy success | Legacy evidence + explicit canonical-unavailable/incomplete state | Canonical absence/global completeness |
| Typed isolation from either source, including canonical persisted scope distrust | Suppress pair, comparison unavailable; no cached surviving lane | Catch typed isolation into partial fallback |
| Both ordinary failures | Unavailable/error, retry if appropriate; no evidence | Empty history/zero/no-PR |
| Pending, disabled, superseded, account/date/device/generation/owner lifetime changed | No current settled comparison; loading/disabled/unavailable as appropriate; suppress old publication/click use | Reusing old-owner or old-date evidence as current |
| Successful source, no eligible associated normal strength evidence | Source/key/horizon/eligibility-qualified no-match only | Never-performed or absence across renamed/null-ID/excluded variants/other failed source |

These are recommendations for a future reviewed contract, not claims the mounted block cache already satisfies it. Account/date ABA, request/currentness, device/generation, owner/gate lifetime, save/delete invalidation and focus/bootstrap/visibility must use the shared verified owner boundary. A default-OFF projection cannot inherit those fences merely by using a similar DTO. Public implementation must explicitly route comparison publication/invalidation; leaving a stale legacy badge cached while publishing a newer incomplete pair is not the recommended C contract. Changing that lifecycle requires separate reviewed implementation, not a test-only mock or this document.

Required semantic disclosures by option:

- A: every relevant positive, badge, suggestion and no-result context identifies legacy-only local history; no all-source PR/absence implication.
- B: approved matching/horizon/eligibility plus complete/incomplete/unavailable status; no complete badge when trust/coverage fails. A partial fallback must have a separate source-scoped name.
- C: source and prior date on each evidence group; current legacy badge/count explicitly legacy-only; incomplete/unavailable source disclosed even when surviving evidence has no match. No combined/global PR.
- D: unavailable/withheld, not 'no previous workout'; explain the limited feature without claiming all-source absence. Hiding is not a taxonomy repair.

Examples such as 'Legacy workout history only' and 'Some workout history is unavailable' express requirements, not finalized English/Korean copy or a selected localization change. Labels must be accessible, visible at the claim (including empty/error branches), not only hidden in a help screen. Product approval cannot make a generic ownership-classification error trustworthy complete-source evidence.

## 10. TECHNICAL_PREREQUISITE_NOT_A_PRODUCT_DECISION

`LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP` remains unresolved:

```text
real legacy validator detects source_owner_mismatch
  -> repository assertDatasetsValid collapses details to generic malformed error
  -> readAuthoritativeDatasets/readAll propagate generic rejection
  -> paired coordinator sees ordinary legacy source error
  -> healthy validated canonical evidence may survive as partial_data
  -> foreign legacy record itself is rejected, NOT published
```

Canonical persisted untrusted account/namespace/generation/envelope scope retains a typed failure and fails paired publication closed. Trusted canonical invalid content/ordinary I/O is a different ordinary source error. A later legacy adapter's typed account check does not repair classification lost in the real earlier repository read.

| Strategy | Fix prerequisite impact |
| --- | --- |
| A | Not necessarily: explicitly legacy-only claims can map legacy failure to unavailable; do not claim universal paired isolation |
| B | Yes for source-symmetric complete-source claims: separately preserve typed legacy owner classification or independently review another equivalent safe trust boundary |
| C | Not necessarily: an explicitly reviewed source-qualified partial contract must preserve current canonical typed isolation, failed-source uncertainty and no contaminated legacy publication |
| D | Not necessarily: generic failure is unavailable/hide with no completeness claim; currentness/isolation still apply |

The recommended C package leaves the gap OPEN and chooses no runtime repair. Future real repository/driver owner-mismatch acceptance (characterization C14) must prove the partial restriction, not pretend it fails paired closed today; canonical real persisted isolation acceptance is also required. The descriptive gap is not a new canonical numbered REL blocker or an automatic eighth live-writer blocker. Fixing taxonomy cannot decide PR/matching, and approving UX cannot waive a complete-source technical trust prerequisite. Dormant pure editor/identity foundation is not blocked by this gap alone.

## 11. Rollout and writer relationships (PD14)

The table describes whether the *comparison policy* is needed at each milestone. It grants no milestone approval and says nothing closes the independent live-writer blocker set.

| Milestone | A | B | C | D |
| --- | --- | --- | --- | --- |
| Dormant implementation of this comparison feature | REQUIRED: legacy scope/copy/error compatibility | REQUIRED: full analytical/metric policy plus trust prerequisite before complete-source claims | REQUIRED: evidence/matching/horizon/partial contract | REQUIRED: display/withholding predicate and limited fallback semantics |
| Public reader activation of comparison | REQUIRED: truthful legacy limitation + review/QA | REQUIRED: trust, complete-source acceptance + review/QA | REQUIRED: real-path partial/isolation/currentness + review/QA | REQUIRED: unavailable/hide/error predicate + review/QA |
| Staged canonical writer | OPTIONAL_WITH_LIMITATION: explicit legacy-only comparison | REQUIRED if stage promises complete-source comparison; otherwise a separately approved limitation is another strategy, not B complete-source | OPTIONAL_WITH_LIMITATION: separated evidence, no global PR/automatic planning | OPTIONAL_WITH_LIMITATION: withheld comparison |
| General writer rollout | OPTIONAL_WITH_LIMITATION only with explicit product acceptance of canonical omission | REQUIRED if promising complete-source Previous/PR, plus trust and all independent writer blockers | OPTIONAL_WITH_LIMITATION only with explicit acceptance of source-separated non-global semantics | OPTIONAL_WITH_LIMITATION only with explicit acceptance of feature loss |
| Unrelated dormant pure editor/identity/CAS foundation | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED | NOT_REQUIRED |

For general rollout, 'OPTIONAL_WITH_LIMITATION' does not mean scope policy can be left undecided: the limitation must be explicitly accepted as the product promise instead of complete-source comparison. It means a composite formula is not mandatory. No strategy waives account/reset/recovery/identity readiness or physical QA. Public reader activation does not inherit writer authority and staged writer tests do not authorize public readers.

Search PD01–PD10 remain outside this package: no ranking, matching-fields, history horizon, recents, navigation or provenance decision is reopened or resolved by EXCOMP approval. Existing approved default-OFF Health/Previous/Calendar/Home/Search work is not reimplemented.

## 12. Decision dependency graph

```text
Product-owner strategy and bundle approval (currently absent)
  -> declared active-history horizon + strict prior selectedDate boundary + analytical association
  -> approved new metric/set/variant/unit evidence eligibility
  -> per successful source: maximum eligible prior date + all eligible observations on that date
  -> trust branch:
       B complete-source -> separate legacy typed-isolation/safe-boundary work + review
       A/C/D qualified   -> explicit reviewed source/error/partial limitation contract
  -> separate authorization of a bounded DEFAULT-OFF implementation
  -> independent implementation review + real-path acceptance/currentness/read-budget checks
  -> physical device / large-history / public-copy QA and readiness
  -> separate public reader activation decision

Independent writer lane (NOT discharged by the above):
seven live-writer blockers + REL05G5A-001 + reset/recovery/identity readiness
  -> separately authorized staged writer / general rollout / G6 decisions
```

Product approval alone is not an implementation instruction. Writer cutover and public reader activation remain distinct authorizations. No new performance/schema/store/index work is implicitly approved by the graph.

## 13. PRODUCT_OWNER_MUST_DECIDE_NOW

Only these four bundles are needed to determine a next default-OFF ceiling; the owner can approve the recommended package as a whole rather than answer fourteen independent questions:

1. **S:** choose A/B/C/D and accept its exact source/partial/unavailable/copy/default-OFF limitation (recommended C, no global PR).
2. **T:** approve the exact matching guard and omission policy, strict selected-date exclusion and all-local-prior active coverage, then **eligibility-before-latest-date selection for the NEW source-separated evidence projection**: maximum eligible prior date independently per successful source, every eligible observation on that date, no same-day chronology/global winner/session equivalence.
3. **M:** approve no new composite PR, existing legacy compatibility exception, completed usable normal/non-dropset external-weight factual evidence with trustworthy required numeric/unit values, no new ranking, deferred variants and strict unknown handling. M's eligibility defines T's date candidates, not just a post-date display filter; existing legacy selection/PR/cue/planning stays unchanged.
4. **P:** retain legacy-only planning counts/presets/defaults; new comparison never auto-plans or copies historical values.

Any rejected/modified bundle must leave an equally explicit contract, or readiness remains product-decision-blocked. No implicit source precedence, name fallback, same-day winner, count derivation or metric is filled in by engineering.

If the owner rejects eligibility-before-date selection and prefers date-first semantics, the owner must explicitly specify what happens when the latest matching persisted date has no eligible evidence (fallback to an older date versus a date-scoped unavailable/no-match presentation). That alternative is not the current recommendation; missing fallback/no-match semantics keep `COMPARISON_REQUIRES_MORE_PRODUCT_DECISION`.

### SAFE_TO_DEFER

- Cross-source collapsed/global PR and a universal latest observation; rep-constrained PR, estimated 1RM and new achieved-versus-draft badges.
- Name normalization/fuzzy matching/rename-repair/null-ID fallback and catalog-era identity mechanisms.
- Same-day performed chronology, source precedence, combined date aggregation or deterministic single-observation selection.
- Canonical automated set counts, load/reps suggestions, manual copy-to-plan actions and training prescription.
- New bodyweight ranking, assistance ranking, dropset ranking/aggregation, cardio comparison/PR/pace direction.
- Configurable history bounds, remote completeness, performance indexes and any schema/V1 extensions.
- Legacy typed-isolation repair under recommended C only while the reviewed qualified-partial contract remains the promise; it cannot be deferred past B source-symmetric complete-source claims.
- Final localized copy wording (semantic placement/limitations must be approved now), public activation, staged/general writer permissions, physical QA and G6.

## 14. RECOMMENDED_BOUNDED_V1_COMPARISON_SCOPE

Every line is a recommendation, not a product decision or implementation authority:

- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** top-level Option C, separate source-qualified read-only strength evidence and a labelled existing legacy compatibility lane; default-OFF.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** matching: retain legacy exact block ID; canonical association requires exact nonnull retained ID plus exact available catalog name/type, no fallback or identity/adoption/dedupe inference.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** history horizon: all currently verified locally available prior active evidence per successful source, no remote/all-time promise; existing one-year browser unchanged.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** Previous: active-history horizon + strict `< selectedDate` + approved association + new set/variant/unit eligibility FIRST, then maximum eligible prior calendar date independently per successful source; every eligible observation on that date kept separate, no chronology/global winner/shared-session inference. Legacy compatibility single-row selection stays unchanged and may show a different date.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** PR: no new canonical/composite/global PR; current legacy historical kg-threshold/draft badge retained with explicit source/horizon/unfinished-history limitations.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** set eligibility: new evidence only completed usable normal/non-dropset external-weight strength observations with trustworthy required numeric/unit evidence; eligibility defines date candidates BEFORE latest-date selection, not just post-selection display. Existing legacy threshold/cue/count and prior-row selection stay source-specific, not silently unified.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** planning: keep legacy-only full-array count/preset/direct-add defaults; canonical evidence never changes counts or copies kg/reps/load.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** bodyweight: defer new comparison/PR, retain existing history/legacy cues; never apply kg PR to V1 bodyweight.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** assistance: display total and validated assisted/unassisted facts in new strength evidence, no assistance ranking/discount.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** dropsets: excluded from new comparable strength evidence with explicit scope; records/legacy behavior retained, new drop aggregation/PR deferred.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** cardio: new comparison and all cardio PR deferred; existing history unchanged, no better-direction assumption.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** units: validated normalized internal values, source/display units preserved; withhold inconsistent/unknown legacy derived comparisons, missing distinct from zero, no rounded-label arithmetic or record rewrite.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** partial/error UX: surviving ordinary-error source evidence visibly incomplete; typed isolation suppresses pair; both errors unavailable; pending/superseded cannot publish stale evidence; no failed-source absence/full-source claim.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** legacy prerequisite disposition: classification gap remains unresolved; approve and later independently prove real-path source-qualified partial semantics, not source-symmetric complete-source trust.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** public limitation: source/date/horizon/eligibility visible at evidence, legacy badge/count labelled legacy-only, incompleteness/error/no-match honestly distinguished; final localized text deferred.
- **RECOMMENDATION — PRODUCT OWNER APPROVAL REQUIRED:** writer/readiness: this contract only determines a potential dormant read-only slice; public readers need separate review/QA/activation, writers retain all separate blockers, no G6 authority.

## 15. Conditional implementation ceilings, not authorization

| Approved choice and completeness of contract | Next technical ceiling |
| --- | --- |
| A with explicit legacy scope/copy/error/horizon/compatibility and planning policy | `LEGACY_ONLY_SCOPE_IMPLEMENTATION_READY` |
| C with explicit association/horizon/eligibility-before-latest-date selection/units/partial/copy/planning contract and no global PR | `SOURCE_SEPARATED_COMPARISON_IMPLEMENTATION_READY` |
| B complete-source policy chosen while legacy trust prerequisite is unresolved | `COMPLETE_SOURCE_COMPARISON_BLOCKED_BY_LEGACY_ISOLATION_PREREQUISITE` |
| Any strategy with missing material bundle choices | `COMPARISON_REQUIRES_MORE_PRODUCT_DECISION` |
| D legacy-only limitation/withholding contract fully approved | `LEGACY_ONLY_SCOPE_IMPLEMENTATION_READY` (qualified legacy scope, not full-source readiness) |
| D with a fully approved source-separated unavailable/fallback contract | `SOURCE_SEPARATED_COMPARISON_IMPLEMENTATION_READY` (only that bounded source-status/evidence contract) |
| D relying on a source-symmetric complete-source predicate with unresolved legacy gap | `COMPLETE_SOURCE_COMPARISON_BLOCKED_BY_LEGACY_ISOLATION_PREREQUISITE` |

There is no approved product choice today. B also needs all material product choices before a trust fix alone can make it implementable. Resolving B's prerequisite requires another reviewed architecture/implementation authorization; this package creates no unconditional complete-source implementation-ready classification.

**IF_PRODUCT_OWNER_APPROVES_RECOMMENDED_PACKAGE:** `SOURCE_SEPARATED_COMPARISON_IMPLEMENTATION_READY`.

This conditional recommendation includes all S/T/M/P answers AND the section 6 ordering: horizon/prior boundary/association, then approved evidence eligibility, then latest eligible source/date and all eligible observations. Review finding `REL05G-EXCOMP-PD-001` identified the earlier ambiguity and therefore required `COMPARISON_REQUIRES_MORE_PRODUCT_DECISION`; this docs-only correction makes the recommended answer explicit, not approved. Focused independent rereview must pass before seeking product-owner approval. A different date-first answer without explicit fallback/no-match semantics remains product-decision-blocked.

This conditional ceiling describes readiness to request a separately authorized bounded default-OFF implementation plan/slice, including the owner-derived view and acceptance obligations. It is not approval to begin code or activation. **Current decision state:** `PRODUCT_OWNER_DECISION_REQUIRED`; after the correction's focused independent rereview passes, the next action is product-owner review, not implementation.

The evaluation order is replaceable projection policy only: **feature surfaces are disposable; domain contracts are durable**. It must not change WorkoutSessionV1, rewrite canonical records, persist comparison-derived identity/policy in sessions, make Previous/PR UI an authority, or couple writer persistence to this feature. A future authorized read-only/default-OFF projection must remain removable/replacable without canonical Workout data migration.

## 16. Frozen runtime and debt boundaries

No runtime/test/config/backend or merged-characterization change. DB v7, schema v1, stores/indexes/keyPaths, WorkoutSessionV1/validator and B1 cacheKey API remain unchanged. All four reader gates remain false:

- `HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED = false`
- `HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED = false`
- `HOME_WORKOUT_COMPOSITE_READER_ENABLED = false`
- `SEARCH_WORKOUT_COMPOSITE_READER_ENABLED = false`

Canonical writer, bind/push/pull/full resync/reset and G6 remain inactive. All seven live-writer blockers remain OPEN: unbound pre-reset create; rollback visibility; old/new writer coexistence; mounted UI identity integration (dormant adapter subpart already closed); canonical field ownership; remaining analytics/projection/public claims; reset-fenced local edit policy. None is closed by a recommendation or this package's publication.

`REL05G5A-001 = ACTIVATION_PREREQUISITE`; B1 cacheKey P3 = `OPEN_NON_BLOCKING`. The descriptive legacy classification gap is additional scoped technical debt, not an automatic eighth blocker. Search PD01–PD10 and all future characterization acceptance statuses remain unchanged.

## 17. Validation and publication boundary

Baseline verification: live PR #742 is merged at `bbc892bfd0397767a7ea231d111a3e0cf51f2441`; live main and fetched origin/main equal that commit. Merged characterization was re-read; no factual inconsistency was found. No architecture authority was rewritten.

This task validates docs scope, decision coverage, recommendation-versus-authority separation, frozen tree/gate preservation and `git diff --check`. It does not run new product acceptance or repair tests to obtain green CI. Hosted exact-head CI initial state is reported with the publication result; it is not assumed successful in this artifact.

Original publication was one normal docs commit on a dedicated topic branch and Draft PR #743 targeting main. This correction, `REL_05G_WORKOUT_EXERCISE_COMPARISON_PRODUCT_DECISION_PACKAGE_CORRECTION`, changes only this file for `REL05G-EXCOMP-PD-001` on the same branch/PR. It clarifies recommendation ordering and the separate legacy lane; no product/runtime acceptance is claimed. Stop after correction publication and initial corrected-head CI observation. Next action: **focused independent rereview of REL05G-EXCOMP-PD-001 only**. Product-owner review/explicit approval follows only if that rereview passes; no Ready/merge, implementation, legacy-isolation repair or activation is authorized here.
