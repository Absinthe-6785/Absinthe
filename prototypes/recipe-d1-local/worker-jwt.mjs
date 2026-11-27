const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
const decode = part => Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const json = part => JSON.parse(utf8.decode(decode(part)));

export function readBearerParts(request) {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.length > 8192) return null;
  const match = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(auth);
  if (!match) return null;
  const [, header, body, signature] = match;
  return { header: json(header), sig: decode(signature), body, input: encoder.encode(header + '.' + body) };
}

export function verifySignature(parts, key, algorithm) {
  return crypto.subtle.verify(algorithm, key, parts.sig, parts.input);
}

// Call only after successful signature verification.
export function verifiedAccount(body, issuer, nowMs = Date.now(), strictAudience = false) {
  const { iss, aud, role, sub, exp, nbf, iat } = json(body);
  const now = Math.floor(nowMs / 1000);
  return iss === issuer && (aud === 'authenticated' || (Array.isArray(aud) && aud.includes('authenticated')
    && (!strictAudience || aud.every(value => typeof value === 'string'))))
    && role === 'authenticated' && typeof sub === 'string' && UUID.test(sub)
    && Number.isSafeInteger(exp) && exp > now
    && (nbf === undefined || (Number.isSafeInteger(nbf) && nbf <= now))
    && (iat === undefined || (Number.isSafeInteger(iat) && iat <= now))
    ? sub : null;
}
