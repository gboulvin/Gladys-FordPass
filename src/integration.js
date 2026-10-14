// -----------------------------------------------------------------------------
// The FordPass runtime: what index.js wires to the SDK.
//
// Holds the vehicles of the account (garage), their last snapshot, and
// implements every operation the Gladys surfaces reach: sign-in, discovery,
// polling, feature commands, manifest actions, scene actions and widgets.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import {
  ReauthRequiredError,
  buildAuthorizeUrl,
  createPkce,
  exchangeCode,
  parseAuthorizationCode,
} from './ford/auth.js';
import { FordClient } from './ford/client.js';
import { getRegion } from './ford/regions.js';
import { SessionStore } from './ford/session.js';
import { parseTelemetry } from './ford/telemetry.js';
import { COMMAND_LABELS, message } from './i18n.js';
import {
  FEATURE,
  buildVehicleDevice,
  buildVehicleStates,
  detectSceneEvents,
  vehicleIds,
  vehicleName,
  vinFromExternalId,
} from './vehicle.js';

const logger = createLogger({ name: 'fordpass' });

// A read due within this margin runs now: Gladys' poll ticks drift a little.
const POLL_TOLERANCE_MS = 30_000;
// `statusRefresh` wakes the vehicle modem up and drains the 12 V battery: the
// FordPass app allows a couple dozen a day, so does the integration.
const MAX_STATUS_REFRESHES_PER_DAY = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

// Feature commands: feature key -> [command when value is 1, command when 0].
const FEATURE_COMMANDS = {
  [FEATURE.LOCK]: ['lock', 'unlock'],
  [FEATURE.REMOTE_START]: ['remote_start', 'cancel_remote_start'],
  [FEATURE.CHARGING]: ['start_charge', 'stop_charge'],
};

export class FordPassIntegration {
  /**
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
   * @param {{ fetch?: Function, commandPolling?: object, onSnapshot?: Function }} [options]
   */
  constructor(gladys, { fetch: fetchImpl = globalThis.fetch, commandPolling, onSnapshot } = {}) {
    this.gladys = gladys;
    this.fetch = fetchImpl;
    this.config = normalizeConfig();
    this.sessionStore = new SessionStore(gladys);
    this.client = new FordClient({
      fetch: fetchImpl,
      getRegion: () => getRegion(this.config.region),
      sessionStore: this.sessionStore,
      commandPolling,
    });
    // VIN -> { vehicle, snapshot, readAt }
    this.vehicles = new Map();
    this.statusRefreshes = [];
    // Called after every new snapshot (index.js nudges the widgets).
    this.onSnapshot = onSnapshot ?? (() => {});
  }

  // --- Configuration -----------------------------------------------------------

  /** Apply a config received from Gladys; true when a device-shaping key changed. */
  applyConfig(rawConfig = {}) {
    const previous = this.config;
    this.config = normalizeConfig(rawConfig);
    this.sessionStore.hydrate(rawConfig);
    if (previous.region !== this.config.region) {
      // Another account region: the Autonomic token belongs to the old one.
      this.client.reset();
    }
    return ['distance_unit', 'pressure_unit', 'names_language', 'region'].some(
      (key) => previous[key] !== this.config[key],
    );
  }

  isConnected() {
    return this.client.isConnected();
  }

  // --- Vehicles ------------------------------------------------------------------

  /** Reload the vehicle list from Ford. */
  async loadVehicles() {
    const vehicles = await this.client.getVehicles();
    const known = new Set(vehicles.map((vehicle) => vehicle.vin));
    for (const vin of this.vehicles.keys()) {
      if (!known.has(vin)) {
        this.vehicles.delete(vin);
      }
    }
    for (const vehicle of vehicles) {
      const entry = this.vehicles.get(vehicle.vin);
      this.vehicles.set(vehicle.vin, { snapshot: null, readAt: null, ...entry, vehicle });
    }
    logger.info(`${vehicles.length} vehicle(s) on the Ford account`);
    return vehicles;
  }

  buildDevices() {
    return [...this.vehicles.values()].map(({ vehicle }) =>
      buildVehicleDevice(this.gladys, vehicle, this.config),
    );
  }

