# K-91G — Pre-Merge Verification Report

Branch: `k91g-auth-verification-optimization`  
Date: 2026-06-16  
Script: `backend/verify_jwt_compatibility.py`

---

## A. Compatibility Report

### Executive summary

Pre-merge verification against **live Supabase tokens** from project `fhaozlbrmyrzkrlysvmp` confirms that **local JWT verification works** after updating `auth.py` to support **ES256 asymmetric signing via JWKS**.

The initial K-91G implementation (HS256 + `SUPABASE_JWT_SECRET` only) was **incompatible** with this project's signing keys. That has been corrected.

### Environment tested

| Item | Value |
|------|-------|
| Supabase project | `fhaozlbrmyrzkrlysvmp.supabase.co` |
| JWKS endpoint | `https://fhaozlbrmyrzkrlysvmp.supabase.co/auth/v1/.well-known/jwks.json` |
| JWKS algorithm | **ES256** (NIST P-256) |
| Token source | Provisioned test account (`K91G_PROVISION_TEST_USER=1`) |
| Baseline comparison | One-time `get_user()` per parity check only (not per request path) |

### Compatibility findings

| Check | Result |
|-------|--------|
| Production access token (sign-up session) | Local verify **PASS** |
| Newly issued access token (sign-in session) | Local verify **PASS** |
| `sub` matches `get_user().id` | **PASS** (both token types) |
| Failure paths (exp / aud / iss / sig) | All **reject correctly** |
| Remote auth per protected request | **0** (local JWKS verify only) |

### Critical pre-merge fix applied

| Version | Mechanism | Compatible with this project? |
|---------|-----------|-------------------------------|
| Initial K-91G | HS256 + `SUPABASE_JWT_SECRET` | **NO** — project uses ES256 JWKS |
| Updated K-91G | ES256/RS256 via JWKS + optional HS256 legacy | **YES** |

---

## B. Token Claim Inventory

Captured from a real Supabase access token (unverified decode for inventory; verified via `SupabaseJWTVerifier`):

### JWT header

```json
{
  "alg": "ES256",
  "kid": "95364e27-e1ee-425d-ab51-2838fee9f5a3",
  "typ": "JWT"
}
```

### JWT payload (claims)

| Claim | Value |
|-------|-------|
| `iss` | `https://fhaozlbrmyrzkrlysvmp.supabase.co/auth/v1` |
| `aud` | `authenticated` |
| `exp` | `1781619115` (`2026-06-16T14:11:55Z`) |
| `iat` | `1781615515` |
| `sub` | `590ae2dd-a24b-4774-99b9-ffaed62be550` |
| `role` | `authenticated` |
| `email` | *(test account — omitted from report)* |
| `session_id` | `8dcf9fb2-1633-42ee-bdbf-cc1d1dd8e750` |

### Issuer / audience / expiration validation

| Claim | Expected by `auth.py` | Observed | Match |
|-------|----------------------|----------|-------|
| `iss` | `{SUPABASE_URL}/auth/v1` | `https://fhaozlbrmyrzkrlysvmp.supabase.co/auth/v1` | YES |
| `aud` | `authenticated` | `authenticated` | YES |
| `exp` | future timestamp | valid at test time | YES |
| `role` | `authenticated` | `authenticated` | YES |

---

## C. Verification Matrix

### Positive paths (real tokens)

| Token Type | Expected | Actual | Pass |
|------------|----------|--------|------|
| Sign-up access token — local verify | pass | `sub` extracted | YES |
| Sign-up access token — user_id parity vs `get_user()` | match | match | YES |
| Sign-in access token (newly issued) — local verify | pass | `sub` extracted | YES |
| Sign-in access token — user_id parity vs `get_user()` | match | match | YES |
| Sign-up vs sign-in tokens | distinct JWTs, same `sub` | distinct + same user | YES |
| Issuer alignment | `{SUPABASE_URL}/auth/v1` | matches token `iss` | YES |

### Failure paths (tampered tokens)

| Token Type | Expected | Actual | Pass |
|------------|----------|--------|------|
| Expired token | reject | rejected (`InvalidTokenError`) | YES |
| Wrong audience (`service_role`) | reject | rejected | YES |
| Wrong issuer (evil host) | reject | rejected | YES |
| Modified signature | reject | rejected | YES |

### Auth path (request → user id)

```text
Request
  ↓ Authorization: Bearer <access_token>
get_current_user()
  ↓ jwt_verifier.verify_token(token)     [LOCAL — no get_user()]
  ↓ PyJWKClient → ES256 public key verify
  ↓ validate iss, aud, exp, role, sub
user_id (= sub claim)
```

Parity confirmed: `verify_token(token)` **==** `get_user(token).user.id` for both sign-up and sign-in tokens.

---

## D. Safe to Deploy?

### **YES** (after JWKS/ES256 update)

Conditions met:

- Real ES256 Supabase access tokens validate locally
- Newly issued (sign-in) tokens validate locally
- User ID extraction matches prior `get_user()` behavior
- All negative test cases fail closed
- No `supabase.auth.get_user()` on the request hot path

### Would have been **NO** with HS256-only implementation

Exact incompatibility (initial K-91G):

```text
Token header alg: ES256
Verifier expected: HS256 + SUPABASE_JWT_SECRET
Result: InvalidTokenError / signature verification failure
```

This project migrated to **JWT Signing Keys (asymmetric ES256)**. The JWKS endpoint returns a public EC key; the legacy symmetric JWT secret is not used for user session tokens.

### Deployment notes

1. **`SUPABASE_JWT_SECRET` is optional** for this project — JWKS handles ES256 tokens.
2. **`SUPABASE_JWT_SECRET` remains supported** for legacy HS256 tokens if present.
3. **New dependency:** `PyJWT[crypto]` (requires `cryptography` for ES256).
4. **JWKS cache:** first verify fetches public keys; subsequent verifies use cached keys (still 0 remote `get_user()` calls).
5. Re-run verification before merge:

```bash
cd backend
pip install -r requirements.txt
K91G_PROVISION_TEST_USER=1 python verify_jwt_compatibility.py
# Or with a real account:
# SUPABASE_TEST_EMAIL=... SUPABASE_TEST_PASSWORD=... python verify_jwt_compatibility.py
```

Expected output: `Safe to deploy? YES`

---

## References

- `backend/auth.py` — `SupabaseJWTVerifier` (JWKS + legacy HS256)
- `backend/verify_jwt_compatibility.py` — automated pre-merge checks
- `backend/test_auth.py` — HS256 unit tests (legacy path)
- Supabase: [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- Supabase: [JWKS discovery](https://supabase.com/docs/guides/auth/jwts)
