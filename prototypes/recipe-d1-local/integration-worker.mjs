import { handleRecipeRequest } from './worker.mjs';

const ISSUER = 'https://recipe-auth.invalid/auth/v1';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
const decode = part => Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const json = part => JSON.parse(utf8.decode(decode(part)));
const error = (detail, status) => Response.json({ detail }, { status, headers: { 'cache-control': 'no-store' } });

// Synthetic trust root only. Hosted Supabase verification is a separate gate.
async function authenticatedSubject(request, publicJwk) {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.length > 8192) return null;
  const match = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(auth);
  if (!match) return null;
  const [, header, body, signature] = match;
  try {
    const { alg, kid, crit } = json(header);
    const jwk = JSON.parse(publicJwk);
    if (alg !== 'ES256' || crit !== undefined || typeof kid !== 'string' || !kid || kid !== jwk.kid
      || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || 'd' in jwk) return null;
    const sig = decode(signature);
    if (sig.length !== 64) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, encoder.encode(`${header}.${body}`))) return null;
    const { iss, aud, role, sub, exp, nbf, iat } = json(body);
    const now = Math.floor(Date.now() / 1000);
    return iss === ISSUER && (aud === 'authenticated' || (Array.isArray(aud) && aud.includes('authenticated')))
      && role === 'authenticated' && typeof sub === 'string' && UUID.test(sub)
      && Number.isSafeInteger(exp) && exp > now
      && (nbf === undefined || (Number.isSafeInteger(nbf) && nbf <= now))
      && (iat === undefined || (Number.isSafeInteger(iat) && iat <= now))
      ? sub : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.RECIPE_WORKER_MODE !== 'synthetic-local'
        || url.origin !== 'http://127.0.0.1:8787') return error('Not found', 404);
    const subject = await authenticatedSubject(request, env.RECIPE_QA_PUBLIC_JWK);
    if (!subject) return error('Unauthorized', 401);
    // The browser's expected account is only a veto, never a trust source.
    if (request.headers.get('X-Recipe-QA-Expected-Account') !== subject) return error('Unauthorized', 401);
    return handleRecipeRequest(request, env, subject);
  },
};
