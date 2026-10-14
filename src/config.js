// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module only provides the defaults
// and normalizes the received object, so the rest of the code never deals with
// `undefined` or with numbers typed as strings.
//
// The Ford session (tokens, pending PKCE verifier) is stored through
// `gladys.setConfig` under keys that are NOT in the config_schema: internal
// storage, never shown in the UI. See src/ford/session.js.
// -----------------------------------------------------------------------------

import { DEFAULT_REGION, REGIONS } from './ford/regions.js';
import { LANGUAGES } from './i18n.js';

// MUST stay consistent with the `default` values of the manifest config_schema
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  region: DEFAULT_REGION,
  // Seconds between two reads of a vehicle. Gladys polls at most once a
  // minute: slower intervals are applied by skipping polls (createPoller).
  poll_frequency: 300,
  distance_unit: 'km', // 'km' | 'mi'
  pressure_unit: 'bar', // 'bar' | 'kpa' | 'psi'
  // Fuel or battery level (%) under which the `low_energy` trigger fires.
  low_level_threshold: 15,
  // Language of the feature names created in Gladys (fixed at creation).
  names_language: 'en',
};

const DISTANCE_UNITS = ['km', 'mi'];
const PRESSURE_UNITS = ['bar', 'kpa', 'psi'];

function clamp(value, min, max, fallback) {
  const number = value === null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    region: oneOf(raw.region, Object.keys(REGIONS), DEFAULT_CONFIG.region),
    poll_frequency: clamp(raw.poll_frequency, 60, 3600, DEFAULT_CONFIG.poll_frequency),
    distance_unit: oneOf(raw.distance_unit, DISTANCE_UNITS, DEFAULT_CONFIG.distance_unit),
    pressure_unit: oneOf(raw.pressure_unit, PRESSURE_UNITS, DEFAULT_CONFIG.pressure_unit),
    low_level_threshold: clamp(raw.low_level_threshold, 1, 50, DEFAULT_CONFIG.low_level_threshold),
    names_language: oneOf(raw.names_language, LANGUAGES, DEFAULT_CONFIG.names_language),
  };
}
