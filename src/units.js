// -----------------------------------------------------------------------------
// Unit conversions. Ford reports metric values (km, kPa, °C); the user picks
// the distance and tire pressure units shown in Gladys.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_UNITS } from '@gladysassistant/integration-sdk';

const KM_PER_MILE = 1.609344;
const KPA_PER_PSI = 6.894757;

export const DISTANCE_FEATURE_UNITS = {
  km: DEVICE_FEATURE_UNITS.KM,
  mi: DEVICE_FEATURE_UNITS.MILE,
};

export const PRESSURE_FEATURE_UNITS = {
  bar: DEVICE_FEATURE_UNITS.BAR,
  kpa: DEVICE_FEATURE_UNITS.KILO_PASCAL,
  psi: DEVICE_FEATURE_UNITS.PSI,
};

// Short labels for the values the integration formats itself (widget tiles).
export const DISTANCE_LABELS = { km: 'km', mi: 'mi' };
export const PRESSURE_LABELS = { bar: 'bar', kpa: 'kPa', psi: 'psi' };

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Kilometers to the configured distance unit (integer). */
export function convertDistance(km, unit) {
  if (km === null || km === undefined) {
    return null;
  }
  return Math.round(unit === 'mi' ? km / KM_PER_MILE : km);
}

/** Kilopascals to the configured pressure unit. */
export function convertPressure(kpa, unit) {
  if (kpa === null || kpa === undefined) {
    return null;
  }
  if (unit === 'kpa') {
    return Math.round(kpa);
  }
  if (unit === 'psi') {
    return round(kpa / KPA_PER_PSI, 1);
  }
  return round(kpa / 100, 2);
}
