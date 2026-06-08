# Branch Workflow

```text
feature / sprint branch
        ↓  PR
cursor/editor-next-aafa    ← editor integration & CI gate
        ↓  PR (promotion)
main                       ← stable; Vercel Production
        ↓
Production
```

## Rules

1. **Editor sprints** merge into `cursor/editor-next-aafa` first — never directly to `main`.
2. **Promotion** to `main` only when `editor-next` is green (typecheck + test + build).
3. **Vercel Production** tracks `main`.
4. After promoting `editor-next` → `main`, fast-forward `editor-next` from `main` so both stay aligned.

## Commands

```bash
# Before opening editor-next → main PR
cd frontend && npm run typecheck && npm test && npm run build

# After main promotion
git checkout cursor/editor-next-aafa
git merge origin/main
git push origin cursor/editor-next-aafa

# Verify Production
gh api 'repos/Absinthe-6785/Absinthe/deployments?environment=Production&per_page=1' \
  --jq '.[0].sha[0:8]'
```

## Branch naming

- Integration: `cursor/editor-next-aafa`
- Sprints: `cursor/sprint-<name>-aafa` or `cursor/<feature>-aafa`
