# Absinthe backend production authority

This runbook defines the intended deployment chain for the production backend.
It does not contain credentials and does not authorize a deployment by itself.

## Canonical endpoints

- Production frontend: `https://absinthe-beryl.vercel.app`
- Production backend: `https://for-absinthe.onrender.com`
- Runtime revision probe: `GET https://for-absinthe.onrender.com/health`

The production Vercel build must set `VITE_API_URL` to the production backend
origin above. The built frontend bundle is the effective authority and should be
checked after every production deployment.

## Render service settings

The existing Render web service `for-absinthe` must use exactly:

- Source repository: `Absinthe-6785/Absinthe`
- Source branch: `main`
- Root directory: `backend`
- Runtime: Python 3
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Deploy trigger: after CI checks pass on `main`

These fields remain user-owned Render Dashboard configuration. Verify them in
the service Settings page before deploying. Do not create a second service or
attach a second Blueprint to the same service.

## Environment authority

Set this non-secret production value exactly:

```text
CORS_ORIGINS=https://absinthe-beryl.vercel.app
```

`CORS_ORIGINS` is required when `RENDER=true`. Wildcards, wildcard subdomains,
paths, credentials in URLs, empty entries, and non-HTTP(S) origins fail closed.
Local development defaults remain limited to `http://localhost:5173` and
`http://127.0.0.1:5173` when the app is not running on Render.

Verify only the presence, never the value, of required secret settings:

- `SUPABASE_URL`: present
- `SUPABASE_KEY`: present

`SUPABASE_JWT_SECRET` is needed only for a legacy HS256 project. The optional
K-323 remote-mutation path additionally requires its already-defined service
role setting when that path is enabled. Never copy secret values into tickets,
logs, screenshots, or this repository.

Render supplies `RENDER_GIT_COMMIT` at runtime. `/health` publishes it only when
it is an exact 40-character hexadecimal Git SHA; otherwise `gitCommit` is
`null`. The endpoint does not expose environment contents or user data.

## Post-merge deployment verification

1. Record the exact `origin/main` SHA after the reviewed PR is merged.
2. Verify every Render field above and save only if a field differs.
3. Verify `CORS_ORIGINS` and required secret-setting presence.
4. Deploy the recorded `main` commit, or allow the checks-pass trigger to do so.
5. Confirm `/health` returns that exact SHA in `gitCommit`.
6. Confirm the production frontend returns HTTP 200 and its built JavaScript
   contains `https://for-absinthe.onrender.com` as the API authority.
7. Send an OPTIONS preflight to `/api/notes` with the production Origin, method
   GET, and request headers `authorization,content-type`. Require HTTP 200,
   the exact `Access-Control-Allow-Origin`, and credentials support.
8. Repeat with `https://example.invalid`. Require no
   `Access-Control-Allow-Origin` response header.
9. Send an unauthenticated production-Origin GET to `/api/notes`. A 401 with
   valid production CORS headers is the expected auth-boundary result.

## Authenticated read-only smoke

From the real production frontend, sign in interactively without sharing any
credential or authorization header. Confirm that the session loads, Notes and
Recipe open without network/CORS errors, Settings shows the expected auth state,
and at least one authenticated GET succeeds. Do not create, delete, reset, or
restore data for this smoke test.