  async publishDevices() {
    await this.gladys.publishDiscoveredDevices(this.buildDevices());
  }

  /** The vehicle entry of a device / feature external id or a VIN. */
  findVehicle(externalIdOrVin) {
    const vin = vinFromExternalId(this.gladys, externalIdOrVin) ?? externalIdOrVin;
    return this.vehicles.get(vin) ?? null;
  }

  requireVehicle(externalIdOrVin) {
    const entry = this.findVehicle(externalIdOrVin);
    if (!entry) {
      const error = new Error('Unknown vehicle');
      error.userMessage = message('unknown_vehicle');
      throw error;
    }
    return entry;
  }

  /** The vehicles and their last snapshot, for the widgets. */
  listVehicles() {
    return [...this.vehicles.values()];
  }

  // --- (Re)connection ----------------------------------------------------------

  /** Called on every (re)connection to Gladys and after a sign-in. */
  async start() {
    if (!this.isConnected()) {
      await this.gladys.publishDiscoveredDevices([]);
      await this.gladys.setConnectionStatus(false, message('not_connected'));
      return;
    }
    try {
      await this.loadVehicles();
      await this.publishDevices();
      await this.gladys.setConnectionStatus(true);
    } catch (err) {
      await this.reportError(err);
    }
  }

  /** Reflect an error in the connection status of the Configuration screen. */
  async reportError(err) {
    if (err instanceof ReauthRequiredError) {
      logger.warn(`Ford session expired: ${err.message}`);
      await this.gladys.setConnectionStatus(false, message('session_expired')).catch(() => {});
      return;
    }
    logger.error('Ford request failed', err);
    await this.gladys.setConnectionStatus(false, message('ford_unreachable')).catch(() => {});
  }

  // --- Polling -------------------------------------------------------------------

  /**
   * Handler of `onPoll`: read the vehicle when the configured refresh
   * interval elapsed. Resolves true when the vehicle was read.
   */
  async poll(device, now = Date.now()) {
    const entry = this.findVehicle(device.external_id);
    if (!entry || !this.isConnected()) {
      return false;
    }
    if (
      entry.readAt !== null &&
      now - entry.readAt < this.config.poll_frequency * 1000 - POLL_TOLERANCE_MS
    ) {
      return false;
    }
    entry.readAt = now;
    try {
      await this.refreshVehicle(entry);
      await this.gladys.setConnectionStatus(true);
    } catch (err) {
      await this.reportError(err);
    }
    return true;
  }

  /** Read the telemetry of one vehicle, publish its states and scene events. */
  async refreshVehicle(entry, telemetry) {
    const raw = telemetry ?? (await this.client.getTelemetry(entry.vehicle.vin));
    const snapshot = parseTelemetry(raw);
    await this.applySnapshot(entry, snapshot);
    return snapshot;
  }

  async applySnapshot(entry, snapshot) {
    const previous = entry.snapshot;
    entry.snapshot = snapshot;
    const states = buildVehicleStates(this.gladys, entry.vehicle, snapshot, this.config);
    if (states.length > 0) {
      await this.gladys.publishStates(states);
    }
    for (const event of detectSceneEvents(
      this.gladys,
      entry.vehicle,
      previous,
      snapshot,
      this.config,
    )) {
      logger.info(`Scene event ${event.key} for ${vehicleName(entry.vehicle)}`);
      await this.gladys.publishSceneEvent(event.key, event.data).catch((err) => {
        logger.error(`Scene event ${event.key} refused`, err);
      });
    }
    this.onSnapshot(entry);
  }

  // --- Commands --------------------------------------------------------------------

