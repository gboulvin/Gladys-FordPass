// -----------------------------------------------------------------------------
// FordPass HTTP client: vehicle list, telemetry, remote commands.
//
// Ford publishes no public API for its connected cars: these are the calls of
// the FordPass mobile app. Every URL, header and command name of the
// integration lives here (and in auth.js), so a change on Ford's side is a
// one-file fix.
//
// `fetch` is injected (the global one in production, a fake in the tests).
// The session store persists the Ford tokens; the short-lived Autonomic token
// (~5 min) stays in memory.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  FordApiError,
  JSON_HEADERS,
  ReauthRequiredError,
  fetchAutonomicToken,
  refreshFordSession,
} from './auth.js';

const logger = createLogger({ name: 'ford-client' });

const VEHICLE_API = 'https://api.vehicle.ford.com/api';
const AUTONOMIC_V1 = 'https://api.autonomic.ai/v1';
const AUTONOMIC_V1BETA = 'https://api.autonomic.ai/v1beta';

const REQUEST_TIMEOUT_MS = 30_000;
// Refresh a token this long before it expires.
const EXPIRY_MARGIN_S = 30;

// Vehicle commands, keyed by the integration's own command names (stored in
// scenes: never rename a key).
export const COMMANDS = {
  lock: { base: AUTONOMIC_V1, type: 'lock' },
  unlock: { base: AUTONOMIC_V1, type: 'unlock' },
  remote_start: { base: AUTONOMIC_V1, type: 'remoteStart' },
  cancel_remote_start: { base: AUTONOMIC_V1, type: 'cancelRemoteStart' },
  // Wakes the modem up to read fresh values: drains the 12 V battery, so it
  // is rate-limited by the integration (see src/integration.js).
  refresh: { base: AUTONOMIC_V1, type: 'statusRefresh' },
  start_charge: { base: AUTONOMIC_V1BETA, type: 'startGlobalChargeCommand', version: '1.0.1' },
  stop_charge: { base: AUTONOMIC_V1BETA, type: 'cancelGlobalChargeCommand', version: '1.0.1' },
};

