# K-65 i18n Audit

## Fixed in K-65

| Location | Before | Key |
|----------|--------|-----|
| `NoteView.tsx` trash delete | English hardcoded | `nvDeleteNotePermanentMsg`, `nvDeletePermanently` |
| `NoteGraphView.tsx` folder legend | `폴더 N` | `graphFolderFallback` |
| `SettingsView.tsx` CSV export toasts | English hardcoded | `settingsExportComplete`, `settingsExportFailed` |
| `HealthView.tsx` tooltips | English hardcoded | `healthTapDeleteSet`, `healthCopyWorkoutSummary` |
| `PlannerView.tsx` task delete toast | `'Task deleted'` | `taskDeleted` |
| Navigation UI | Missing keys | `nvBackToPreviousNote`, `nvForwardNote` |
| Sidebar search empty | Generic no-notes | `nvSearchNoResults` |
| Health swipe | — | `healthSwipeSectionHint` |

## Remaining debt (documented, not blocking)

### Notes

- Some `NoteGraphView.tsx` file-level comments in Korean (dev comments only)
- `buildWorkspaceSearch` result subtitles may mix note kinds without localized separators in edge cases

### Schedule

- Category enum values in `SettingsView` (`Study`, `Work`) are keys mapped via `t('catStudy')` etc. — OK
- `PlannerView` internal comments in Korean

### Health

- Mobile tab labels use existing `t()` keys for blocks/routine/workout/protein
- Inbody field units (`kg`, `%`) are universal symbols

### Cosmos

- `DiscoveryPanel` / HUD copy largely i18n-complete from K-49–K-64
- Graph mode internal variable names (`universe` vs label `graphModeCosmos`) — code only

### Settings

- Color names (`gold`, `blue`) are internal keys; UI uses swatches

## Terminology consistency

| Concept | EN | KO | Notes |
|---------|----|----|-------|
| Notes tab | Notes | 노트 | Consistent |
| Cosmos | Cosmos | 코스모스 | `nvGraphMode`, `graphModeCosmos` |
| Schedule | Schedule / Planner | 일정 | `scheduleMobileTabTimeline` |
| Health sections | Dashboard, Nutrition, etc. | `healthNav*` keys | Aligned |
| Search | Search | 검색 | Sidebar + workspace share ranking docs |

## Recommendation (K-66)

- Sweep remaining English-only `showToast` / `successMsg` strings app-wide
- Extract any user-visible Korean comments in JSX to i18n
- Add `ja` spot-check for new K-65 keys in native review
