export const GOOGLE_DRIVE_OAUTH_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_DRIVE_APP_DATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const BROAD_GOOGLE_DRIVE_SCOPES = new Set([
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]);

export interface GoogleDriveOAuthAuthorizationUrlInput {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly allowedRedirectUris: readonly string[];
  readonly codeVerifier?: string;
  readonly state?: string;
  readonly nonce?: string;
  readonly scopes?: readonly string[];
  readonly includeGrantedScopes?: boolean;
  readonly accessType?: 'online' | 'offline';
  readonly now?: () => Date;
}

export interface GoogleDriveOAuthAuthorizationUrlResult {
  readonly authorizationUrl: string;
  readonly state: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly nonce?: string;
  readonly scopes: readonly string[];
  readonly createdAt: string;
}

export interface RandomBytesSource {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

function cryptoSource(): RandomBytesSource {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    throw new Error('Secure random source is unavailable.');
  }
  return source;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SHA-256 crypto support is unavailable.');
  }
  return new Uint8Array(await subtle.digest('SHA-256', utf8Bytes(value)));
}

export function generateCodeVerifier(random: RandomBytesSource = cryptoSource()): string {
  const bytes = new Uint8Array(32);
  random.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function deriveCodeChallengeS256(codeVerifier: string): Promise<string> {
  if (!isValidCodeVerifier(codeVerifier)) {
    throw new Error('PKCE code verifier must be 43-128 URL-safe characters.');
  }
  return base64UrlEncode(await sha256Bytes(codeVerifier));
}

export function generateOAuthState(random: RandomBytesSource = cryptoSource()): string {
  const bytes = new Uint8Array(32);
  random.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function generateOAuthNonce(random: RandomBytesSource = cryptoSource()): string {
  const bytes = new Uint8Array(24);
  random.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function isValidCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

export function validateGoogleOAuthRedirectUri(
  redirectUri: string,
  allowedRedirectUris: readonly string[],
): string {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error('Google OAuth redirect URI is invalid.');
  }

  if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:' || parsed.protocol === 'file:') {
    throw new Error('Google OAuth redirect URI scheme is not allowed.');
  }

  if (!allowedRedirectUris.includes(redirectUri)) {
    throw new Error('Google OAuth redirect URI is not in the explicit allowlist.');
  }

  return redirectUri;
}

export function normalizeGoogleDriveOAuthScopes(scopes: readonly string[] = [GOOGLE_DRIVE_APP_DATA_SCOPE]): string[] {
  const normalized = Array.from(new Set(scopes.map(scope => scope.trim()).filter(Boolean))).sort();
  if (normalized.length === 0) {
    return [GOOGLE_DRIVE_APP_DATA_SCOPE];
  }

  const broadScope = normalized.find(scope => BROAD_GOOGLE_DRIVE_SCOPES.has(scope));
  if (broadScope) {
    throw new Error(`Google Drive OAuth scope is broader than the app data boundary: ${broadScope}`);
  }

  if (!normalized.includes(GOOGLE_DRIVE_APP_DATA_SCOPE)) {
    throw new Error('Google Drive OAuth must include the app data scope.');
  }

  return normalized;
}

export async function buildGoogleDriveOAuthAuthorizationUrl(
  input: GoogleDriveOAuthAuthorizationUrlInput,
): Promise<GoogleDriveOAuthAuthorizationUrlResult> {
  const clientId = input.clientId.trim();
  if (!clientId) {
    throw new Error('Google OAuth client id is required.');
  }

  const redirectUri = validateGoogleOAuthRedirectUri(input.redirectUri, input.allowedRedirectUris);
  const scopes = normalizeGoogleDriveOAuthScopes(input.scopes);
  const state = input.state ?? generateOAuthState();
  const nonce = input.nonce;
  const codeVerifier = input.codeVerifier ?? generateCodeVerifier();
  const codeChallenge = await deriveCodeChallengeS256(codeVerifier);
  const createdAt = (input.now ?? (() => new Date()))().toISOString();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: input.includeGrantedScopes === true ? 'true' : 'false',
  });

  if (nonce) {
    params.set('nonce', nonce);
  }
  if (input.accessType) {
    params.set('access_type', input.accessType);
  }

  return {
    authorizationUrl: `${GOOGLE_DRIVE_OAUTH_AUTHORIZATION_ENDPOINT}?${params.toString()}`,
    state,
    codeVerifier,
    codeChallenge,
    nonce,
    scopes,
    createdAt,
  };
}
