// -----------------------------------------------------------------------------
// FordPass sign-in and tokens.
//
// Ford signs users in on its own Azure B2C page (authorization code + PKCE)
// and redirects to the custom scheme of its mobile app,
// `fordapp://userauthorized/?code=…`, which a browser cannot open: the user
// copies that address and pastes it into the `complete_login` action. The
// integration never sees the password.
//
// Three tokens follow:
//   1. the B2C token, only exchanged for
//   2. the Ford token (`auth-token` header of api.*.ford.com), refreshed with
//      its refresh token (~6 months), and
//   3. the Autonomic token (Bearer of api.autonomic.ai: telemetry and
//      commands), ~5 minutes, re-obtained from the Ford refresh token.
// -----------------------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_ID = '4566605f-43a7-400a-946e-89cc9fdb0bd7';
export const CLIENT_ID = '09852200-05fd-41f6-8c21-d36d3497dc64';
export const REDIRECT_URI = 'fordapp://userauthorized';

const FOUNDATIONAL_API = 'https://api.foundational.ford.com/api';
const AUTONOMIC_TOKEN_URL = 'https://accounts.autonomic.ai/v1/auth/oidc/token';

// Ford rejects the browser user agents on its token endpoints: the mobile
// app's HTTP stack is the one it expects.
export const BASE_HEADERS = {
  'Accept-Encoding': 'gzip',
  'User-Agent': 'okhttp/4.12.0',
};
export const JSON_HEADERS = { ...BASE_HEADERS, 'Content-Type': 'application/json' };
const FORM_HEADERS = { ...BASE_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' };

/** The session needs a new sign-in: refresh token revoked, expired or unknown. */
export class ReauthRequiredError extends Error {
  constructor(message = 'Ford session expired') {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

/** Ford answered, but with an error. */
export class FordApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FordApiError';
    this.status = status;
  }
}

const base64url = (buffer) => buffer.toString('base64url');

/** A PKCE pair (RFC 7636, S256). */
export function createPkce() {
  const verifier = base64url(randomBytes(96));
  const challenge = base64url(createHash('sha256').update(verifier, 'ascii').digest());
  return { verifier, challenge };
}

function policyUrl(region) {
  return `${region.loginUrl}/${OAUTH_ID}/B2C_1A_SignInSignUp_${region.locale}/oauth2/v2.0`;
}

/** The Ford sign-in page, for one region and one PKCE challenge. */
export function buildAuthorizeUrl(region, challenge) {
  // Built by hand, like the FordPass app: Ford's B2C policy is picky about
  // the encoding of `redirect_uri` and `scope`.
  return (
    `${policyUrl(region)}/authorize` +
    `?redirect_uri=${REDIRECT_URI}` +
    '&response_type=code' +
    '&max_age=3600' +
    `&code_challenge=${challenge}` +
    '&code_challenge_method=S256' +
    `&scope=%20${CLIENT_ID}%20openid` +
    `&client_id=${CLIENT_ID}` +
    `&ui_locales=${region.locale}` +
    `&language_code=${region.locale}` +
    `&ford_application_id=${region.appId}` +
    `&country_code=${region.countryCode}`
  );
}

/**
 * The authorization code out of what the user pasted: the whole
 * `fordapp://userauthorized/?code=…` address, or the bare code.
 * @returns {string | null}
 */
export function parseAuthorizationCode(input) {
  const text = String(input ?? '').trim();
  if (text === '') {
    return null;
  }
  const match = text.match(/[?&]code=([^&#\s]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  // A bare code: a long token without spaces nor URL syntax.
  if (/^[\w.-]{20,}$/.test(text)) {
    return text;
  }
  return null;
}

function errorReason(body, status) {
  if (body && typeof body === 'object') {
    return body.error_description ?? body.message ?? body.error ?? `HTTP ${status}`;
  }
  return `HTTP ${status}`;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const nowSeconds = () => Date.now() / 1000;

/** Ford token response -> stored session fields (absolute expiry dates). */
function toFordSession(body) {
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expiry_date: nowSeconds() + Number(body.expires_in ?? 0),
    refresh_expiry_date: body.refresh_expires_in
      ? nowSeconds() + Number(body.refresh_expires_in)
      : null,
  };
}

async function fetchFordToken(fetchImpl, region, path, payload) {
  const response = await fetchImpl(`${FOUNDATIONAL_API}/token/v2/${path}`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, 'Application-Id': region.appId },
    body: JSON.stringify(payload),
  });
  const body = await readJson(response);
  // Decided by the presence of the token, not the status: Ford sometimes
  // answers a token with an unusual status, and errors with a 200.
  if (body?.access_token) {
    return toFordSession(body);
  }
  const reason = errorReason(body, response.status);
  if (
    [400, 401].includes(response.status) &&
    (String(body?.errorCode) === '460' || /invalid|expired/i.test(reason))
  ) {
    throw new ReauthRequiredError(reason);
  }
  throw new FordApiError(reason, response.status);
}

/**
 * Exchange the authorization code for a Ford session.
 * @returns {Promise<object>} the session to store
 */
export async function exchangeCode({ fetch: fetchImpl, region, code, verifier }) {
  const response = await fetchImpl(`${policyUrl(region)}/token`, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: `${CLIENT_ID} openid`,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      resource: '',
      code,
      code_verifier: verifier,
    }).toString(),
  });
  const body = await readJson(response);
  if (!body?.access_token) {
    throw new FordApiError(errorReason(body, response.status), response.status);
  }
  return fetchFordToken(fetchImpl, region, 'cat-with-b2c-access-token', {
    idpToken: body.access_token,
  });
}

/** A new Ford session from the stored refresh token (the refresh token rotates). */
export function refreshFordSession({ fetch: fetchImpl, region, session }) {
  return fetchFordToken(fetchImpl, region, 'cat-with-refresh-token', {
    refresh_token: session.refresh_token,
  });
}

/**
 * A fresh Autonomic token. Ford's REFRESH token is the subject of the
 * exchange (not the access token): that is what the FordPass app does.
 * @returns {Promise<{ token: string, expiry: number }>}
 */
export async function fetchAutonomicToken({ fetch: fetchImpl, session }) {
  const response = await fetchImpl(AUTONOMIC_TOKEN_URL, {
    method: 'POST',
    headers: { accept: '*/*', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      subject_token: session.refresh_token,
      subject_issuer: 'fordpass',
      client_id: 'fordpass-prod',
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    }).toString(),
  });
  const body = await readJson(response);
  if (body?.access_token) {
    return { token: body.access_token, expiry: nowSeconds() + Number(body.expires_in ?? 300) };
  }
  throw new FordApiError(errorReason(body, response.status), response.status);
}
