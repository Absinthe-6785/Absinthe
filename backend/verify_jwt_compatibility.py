"""Pre-merge verification: local JWT vs real Supabase tokens.

Run from backend/: python verify_jwt_compatibility.py

Optional env:
  SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD — sign in for fresh token
  SUPABASE_TEST_ACCESS_TOKEN — use existing access token instead
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import jwt
from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError
from supabase import create_client

from auth import SupabaseJWTVerifier

load_dotenv()


@dataclass
class CheckResult:
    name: str
    expected: str
    actual: str
    passed: bool


@dataclass
class Report:
    claim_inventory: dict[str, Any] = field(default_factory=dict)
    token_header: dict[str, Any] = field(default_factory=dict)
    checks: list[CheckResult] = field(default_factory=list)
    safe_to_deploy: bool = False
    blockers: list[str] = field(default_factory=list)


def _decode_unverified(token: str) -> dict[str, Any]:
    return jwt.decode(token, options={"verify_signature": False})


def _claim_summary(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "iss": payload.get("iss"),
        "aud": payload.get("aud"),
        "exp": payload.get("exp"),
        "exp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(payload["exp"]))
        if payload.get("exp")
        else None,
        "sub": payload.get("sub"),
        "role": payload.get("role"),
        "iat": payload.get("iat"),
        "email": payload.get("email"),
        "session_id": payload.get("session_id"),
    }


def _provision_test_user(supabase_url: str, supabase_key: str) -> str:
    """Create a throwaway Supabase user and return its access token."""
    import uuid

    client = create_client(supabase_url, supabase_key)
    email = f"k91g-verify-{uuid.uuid4().hex[:8]}@absinthe-verify.invalid"
    password = f"K91g-Verify-{uuid.uuid4().hex[:16]}"
    response = client.auth.sign_up({"email": email, "password": password})
    if not response.session or not response.session.access_token:
        raise RuntimeError(f"sign_up did not return session: {getattr(response, 'message', response)}")
    return response.session.access_token


def _obtain_tokens(supabase_url: str, supabase_key: str) -> tuple[str, str | None]:
    """Return (production_or_stored_token, freshly_issued_token_or_none)."""
    stored = os.getenv("SUPABASE_TEST_ACCESS_TOKEN", "").strip()
    email = os.getenv("SUPABASE_TEST_EMAIL", "").strip()
    password = os.getenv("SUPABASE_TEST_PASSWORD", "").strip()
    provision = os.getenv("K91G_PROVISION_TEST_USER", "").strip().lower() in ("1", "true", "yes")

    fresh: str | None = None
    if email and password:
        client = create_client(supabase_url, supabase_key)
        response = client.auth.sign_in_with_password({"email": email, "password": password})
        if response.session and response.session.access_token:
            fresh = response.session.access_token

    if stored:
        return stored, fresh
    if fresh:
        return fresh, fresh
    if provision:
        token = _provision_test_user(supabase_url, supabase_key)
        return token, token
    raise RuntimeError(
        "No token source. Set SUPABASE_TEST_ACCESS_TOKEN, SUPABASE_TEST_EMAIL/PASSWORD, "
        "or K91G_PROVISION_TEST_USER=1 in backend/.env"
    )


def _remote_user_id(supabase, token: str) -> str:
    response = supabase.auth.get_user(token)
    if not response.user or not response.user.id:
        raise RuntimeError("get_user returned no user")
    return response.user.id


def _tamper_payload(token: str, **overrides: Any) -> str:
    """Return token with modified payload and invalid signature."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT")
    payload = _decode_unverified(token)
    payload.update(overrides)
    raw = json.dumps(payload, separators=(",", ":")).encode()
    b64 = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    return f"{parts[0]}.{b64}.{parts[2]}"


def _run_failure_checks(verifier: SupabaseJWTVerifier, valid_token: str) -> list[CheckResult]:
    results: list[CheckResult] = []

    cases: list[tuple[str, str]] = [
        ("Expired token", "exp"),
        ("Wrong audience", "aud"),
        ("Wrong issuer", "iss"),
        ("Modified signature", "sig"),
    ]

    for name, kind in cases:
        try:
            if kind == "exp":
                candidate = _tamper_payload(valid_token, exp=int(time.time()) - 60)
            elif kind == "aud":
                candidate = _tamper_payload(valid_token, aud="service_role")
            elif kind == "iss":
                candidate = _tamper_payload(valid_token, iss="https://evil.example.com/auth/v1")
            else:
                parts = valid_token.split(".")
                candidate = f"{parts[0]}.{parts[1]}.invalidsignature"

            verifier.verify_token(candidate)
            results.append(CheckResult(name, "reject", "accepted", False))
        except InvalidTokenError:
            results.append(CheckResult(name, "reject", "rejected", True))
        except Exception as exc:
            results.append(CheckResult(name, "reject", f"rejected ({type(exc).__name__})", True))

    return results