const SUCCESS_STATES = ['SUCCESS', 'COMMAND_SUCCEEDED_ON_DEVICE'];
const FAILURE_STATES = ['COMMAND_FAILED_ON_DEVICE', 'EXPIRED', 'FAILED', 'FAILURE'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FordClient {
  /**
   * @param {object} options
   * @param {Function} options.fetch
   * @param {() => object} options.getRegion the region of the account
   * @param {{ load(): object|null, save(session: object): Promise<void> }} options.sessionStore
   * @param {{ initialDelayMs?: number, intervalMs?: number, timeoutMs?: number }} [options.commandPolling]
   */
  constructor({ fetch: fetchImpl, getRegion, sessionStore, commandPolling = {} }) {
    this.fetch = fetchImpl;
    this.getRegion = getRegion;
    this.sessionStore = sessionStore;
    this.commandPolling = {
      initialDelayMs: 3000,
      intervalMs: 5000,
      timeoutMs: 90_000,
      ...commandPolling,
    };
    this.autonomic = null;
    this.refreshing = null;
  }

  isConnected() {
    return Boolean(this.sessionStore.load()?.refresh_token);
  }

  /** Forget the in-memory Autonomic token (new session, sign-out). */
  reset() {
    this.autonomic = null;
  }

  // Token refreshes are serialized: two parallel refreshes would rotate the
  // refresh token twice, and the first new one would be revoked.
  ensureTokens() {
    if (!this.refreshing) {
      this.refreshing = this.refreshTokens().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async refreshTokens() {
    let session = this.sessionStore.load();
    if (!session?.refresh_token) {
      throw new ReauthRequiredError('Not signed in');
    }
    const now = Date.now() / 1000 + EXPIRY_MARGIN_S;
    if (!session.access_token || !(session.expiry_date > now)) {
      logger.debug('Refreshing the Ford token');
      session = await refreshFordSession({ fetch: this.fetch, region: this.getRegion(), session });
      await this.sessionStore.save(session);
      this.autonomic = null;
    }
    if (!this.autonomic || now > this.autonomic.expiry) {
      logger.debug('Fetching an Autonomic token');
      this.autonomic = await fetchAutonomicToken({ fetch: this.fetch, session });
    }
    return { ford: session.access_token, autonomic: this.autonomic.token };
  }

  async request(url, { method = 'GET', headers = {}, body } = {}) {
    const response = await this.fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, ok: response.status >= 200 && response.status < 300, json };
  }

  // An Autonomic call, retried once with a new token on a 401.
  async autonomicRequest(url, options = {}) {
    for (let attempt = 0; ; attempt += 1) {
      const { autonomic } = await this.ensureTokens();
      const result = await this.request(url, {
        ...options,
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${autonomic}` },
      });
      if (result.status === 401 && attempt === 0) {
        this.autonomic = null;
        continue;
      }
      return result;
    }
  }

  /**
   * The vehicles of the account.
   * @returns {Promise<Array<{ vin: string, model: string|null, year: string|null, engineType: string, capabilities: object }>>}
   */
  async getVehicles() {
    const { ford } = await this.ensureTokens();
    const region = this.getRegion();
    const result = await this.request(`${VEHICLE_API}/fpcpl-user-garage-service/v1/user/garage`, {
      headers: {
        ...JSON_HEADERS,
        'auth-token': ford,
        'Application-Id': region.appId,
        countryCode: region.countryCode,
        locale: region.locale,
      },
    });
    // 207 (multi-status) is a success too: some vehicles lack a detail.
    if (!result.ok) {
      throw new FordApiError(`Garage: HTTP ${result.status}`, result.status);
    }
    return parseGarage(result.json);
  }

  /** The raw telemetry of one vehicle (metrics, states, events). */
  async getTelemetry(vin) {
    const result = await this.autonomicRequest(
      `${AUTONOMIC_V1}/telemetry/sources/fordpass/vehicles/${encodeURIComponent(vin)}?lrdt=01-01-1970%2000%3A00%3A00`,
    );
    if (result.ok && result.json) {
      return result.json;
    }
    if (result.status === 403) {
      throw new FordApiError('Vehicle not authorized: activate it in the FordPass app', 403);
    }
    // The newer query endpoint of the app, as a fallback.
    const query = await this.autonomicRequest(
      `${AUTONOMIC_V1BETA}/telemetry/sources/fordpass/vehicles/${encodeURIComponent(vin)}:query`,
      {
        method: 'POST',
        body: {
          includeMetrics: ['metrics', 'configurations', 'states', 'events', 'commands'],
        },
      },
    );
    if (query.ok && query.json) {
      return query.json;
    }
    throw new FordApiError(`Telemetry: HTTP ${query.status}`, query.status);
  }

  /**
   * Send a command and wait for the vehicle's answer.
   * @param {string} vin
   * @param {keyof COMMANDS} name
   * @returns {Promise<{ success: boolean, status: string, reason?: string, telemetry?: object }>}
   */
  async sendCommand(vin, name) {
    const command = COMMANDS[name];
    if (!command) {
      throw new Error(`Unknown command: ${name}`);
    }
    const body = { tags: {}, type: command.type, wakeUp: true };
    if (command.version) {
      body.version = command.version;
    } else {
      body.properties = {};
    }
    const result = await this.autonomicRequest(
      `${command.base}/command/vehicles/${encodeURIComponent(vin)}/commands`,
      { method: 'POST', body },
    );
    if (!result.ok) {
      return { success: false, status: 'REJECTED', reason: `HTTP ${result.status}` };
    }
    const commandId = result.json?.id ?? result.json?.commandId ?? result.json?.correlationId;
    logger.info(`Command ${name} accepted by Ford, waiting for the vehicle`);
    return this.waitForCommand(vin, command.type, commandId);
  }

  // Ford reports the outcome of a command in the telemetry `states`, under
  // `<type>Command` (or `<type>` for the types already ending in Command).
  async waitForCommand(vin, type, commandId) {
    const { initialDelayMs, intervalMs, timeoutMs } = this.commandPolling;
    const deadline = Date.now() + timeoutMs;
    await sleep(initialDelayMs);
    let telemetry;
    while (Date.now() <= deadline) {
      try {
        telemetry = await this.getTelemetry(vin);
        const outcome = commandOutcome(telemetry, type, commandId);
        if (outcome) {
          return { ...outcome, telemetry };
        }
      } catch (err) {
        if (err instanceof ReauthRequiredError) {
          throw err;
        }
        logger.warn(`Command status unavailable: ${err.message}`);
      }
      await sleep(intervalMs);
    }
    return { success: false, status: 'TIMEOUT', reason: 'no answer from the vehicle', telemetry };
  }
}

/** Command entry of the telemetry states, `states.commands.*` flattened. */
export function commandOutcome(telemetry, type, commandId) {
  const states = { ...(telemetry?.states ?? {}), ...(telemetry?.states?.commands ?? {}) };
  const key = type.endsWith('Command') ? type : states[type] ? type : `${type}Command`;
  const entry = states[key];
  if (!entry || (commandId && entry.commandId && entry.commandId !== commandId)) {
    return null;
  }
  const status = String(entry.value?.toState ?? '').toUpperCase();
  if (SUCCESS_STATES.includes(status)) {
    return { success: true, status };
  }
  if (FAILURE_STATES.includes(status)) {
    const failure = entry.value?.data?.commandError?.commandExecutionFailure;
    return {
      success: false,
      status,
      reason: failure?.oemErrorContext ?? failure?.oemErrorCode ?? status.toLowerCase(),
    };
  }
  return null;
}

/** The garage answer (current array shape, or the legacy `vehicleProfile`). */
export function parseGarage(json) {
  const list = Array.isArray(json) ? json : (json?.vehicleProfile ?? json?.vehicles ?? []);
  return list
    .map((entry) => {
      const profile = entry.profile ?? entry;
      const vin = entry.vin ?? entry.VIN ?? profile.vin ?? profile.VIN;
      if (!vin) {
        return null;
      }
      return {
        vin: String(vin),
        nickname: entry.nickName ?? entry.nickname ?? profile.nickName ?? null,
        model: profile.model ?? null,
        year: profile.year ? String(profile.year) : null,
        engineType: String(profile.engineType ?? 'ICE').toUpperCase(),
        capabilities: entry.capabilities ?? {},
      };
    })
    .filter(Boolean);
}
