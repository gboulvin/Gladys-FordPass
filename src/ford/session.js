// -----------------------------------------------------------------------------
// Storage of the Ford session.
//
// The tokens are stored with `gladys.setConfig` under keys that are NOT in the
// manifest `config_schema`: the documented internal storage of an integration,
// never displayed by the Configuration screen nor sent to the browser. Values
// are JSON strings, the most portable config value.
//
//   ford_session        { access_token, refresh_token, expiry_date, ... }
//   ford_pending_login  { verifier, region, created_at } between the "Connect"
//                       click and the "Complete the sign-in" action
// -----------------------------------------------------------------------------

export const SESSION_KEY = 'ford_session';
export const PENDING_LOGIN_KEY = 'ford_pending_login';

// A sign-in page left open longer than this is abandoned.
export const PENDING_LOGIN_TTL_MS = 10 * 60 * 1000;

function parse(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export class SessionStore {
  /** @param {{ setConfig(partial: object): Promise<unknown> }} gladys */
  constructor(gladys) {
    this.gladys = gladys;
    this.session = null;
    this.pendingLogin = null;
  }

  /** Load the stored values out of the config returned by getConfig(). */
  hydrate(rawConfig = {}) {
    // A config without the key says nothing about it: keep what we hold.
    if (SESSION_KEY in rawConfig) {
      this.session = parse(rawConfig[SESSION_KEY]);
    }
    if (PENDING_LOGIN_KEY in rawConfig) {
      this.pendingLogin = parse(rawConfig[PENDING_LOGIN_KEY]);
    }
  }

  load() {
    return this.session;
  }

  async save(session) {
    this.session = session;
    await this.gladys.setConfig({ [SESSION_KEY]: JSON.stringify(session) });
  }

  async clear() {
    this.session = null;
    this.pendingLogin = null;
    await this.gladys.setConfig({ [SESSION_KEY]: '', [PENDING_LOGIN_KEY]: '' });
  }

  async savePendingLogin(pending) {
    this.pendingLogin = pending;
    await this.gladys.setConfig({ [PENDING_LOGIN_KEY]: JSON.stringify(pending) });
  }

  /** The pending sign-in, or null when none was started or it expired. */
  loadPendingLogin(now = Date.now()) {
    const pending = this.pendingLogin;
    if (!pending?.verifier || now - pending.created_at > PENDING_LOGIN_TTL_MS) {
      return null;
    }
    return pending;
  }

  async clearPendingLogin() {
    this.pendingLogin = null;
    await this.gladys.setConfig({ [PENDING_LOGIN_KEY]: '' });
  }
}