def run_verification() -> Report:
    report = Report()
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "").strip() or None

    if not supabase_url or not supabase_key:
        report.blockers.append("Missing SUPABASE_URL or SUPABASE_KEY")
        return report

    verifier = SupabaseJWTVerifier(supabase_url=supabase_url, jwt_secret=jwt_secret)
    supabase = create_client(supabase_url, supabase_key)

    try:
        production_token, fresh_token = _obtain_tokens(supabase_url, supabase_key)
    except RuntimeError as e:
        report.blockers.append(str(e))
        return report

    prod_payload = _decode_unverified(production_token)
    report.claim_inventory = _claim_summary(prod_payload)
    report.token_header = jwt.get_unverified_header(production_token)

    expected_iss = verifier.issuer
    actual_iss = prod_payload.get("iss")
    iss_ok = actual_iss == expected_iss
    report.checks.append(
        CheckResult("Issuer alignment", expected_iss, str(actual_iss), iss_ok)
    )
    if not iss_ok:
        report.blockers.append(f"Issuer mismatch: token iss={actual_iss!r}, verifier expects {expected_iss!r}")

    local_user: str | None = None
    try:
        local_user = verifier.verify_token(production_token)
        report.checks.append(
            CheckResult("Production token local verify", "pass", f"sub={local_user[:8]}...", True)
        )
    except InvalidTokenError as e:
        report.checks.append(
            CheckResult("Production token local verify", "pass", f"rejected: {e}", False)
        )
        report.blockers.append(f"Production token failed local verify: {e}")

    try:
        remote_user = _remote_user_id(supabase, production_token)
        if local_user is not None:
            match = local_user == remote_user
            report.checks.append(
                CheckResult(
                    "Production user_id parity (local vs get_user)",
                    remote_user,
                    local_user,
                    match,
                )
            )
            if not match:
                report.blockers.append(f"User ID mismatch: local={local_user}, get_user={remote_user}")
    except Exception as e:
        report.checks.append(
            CheckResult("Production user_id parity", "match", f"get_user error: {e}", False)
        )
        report.blockers.append(f"get_user baseline failed: {e}")

    if fresh_token and fresh_token != production_token:
        try:
            fresh_local = verifier.verify_token(fresh_token)
            fresh_remote = _remote_user_id(supabase, fresh_token)
            report.checks.append(
                CheckResult("Fresh token local verify", "pass", f"sub={fresh_local[:8]}...", True)
            )
            report.checks.append(
                CheckResult(
                    "Fresh user_id parity",
                    fresh_remote,
                    fresh_local,
                    fresh_local == fresh_remote,
                )
            )
            if fresh_local != fresh_remote:
                report.blockers.append("Fresh token user_id mismatch")
        except Exception as e:
            report.checks.append(
                CheckResult("Fresh token local verify", "pass", f"failed: {e}", False)
            )
            report.blockers.append(f"Fresh token failed: {e}")
    elif fresh_token:
        report.checks.append(
            CheckResult("Fresh token local verify", "pass", "same as production token", True)
        )

    report.checks.extend(_run_failure_checks(verifier, production_token))

    report.safe_to_deploy = not report.blockers and all(c.passed for c in report.checks)
    return report


def main() -> int:
    report = run_verification()

    print("=== K-91G Token Header ===")
    print(json.dumps(report.token_header, indent=2))

    print("\n=== K-91G Token Claim Inventory ===")
    print(json.dumps(report.claim_inventory, indent=2))

    print("\n=== Verification Matrix ===")
    print(f"{'Check':<42} | {'Expected':<28} | {'Actual':<28} | PASS")
    print("-" * 115)
    for c in report.checks:
        exp = str(c.expected)[:28]
        act = str(c.actual)[:28]
        print(f"{c.name:<42} | {exp:<28} | {act:<28} | {'YES' if c.passed else 'NO'}")

    print("\n=== Safe to deploy? ===")
    print("YES" if report.safe_to_deploy else "NO")
    if report.blockers:
        print("\nBlockers:")
        for b in report.blockers:
            print(f"  - {b}")

    return 0 if report.safe_to_deploy else 1


if __name__ == "__main__":
    sys.exit(main())