  /**
   * Send a command to a vehicle and wait for its answer. A `refresh` asks the
   * vehicle for fresh values (rate-limited), then re-reads the telemetry.
   * @returns {Promise<{ success: boolean, status: string, reason?: string, message: object }>}
   */
  async runCommand(externalIdOrVin, command, now = Date.now()) {
    const entry = this.requireVehicle(externalIdOrVin);
    const name = vehicleName(entry.vehicle);
    if (command === 'refresh' && !this.takeStatusRefresh(now)) {
      // Over the daily budget: read what Ford already has instead of waking
      // the vehicle up once more.
      await this.refreshVehicle(entry);
      return {
        success: true,
        status: 'CACHED',
        message: message('refresh_done', { vehicle: name }),
      };
    }
    const result = await this.client.sendCommand(entry.vehicle.vin, command);
    logger.info(`Command ${command}: ${result.status}`);
    // The telemetry read while waiting already carries the new state.
    if (result.telemetry) {
      await this.refreshVehicle(entry, result.telemetry).catch((err) => {
        logger.warn(`Telemetry after ${command} unreadable: ${err.message}`);
      });
    }
    const label = COMMAND_LABELS[command];
    return {
      success: result.success,
      status: result.status,
      reason: result.reason,
      message: result.success
        ? message('command_sent', { vehicle: name, command: label })
        : message('command_failed', {
            vehicle: name,
            command: label,
            reason: String(result.reason ?? result.status).slice(0, 60),
          }),
    };
  }

  takeStatusRefresh(now) {
    this.statusRefreshes = this.statusRefreshes.filter((at) => now - at < DAY_MS);
    if (this.statusRefreshes.length >= MAX_STATUS_REFRESHES_PER_DAY) {
      return false;
    }
    this.statusRefreshes.push(now);
    return true;
  }

  /** Handler of `onSetValue`: lock, remote start and charge features. */
  async setValue(device, feature, value) {
    const key = feature.external_id.slice(device.external_id.length + 1);
    const commands = FEATURE_COMMANDS[key];
    if (!commands) {
      throw new Error(`Feature ${key} is read-only`);
    }
    const result = await this.runCommand(
      device.external_id,
      Number(value) === 1 ? commands[0] : commands[1],
    );
    if (!result.success) {
      // Throwing acks the command as failed: Gladys shows the reason.
      throw new Error(result.message.en);
    }
  }

  // --- Sign-in ---------------------------------------------------------------------

  /** Handler of the `ford_account` Connect button: the Ford sign-in page. */
  async getAuthorizeUrl() {
    const { verifier, challenge } = createPkce();
    await this.sessionStore.savePendingLogin({
      verifier,
      region: this.config.region,
      created_at: Date.now(),
    });
    return buildAuthorizeUrl(getRegion(this.config.region), challenge);
  }

  /** Manifest action `complete_login`: exchange the pasted code. */
  async completeLogin(redirectUrl) {
    const pending = this.sessionStore.loadPendingLogin();
    if (!pending) {
      return message('login_no_pending');
    }
    const code = parseAuthorizationCode(redirectUrl);
    if (!code) {
      return message('login_bad_url');
    }
    let session;
    try {
      session = await exchangeCode({
        fetch: this.fetch,
        region: getRegion(pending.region),
        code,
        verifier: pending.verifier,
      });
    } catch (err) {
      logger.warn(`Sign-in refused: ${err.message}`);
      return message('login_failed', { reason: err.message });
    }
    await this.sessionStore.save(session);
    await this.sessionStore.clearPendingLogin();
    this.client.reset();
    await this.start();
    return message('login_success', { count: this.vehicles.size });
  }

  /** Manifest action `test_connection`. */
  async testConnection() {
    if (!this.isConnected()) {
      return message('not_connected');
    }
    try {
      const vehicles = await this.loadVehicles();
      await this.gladys.setConnectionStatus(true);
      if (vehicles.length === 0) {
        return message('test_no_vehicle');
      }
      return message('test_ok', { vehicles: vehicles.map(vehicleName).join(', ') });
    } catch (err) {
      await this.reportError(err);
      return err instanceof ReauthRequiredError
        ? message('session_expired')
        : message('ford_unreachable');
    }
  }

  /** Manifest action `logout`: forget the tokens. */
  async logout() {
    await this.sessionStore.clear();
    this.client.reset();
    await this.gladys.setConnectionStatus(false, message('not_connected'));
    return message('logout_done');
  }

  /** The device external id of a VIN (widgets build their tiles with it). */
  deviceExternalId(vin) {
    return vehicleIds(this.gladys, vin).device;
  }
}
