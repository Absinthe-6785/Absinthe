# Shared Worker authentication preparation

This is a local candidate for future Health and Notes Workers, not an
enabled authentication path. It does not add a provider, database binding,
or production route. The existing Recipe fixture keeps its pinned synthetic
ES256 trust root; it shares the bearer parsing, signature and claim helpers.

- One trusted issuer (`https://<trusted-host>/auth/v1`) and one signing mode
  must be chosen by server configuration, never from a token or request.
  ES256/P-256 and RS256/2048–4096-bit RSA use public verification keys from
  the issuer's exact `/.well-known/jwks.json` endpoint. No redirects,
  forwarded credentials, embedded keys, remote user lookup, HS256 or
  unverified fallback. Do not infer the production project's signing mode.
- A valid signature must cover the exact issuer, authenticated audience and
  role, unexpired integer expiry, admissible optional `nbf`/`iat`, and a
  canonical UUID `sub`. The UUID passes through unchanged. Client-supplied
  account hints can veto at a resource boundary, never confer identity.
  Neither JWT user metadata nor client fields grant access.
- Keep one verifier per trusted issuer/mode/configuration lifetime in a future
  Worker. Its cache keeps a bounded snapshot of imported public keys for 60 s.
  Unknown key IDs can trigger a refresh at most once per 5 s per instance
  (also applies to failures); only the initiating request awaits refresh I/O.
  An abandoned refresh lease expires after 5 s; late evidence cannot take
  the place of a newer snapshot.
  A cold concurrent miss returns unavailable. Known keys may continue to
  verify until the fresh snapshot expires; expired evidence is not reused
  during outages. Replacement swaps the entire snapshot and an in-progress
  verification using the superseded snapshot cannot publish an identity.
- Standby/active keys of the same configured signing mode may overlap.
  Different-mode activation requires a separate compatibility decision.
  Supabase has its own discovery cache upstream of this local TTL. Plan
  rotation overlap and recovery; neither key revocation, user/session
  revocation nor logout is guaranteed to take effect immediately.

## Local validation

Use Node 24 in this directory: `npm ci`, then `npm test`. The existing
`recipe-worker-qa` job runs that command as well as the unchanged mounted
Recipe suite. For a focused run: `node --test core-worker-auth.test.mjs`.
The read-only Miniflare endpoint `GET /qa/auth/account` requires the
synthetic mode binding and an exact loopback origin; it has no database or
external discovery dependency. It returns only the verified synthetic
account UUID or a generic denial/unavailable response, with no caching.
The synthetic endpoint initializes its verifier per request; the separate
cache suite measures a reused verifier. No credentials or hosted endpoint
are needed.

In a deterministic Node fixture, 100 operations with one stable key yielded
100 signature checks, one simulated JWKS discovery and zero user lookups.
The rotation test observes five discovery attempts: initial, standby refresh,
retired key removal, outage and recovery. With pinned esbuild 0.25.12, minified
ESM (bytes before gzip / after gzip): Recipe fixture 6509/2800 → 6694/2887;
new Auth-only fixture 4271/2166. No runtime package was added. These are
local operation and build measurements, not hosted costs or latency.

Before Health integration: independently qualify the actual issuer, signing
mode and operational rotation/revocation policy in a separately approved
environment. Test hosted discovery transport without broadening trust.
Bind the exact verified UUID to the existing Health account, device,
session-generation and authority contracts before any persistent operations.
Do not enable a writer or use this fixture to change Notes identity or storage.

[Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys) ·
[Supabase JWTs](https://supabase.com/docs/guides/auth/jwts) ·
[Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) ·
[Workers request I/O isolation](https://developers.cloudflare.com/workers/observability/errors/#cannot-perform-io-on-behalf-of-a-different-request)
