# Editor Release Log

## Branch workflow

```text
feature/*  →  cursor/editor-next-aafa  →  main  →  Vercel Production
```

| Branch | Role |
|--------|------|
| **`feature/*` / `cursor/sprint-*-aafa`** | Individual sprint work |
| **`cursor/editor-next-aafa`** | Editor integration & validation |
| **`main`** | Stable release; **Vercel Production** tracks this |
| **Preview** | Per-branch deploys from PRs |

### Promotion checklist

1. Merge feature PR → `cursor/editor-next-aafa`
2. `cd frontend && npm run typecheck && npm test && npm run build`
3. Open/update PR: `cursor/editor-next-aafa` → `main`
4. After merge: confirm Vercel **Production Branch** = `main`
5. Verify Production SHA ≥ `071720b` (F-3B Plus fix)

---

## Editor Release — promoted to main (2026-06-08)

**PR:** #46 `cursor/editor-next-aafa` → `main`  
**Includes:** F-3B, F-4, F-5.0, UX-1 P0 (#47)

| Sprint | Summary |
|--------|---------|
| **F-3B** | Block extraction, `TableBlock` Plus import fix |
| **F-4** | Multi-select, group drag/duplicate/delete |
| **F-5.0** | SafeBlockRenderer, document recovery, CI (typecheck + test + build) |
| **UX-1 P0** | Block Delete/Backspace, menu viewport flip, row click focus |

**Tests:** 378 passing  
**Vercel Production:** `main` (set after merge)

### Not included

| Item | Status |
|------|--------|
| F-5.1 | Planned (`frontend/docs/F-5.1-design.md`) |
| UX-1 P1 | Transform menu, empty-doc click, divider polish |
| F-5C / F-5D / F-5F | Deferred |

---

## Verification commands

```bash
# Production commit
gh api 'repos/Absinthe-6785/Absinthe/deployments?environment=Production&per_page=1' \
  --jq '.[0] | {sha: .sha[0:8], at: .created_at}'

# F-3B Plus fix on deployed SHA
git merge-base --is-ancestor 071720b <production-sha> && echo "OK" || echo "Plus bug"
```

---

## Template (next release)

```markdown
## Editor Release — <name>

**Branch:** cursor/editor-next-aafa @ `<sha>` → main

### Included
- ✓ …

### Not included
- ✗ …
```
