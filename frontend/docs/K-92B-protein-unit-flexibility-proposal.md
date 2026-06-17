# K-92B — Protein Unit Flexibility Proposal

Branch: `k92b-protein-units-and-cosmos-performance`  
Status: Audit / design only — **no production changes**

---

## Executive Summary

The requested **Per Item / Per 100g** model **already exists** in schema and UI under legacy names:

| User-facing goal | Current implementation |
| ---------------- | -------------------- |
| Per Item (e.g. 25g per scoop × 2 scoops) | `source_type: 'fixed'` + `protein_per_serving` × `amount_g` (serving count) |
| Per 100g (e.g. 31g/100g × 150g) | `source_type: 'per100g'` + `protein_per_100g` × `amount_g / 100` |

**Gap:** UX labels say “Fixed (per serving)” with generic `unit`/`serving` copy — no explicit **item size label** (e.g. “1 scoop”, “1 egg”). Calculation paths are correct; discoverability and labeling are the main friction.

**Recommendation:** Minimal migration — add optional `item_label`, rename UI to **Per Item / Per 100g**, keep `fixed` as legacy `source_type` value.

---

## Current Model Audit

### Database / API (`protein_sources`)

Inferred from `backend/main.py` payloads and frontend types (no SQL migration in repo):

| Column | Type | Usage |
| ------ | ---- | ----- |
| `id` | uuid | PK |
| `user_id` | uuid | owner |
| `name` | text | display name |
| `source_type` | text | `'fixed'` \| `'per100g'` |
| `category` | text | food category |
| `protein_per_serving` | float \| null | grams protein **per item** when `fixed` |
| `protein_per_100g` | float \| null | grams protein per 100g when `per100g` |
| `created_at` | timestamp | sort order |

**Intake log** (`protein_intake_logs`):

| Column | Meaning |
| ------ | ------- |
| `amount_g` | For `fixed`: **item count** (e.g. 2 scoops). For `per100g`: **grams eaten** |
| `protein_g` | Precomputed total stored at log time |
| `source_id` | FK → `protein_sources` |

API routes: `GET/POST/PUT/DELETE /api/protein_sources`, `POST /api/protein_intake` (`backend/main.py`).

### Frontend types

```typescript
// frontend/src/types/index.ts
source_type: 'fixed' | 'per100g';
protein_per_serving: number | null;
protein_per_100g: number | null;
```

### UI (`ProteinTracker.tsx`)

- Create/edit source toggles `fixed` vs `per100g`
- Log intake:
  - **fixed:** integer servings → `protein = protein_per_serving × amount`
  - **per100g:** grams → `protein = protein_per_100g × amount / 100`
- Quick add: 1 serving or 100g default

### Calculation (already matches spec)

```typescript
// fixed — 2 scoops @ 25g/scoop → 50g
protein = protein_per_serving * amount_g;

// per100g — 150g @ 31g/100g → 46.5g
protein = protein_per_100g * amount_g / 100;
```

Selectors in `proteinMetrics.ts` sum stored `protein_g` only — no runtime conversion drift.

---

## Gaps vs User Story

| Requirement | Status | Gap |
| ----------- | ------ | --- |
| Per Item basis | ✅ `fixed` | Label says “Fixed (per serving)” not “Per Item” |
| Per 100g basis | ✅ `per100g` | OK |
| Item size label (“1 scoop”) | ❌ | No column; UI shows generic `unit` / `serving` |
| Legacy records | ✅ | `fixed` rows continue to work unchanged |
| Vault export/import | ⚠️ | CSV export includes sources; new field needs export path |

---

## Proposed Schema Change (minimal)

```sql
ALTER TABLE protein_sources
  ADD COLUMN IF NOT EXISTS item_label text NULL;
-- Examples: 'scoop', 'egg', 'slice', '1 bar'
```

**No change** to `source_type` enum values (avoid breaking API clients). Optional future alias `per_item` as synonym in API validation only.

### API (`ProteinSourceCreate`)

```python
class ProteinSourceCreate(BaseModel):
    name: str
    source_type: str          # 'fixed' | 'per100g'  (UI: Per Item | Per 100g)
    category: str = '기타'
    protein_per_serving: float | None = None
    protein_per_100g: float | None = None
    item_label: str | None = None   # NEW — optional display only
```

Backend passes through via `model_dump()` — no calculation change.

### Frontend type

```typescript
export interface ProteinSource {
  // ...
  item_label?: string | null;
}
```

---

## UI Flow (proposed)

### Create source

```text
Name: Protein Powder
Unit type: ( ) Per Item   ( ) Per 100g

[Per Item selected]
Protein per item: 25 g
Item label (optional): scoop

[Per 100g selected]
Protein per 100g: 31 g
```

### Log intake

| Type | Input | Display |
| ---- | ----- | ------- |
| Per Item | count (2) | `2 scoops → 50g protein` |
| Per 100g | grams (150) | `150g → 46.5g protein` |

i18n keys: replace `proteinFixed` with `proteinPerItem`; keep `proteinPer100g`.

---

## Migration Plan

1. **Phase 0 (no DB):** UI rename only — map `fixed` → “Per Item” in copy; document that `amount_g` = item count.
2. **Phase 1:** Add nullable `item_label` column; show in source list and log form.
3. **Phase 2:** Vault CSV/export v3 column + import mapping.
4. **Backfill:** none required; null `item_label` falls back to generic “serving”.

**Risk:** Low — additive column, unchanged math, legacy `fixed` untouched.

---

## File Touch List (implementation branch)

| Layer | Files |
| ----- | ----- |
| API | `backend/main.py` (`ProteinSourceCreate`) |
| Types | `frontend/src/types/index.ts` |
| UI | `frontend/src/components/views/features/health/nutrition/ProteinTracker.tsx` |
| i18n | `frontend/src/lib/i18n.ts` |
| Export | `frontend/src/lib/vaultCloudCsv.ts`, `vaultCloudExport.ts` |
| Tests | `proteinMetrics.test.ts`, new API contract test if added |

---

## Recommended Branch

**K-92B3 Protein Unit UX + Item Label** — after Cosmos perf work; scope is small (mostly UI + one nullable column).

---

## References

- `backend/main.py` — protein API models
- `frontend/src/components/views/features/health/nutrition/ProteinTracker.tsx`
- `frontend/docs/K-52-deliverables.md` — nutrition module layout
