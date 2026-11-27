import { handleRecipeRequest } from './worker.mjs';
import { readBearerParts, verifiedAccount, verifySignature } from './worker-jwt.mjs';

const ISSUER = 'https://recipe-auth.invalid/auth/v1';
const error = (detail, status) => Response.json({ detail }, { status, headers: { 'cache-control': 'no-store' } });

// Synthetic trust root only. Hosted Supabase verification is a separate gate.
async function authenticatedSubject(request, publicJwk) {
  try {
    const parts = readBearerParts(request);
    if (!parts) return null;
    const { alg, kid, crit } = parts.header;
    const jwk = JSON.parse(publicJwk);
    if (alg !== 'ES256' || crit !== undefined || typeof kid !== 'string' || !kid || kid !== jwk.kid
      || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || 'd' in jwk) return null;
    if (parts.sig.length !== 64) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await verifySignature(parts, key, { name: 'ECDSA', hash: 'SHA-256' })) return null;
    return verifiedAccount(parts.body, ISSUER);
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
