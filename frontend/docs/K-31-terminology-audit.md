# K-31 — Product Terminology Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P1 — pass 3

---

## Canonical Terms (Korean Primary)

| English | Korean (UI) | Where used | Consistency |
| ------- | ----------- | ---------- | ----------- |
| Archive | 아카이브 | Sidebar, tab | ✅ Fixed pass 1 |
| Note | 노트 | Sidebar | ✅ |
| Planner | 플래너 | Sidebar | ✅ |
| Workspace | 작업공간 | Search, dashboard | ✅ |
| Dashboard | 대시보드 | Workspace home | ✅ |
| Collection | 컬렉션 | Smart/rule collections | ✅ |
| Project | 프로젝트 | Search filter | ✅ |
| Milestone | 마일스톤 | Planner, Archive “최근 전환” | ⚠️ Archive header Korean, i18n key `milestone` elsewhere |
| Review | — | Not exposed as top-level tab | ✅ |
| Study | 공부 (`catStudy`) | Categories | ✅ |
| Knowledge | — | Internal module name only | ✅ |
| Trace | trace (Latin) | Archive mark calendar hint | ⚠️ Mixed — product term kept Latin |

---

## Duplicate / Confusing Concepts

| Issue | Detail | Recommendation |
| ----- | ------ | -------------- |
| Analytics vs Archive | Analytics tab removed from UI | Resolved |
| “Period / Area / Timeline” Archive modes | Placeholder shells | Label via `archiveView*` keys |
| Database “View” vs presentation types | Now `보기` + localized type names | Fixed pass 3 |
| Properties vs Tags | Separate panels, both “page” scoped | OK — `prop*` vs `tag*` keys clarify |
| Milestone (planner) vs “최근 전환” (archive) | Same data, different framing | Keep — archive emphasizes transitions |

---

## Pass 3 Terminology Fixes

- Database presentation labels: Table → 표, Board → 보드, etc.
- Properties: “Add property” → 속성 추가
- View switcher label: View → 보기

---

## Remaining Terminology Gaps

| Gap | Priority |
| --- | -------- |
| Archive “trace” in user-facing hint (Latin) | P2 — localize or glossary |
| “최근 전환” not in i18n dictionary | P2 — extract key for EN/JA users |
| Smart collection descriptions (English templates) | P3 |

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Duplicate concepts identified | Met |
| Database/properties English terms fixed | Met |
| Audit doc | Met |
