import { readBearerParts, verifiedAccount, verifySignature } from './worker-jwt.mjs';

const ttl = 60_000;
const cooldown = 5_000;
const leaseLength = 5_000;
const maxJwksBytes = 65_536;
const ecImport = { name: 'ECDSA', namedCurve: 'P-256' };
const ecVerify = { name: 'ECDSA', hash: 'SHA-256' };
const rsa = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
const privateFields = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];
const validKid = kid => typeof kid === 'string' && /^[\w.-]{1,128}$/.test(kid);
const denied = Object.freeze({ status: 401 });
const unavailable = Object.freeze({ status: 503 });

async function readKeySet(response) {
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    throw new Error('JWKS unavailable');
  }
  const reader = response.body.getReader();
  const data = new Uint8Array(maxJwksBytes);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length > data.length - length) {
        await reader.cancel();
        throw new Error('JWKS too large');
      }
      data.set(value, length);
      length += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  const { keys } = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(0, length)));
  if (!Array.isArray(keys) || keys.length > 16) throw new Error('Invalid JWKS');
  return keys;
}

async function importKeys(response, algorithm) {
  const imported = new Map();
  const ids = new Set();
  for (const jwk of await readKeySet(response)) {
    if (!jwk || !validKid(jwk.kid) || ids.has(jwk.kid)) throw new Error('Invalid JWKS identity');
    ids.add(jwk.kid);
    // A standby key for a different signing mode does not widen the configured mode.
    if (jwk.alg !== algorithm) continue;
    if (privateFields.some(field => Object.hasOwn(jwk, field)) || jwk.use !== undefined && jwk.use !== 'sig'
      || jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || jwk.key_ops.length !== 1 || jwk.key_ops[0] !== 'verify')
      || (algorithm === 'ES256' ? jwk.kty !== 'EC' || jwk.crv !== 'P-256' : jwk.kty !== 'RSA')) {
      throw new Error('Not a supported public signing key');
    }
    const key = await crypto.subtle.importKey('jwk', jwk, algorithm === 'ES256' ? ecImport : rsa, false, ['verify']);
    if (algorithm === 'RS256' && (key.algorithm.modulusLength < 2048 || key.algorithm.modulusLength > 4096)) {
      throw new Error('Unsupported RSA key size');
    }
    imported.set(jwk.kid, key);
  }
  return imported;
}

// One instance per explicitly trusted issuer/mode; never configure from a token or request.
// fetchJwks and now are trusted dependency seams for local qualification.
export function createWorkerAuthenticator({ issuer, algorithm, fetchJwks = (url, options) => fetch(url, options), now = Date.now }) {
  const url = new URL(issuer);
  if (url.protocol !== 'https:' || issuer !== url.origin + '/auth/v1'
    || (algorithm !== 'ES256' && algorithm !== 'RS256')) throw new Error('Unsupported Auth configuration');
  const jwksUrl = issuer + '/.well-known/jwks.json';
  let snapshot;
  let retryAt = 0;
  let lease;
  let lastFetchFailed = false;

  async function refresh() {
    if (now() < (lease?.until ?? retryAt)) return;
    // Request-owned I/O may be canceled before its finally runs. Other requests
    // can replace an abandoned lease, but late work cannot commit or unlock it.
    const attempt = { until: now() + leaseLength };
    lease = attempt;
    try {
      const response = await fetchJwks(jwksUrl, {
        redirect: 'manual', cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(3000),
      });
      const keys = await importKeys(response, algorithm);
      const at = now();
      if (lease === attempt && at < attempt.until) {
        snapshot = { keys, expiresAt: at + ttl };
        lastFetchFailed = false;
      } else if (lease === attempt) lastFetchFailed = true;
    } catch {
      if (lease === attempt) lastFetchFailed = true;
    } finally {
      if (lease === attempt) {
        retryAt = now() + cooldown;
        lease = undefined;
      }
    }
  }

  return async function authenticate(request) {
    try {
      const parts = readBearerParts(request);
      if (!parts?.header || parts.header.alg !== algorithm || !validKid(parts.header.kid)
        || ['crit', 'b64', 'jwk', 'jku', 'x5u', 'x5c'].some(name => Object.hasOwn(parts.header, name))
        || (algorithm === 'ES256' ? parts.sig.length !== 64 : parts.sig.length < 256 || parts.sig.length > 512)) return denied;
      const kid = parts.header.kid;
      if (!snapshot?.keys.has(kid) || now() >= snapshot.expiresAt) await refresh();
      if (!snapshot || now() >= snapshot.expiresAt) return unavailable;
      const current = snapshot;
      const key = current.keys.get(kid);
      if (!key) return lease || lastFetchFailed ? unavailable : denied;
      if (!await verifySignature(parts, key, algorithm === 'ES256' ? ecVerify : rsa)) return denied;
      // A rotation/expiry during async verification must not publish obsolete authority.
      if (current !== snapshot || now() >= current.expiresAt) return unavailable;
      const accountId = verifiedAccount(parts.body, issuer, now(), true);
      return accountId ? { status: 200, accountId } : denied;
    } catch {
      return denied;
    }
  };
}
