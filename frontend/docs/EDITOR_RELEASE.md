# Editor Release Log

Integration branch: **`cursor/editor-next-aafa`**  
Stable app branch: **`main`**

Sprint work lands on `cursor/editor-next-aafa` first. Point **Vercel Production** at this branch until a release is promoted to `main`.

---

## Production verification (2026-06-07)

| Environment | Commit | Branch line | F-3B Plus fix |
|-------------|--------|-------------|---------------|
| **Production** | `8292b06` | `main` (F-3A) | **No** — inline `BlockEditor` table uses `<Plus>` without import |
| **Preview (latest)** | `83c2e7d` | `cursor/sprint-f50-resilience-aafa` | **Yes** — `TableBlock.tsx` imports `Plus` |

**Root cause of Plus crash for end users:** Production tracks `main`, not F-3B+.

### How to re-check

```bash
# GitHub deployments (Vercel)
gh api 'repos/Absinthe-6785/Absinthe/deployments?environment=Production&per_page=1' \
  --jq '.[0] | {sha: .sha[0:8], at: .created_at}'

# F-3B fix present?
git merge-base --is-ancestor 071720b <production-sha> && echo "OK" || echo "Plus bug"
```

Vercel dashboard: **Settings → Git → Production Branch**

---

## Editor Release — F-3B + F-4 + F-5.0 (editor-next)

**Branch:** `cursor/editor-next-aafa`  
**Tip:** see git log on that branch

### Included

| Sprint | Summary |
|--------|---------|
| **F-3B** | Block extraction (`TableBlock`, `CodeBlock`, …), `blockRegistry`, Plus import fix |
| **F-4** | Multi-select, group drag/duplicate/delete, toggle polish |
| **F-5.0** | `SafeBlockRenderer`, `sanitizeBlockType`, `loadValidatedBlocks`, editor CI (typecheck + test + build) |

### Not included

| Item | Status |
|------|--------|
| F-5.1 | Planned (see `frontend/docs/F-5.1-design.md`) |
| F-5C Paste normalization | Deferred |
| F-5D AI Paste parser | Deferred (P2) |
| F-5F Diagnostics | Deferred |
| Restore-as-paragraph UI | Deferred |

### Deploy checklist

1. Merge or fast-forward `cursor/editor-next-aafa` to include latest sprint tip
2. `cd frontend && npm run typecheck && npm test && npm run build`
3. Vercel **Production Branch** → `cursor/editor-next-aafa`
4. Confirm Production SHA contains `071720b` (F-3B) or later
5. Manual: paste Gemini-style chronology table → edit mode → no blank page

### CI gate (required before merge to editor-next)

```bash
npm run typecheck   # tsconfig.editor.json
npm test            # includes blockRenderSmoke + geminiChronologyPaste
npm run build
```

---

## Promotion to main

When editor-next is stable:

1. Open PR: `cursor/editor-next-aafa` → `main`
2. Update this file with promotion date + commit SHA
3. Optionally move Vercel Production back to `main` after merge

---

## Template (copy for next release)

```markdown
## Editor Release — <name>

**Branch:** cursor/editor-next-aafa @ `<sha>`

### Included
- ✓ …

### Not included
- ✗ …
```
