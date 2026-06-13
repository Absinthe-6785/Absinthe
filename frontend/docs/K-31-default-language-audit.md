# K-31 — Default Language Strategy Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P0 — pass 3  
**Date:** 2026-06-12

---

## Findings (Before Pass 3)

| Issue | Root cause |
| ----- | ---------- |
| Mixed ko/en surfaces | Hardcoded Korean in Archive + English in Database/Properties |
| English-first feel | `DEFAULT_SETTINGS.language: 'en'` + `?? 'en'` fallbacks |
| Analytics label mismatch | Fixed pass 1 (`analytics` → 아카이브) |
| Planner / Day View | Pass 1 i18n keys exist; render via `useTranslation` |

---

## Default Language Behavior (After Pass 3)

| Layer | Behavior |
| ----- | -------- |
| `useAppStore` default | `language: 'ko'` |
| `resolveAppLanguage()` | Validates `en`/`ko`/`ja`; else `DEFAULT_APP_LANGUAGE` (`ko`) |
| `useTranslation()` | Uses `resolveAppLanguage` (no silent `en` fallback) |
| `getTranslator()` in Archive/Sidebar | Uses `resolveAppLanguage(appSettings.language)` |
| Workspace database subtitles | `presentationLabel(p, context.language)` from store |

**Existing users:** Persisted `language: 'en'` in localStorage is preserved via zustand migrate merge.

---

## Fallback Audit

| Path | Fallback | Status |
| ---- | -------- | ------ |
| `getTranslator` missing key | English string from dictionary | OK |
| Unknown `language` value | `ko` | Fixed |
| Archive home frame copy | Korean projection strings | OK (product copy) |
| Database views | `useTranslation` / `getDatabaseEmptyMessage` | Fixed pass 3 |
| Properties panel | `prop*` keys | Fixed pass 3 |
| Tags panel | `tag*` keys | Fixed pass 3 |

---

## Remaining Mixed-Language Surfaces

| Area | Notes | Priority |
| ---- | ----- | -------- |
| Archive section headers | Korean hardcoded (intentional product copy) | — |
| Property key placeholders | Technical keys (`status`, `reviewDate`) kept Latin | OK |
| Graph counter bar | “notes · links” when `language=en` | P2 |
| Luxon month labels in Archive projection | Locale not wired to `appSettings.language` | P2 |
| Health / Recipe tabs | Mostly i18n’d | P3 |

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Document actual default behavior | Met |
| Audit visible fallbacks | Met |
| Remove obvious Database/Properties English | Met |
| Align store default with primary market | Met (`ko`) |
