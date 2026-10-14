// -----------------------------------------------------------------------------
// Device blueprint of a Ford vehicle: one Gladys device per VIN.
//
//   - buildVehicleDevice: the discovery payload, features chosen from the
//     engine type (no fuel level on an EV, no charge on a petrol car);
//   - buildVehicleStates: snapshot -> states of those features;
//   - detectSceneEvents: previous snapshot + new one -> scene triggers.
//
// The external ids are `ext:<selector>:vehicle:<VIN>[:<feature>]`. Feature
// keys (FEATURE) are stored by Gladys: never rename one.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { WHEELS } from './ford/telemetry.js';
import {
  DISTANCE_FEATURE_UNITS,
  PRESSURE_FEATURE_UNITS,
  convertDistance,
  convertPressure,
} from './units.js';

export const DEVICE_TYPE = 'vehicle';

export const FEATURE = {
  ODOMETER: 'odometer',
  FUEL_LEVEL: 'fuel-level',
  FUEL_RANGE: 'fuel-range',
  BATTERY_LEVEL: 'battery-level',
  EV_RANGE: 'ev-range',
  CHARGING: 'charging',
  PLUGGED: 'plugged',
  CHARGE_POWER: 'charge-power',
  BATTERY_12V: 'battery-12v',
  LOCK: 'lock',
  ALARM: 'alarm',
  DOORS_OPEN: 'doors-open',
  WINDOWS_OPEN: 'windows-open',
  REMOTE_START: 'remote-start',
  OIL_LIFE: 'oil-life',
  OUTSIDE_TEMPERATURE: 'outside-temperature',
  TIRE_FRONT_LEFT: 'tire-front-left',
  TIRE_FRONT_RIGHT: 'tire-front-right',
  TIRE_REAR_LEFT: 'tire-rear-left',
  TIRE_REAR_RIGHT: 'tire-rear-right',
};

export const TIRE_FEATURES = {
  FRONT_LEFT: FEATURE.TIRE_FRONT_LEFT,
  FRONT_RIGHT: FEATURE.TIRE_FRONT_RIGHT,
  REAR_LEFT: FEATURE.TIRE_REAR_LEFT,
  REAR_RIGHT: FEATURE.TIRE_REAR_RIGHT,
};

// Scene trigger keys, as declared in the manifest `scene_triggers` (stored by
// the scenes: never rename one).
export const SCENE_TRIGGERS = {
  LOW_ENERGY: 'low_energy',
  ALARM_TRIGGERED: 'alarm_triggered',
  TIRE_PRESSURE_WARNING: 'tire_pressure_warning',
  CHARGE_COMPLETE: 'charge_complete',
  IGNITION_CHANGED: 'ignition_changed',
};

// Feature names, in the language the user picked (`names_language`): Gladys
// stores a feature name once, at creation.
export const FEATURE_NAMES = {
  [FEATURE.ODOMETER]: {
    en: 'Odometer',
    fr: 'Kilométrage',
    de: 'Kilometerstand',
    es: 'Cuentakilómetros',
  },
  [FEATURE.FUEL_LEVEL]: {
    en: 'Fuel level',
    fr: 'Niveau de carburant',
    de: 'Tankfüllstand',
    es: 'Nivel de combustible',
  },
  [FEATURE.FUEL_RANGE]: {
    en: 'Fuel range',
    fr: 'Autonomie carburant',
    de: 'Reichweite (Kraftstoff)',
    es: 'Autonomía (combustible)',
  },
  [FEATURE.BATTERY_LEVEL]: {
    en: 'Battery charge',
    fr: 'Charge de la batterie',
    de: 'Akkustand',
    es: 'Carga de la batería',
  },
  [FEATURE.EV_RANGE]: {
    en: 'Electric range',
    fr: 'Autonomie électrique',
    de: 'Elektrische Reichweite',
    es: 'Autonomía eléctrica',
  },
  [FEATURE.CHARGING]: { en: 'Charging', fr: 'Charge en cours', de: 'Ladevorgang', es: 'Cargando' },
  [FEATURE.PLUGGED]: { en: 'Plugged in', fr: 'Branché', de: 'Angesteckt', es: 'Enchufado' },
  [FEATURE.CHARGE_POWER]: {
    en: 'Charging power',
    fr: 'Puissance de charge',
    de: 'Ladeleistung',
    es: 'Potencia de carga',
  },
  [FEATURE.BATTERY_12V]: {
    en: '12 V battery',
    fr: 'Batterie 12 V',
    de: '12-V-Batterie',
    es: 'Batería de 12 V',
  },
  [FEATURE.LOCK]: {
    en: 'Door lock',
    fr: 'Verrouillage',
    de: 'Zentralverriegelung',
    es: 'Cierre centralizado',
  },
  [FEATURE.ALARM]: {
    en: 'Alarm armed',
    fr: 'Alarme armée',
    de: 'Alarmanlage scharf',
    es: 'Alarma activada',
  },
  [FEATURE.DOORS_OPEN]: {
    en: 'Door open',
    fr: 'Porte ouverte',
    de: 'Tür offen',
    es: 'Puerta abierta',
  },
  [FEATURE.WINDOWS_OPEN]: {
    en: 'Window open',
    fr: 'Vitre ouverte',
    de: 'Fenster offen',
    es: 'Ventanilla abierta',
  },
  [FEATURE.REMOTE_START]: {
    en: 'Remote start',
    fr: 'Démarrage à distance',
    de: 'Fernstart',
    es: 'Arranque remoto',
  },
  [FEATURE.OIL_LIFE]: {
    en: 'Oil life',
    fr: "Durée de vie de l'huile",
    de: 'Öl-Restlebensdauer',
    es: 'Vida útil del aceite',
  },
  [FEATURE.OUTSIDE_TEMPERATURE]: {
    en: 'Outside temperature',
    fr: 'Température extérieure',
    de: 'Außentemperatur',
    es: 'Temperatura exterior',
  },
  [FEATURE.TIRE_FRONT_LEFT]: {
    en: 'Front left tire',
    fr: 'Pneu avant gauche',
    de: 'Reifen vorne links',
    es: 'Neumático delantero izquierdo',
  },
  [FEATURE.TIRE_FRONT_RIGHT]: {
    en: 'Front right tire',
    fr: 'Pneu avant droit',
    de: 'Reifen vorne rechts',
    es: 'Neumático delantero derecho',
  },
  [FEATURE.TIRE_REAR_LEFT]: {
    en: 'Rear left tire',
    fr: 'Pneu arrière gauche',
    de: 'Reifen hinten links',
    es: 'Neumático trasero izquierdo',
  },
  [FEATURE.TIRE_REAR_RIGHT]: {
    en: 'Rear right tire',
    fr: 'Pneu arrière droit',
    de: 'Reifen hinten rechts',
    es: 'Neumático trasero derecho',
  },
};

const ELECTRIC_ENGINES = ['BEV', 'ELECTRIC', 'EV'];
const HYBRID_ENGINES = ['PHEV', 'PLUGIN_HYBRID', 'PLUG_IN_HYBRID'];

/** What the engine type gives: a tank, a traction battery, or both. */
export function engineCapabilities(engineType) {
  const type = String(engineType ?? 'ICE').toUpperCase();
  const electric = ELECTRIC_ENGINES.includes(type);
  const plugIn = electric || HYBRID_ENGINES.includes(type);
  return { fuel: !electric, battery: plugIn };
}

export function vehicleIds(gladys, vin) {
  return gladys.externalIds(DEVICE_TYPE, vin);
}

/** The VIN of a vehicle device or feature external id, null for anything else. */
export function vinFromExternalId(gladys, externalId) {
  const prefix = gladys.externalId(`${DEVICE_TYPE}:`);
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

/** The name of a vehicle in Gladys: its nickname, else year + model. */
export function vehicleName(vehicle) {
  if (vehicle.nickname) {
    return vehicle.nickname;
  }
  const label = [vehicle.year, vehicle.model].filter(Boolean).join(' ');
  return label ? `Ford ${label}`.replace(/^Ford Ford /, 'Ford ') : `Ford ${vehicle.vin.slice(-6)}`;
}

function sensor(key, category, type, extra = {}) {
  return {
    key,
    category,
    type,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    ...extra,
  };
}

function binarySensor(key, category, type) {
  return sensor(key, category, type, { min: 0, max: 1 });
}

function percent(key, category, type) {
  return sensor(key, category, type, { unit: UNITS.PERCENT, min: 0, max: 100 });
}

/** The feature definitions of one vehicle (without external ids). */
export function vehicleFeatures(vehicle, config) {
  const { fuel, battery } = engineCapabilities(vehicle.engineType);
  const distanceUnit = DISTANCE_FEATURE_UNITS[config.distance_unit];
  const pressureUnit = PRESSURE_FEATURE_UNITS[config.pressure_unit];
  const features = [
    sensor(
      FEATURE.ODOMETER,
      CAT.ELECTRICAL_VEHICLE_STATE,
      TYPES.ELECTRICAL_VEHICLE_STATE.ODOMETER,
      {
        unit: distanceUnit,
        min: 0,
        max: 2_000_000,
      },
    ),
  ];
  if (fuel) {
    features.push(
      percent(FEATURE.FUEL_LEVEL, CAT.LEVEL_SENSOR, TYPES.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT),
      sensor(FEATURE.FUEL_RANGE, CAT.DISTANCE_SENSOR, TYPES.SENSOR.DECIMAL, {
        unit: distanceUnit,
        min: 0,
        max: 2000,
      }),
    );
  }
  if (battery) {
    features.push(
      percent(
        FEATURE.BATTERY_LEVEL,
        CAT.ELECTRICAL_VEHICLE_BATTERY,
        TYPES.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL,
      ),
      sensor(
        FEATURE.EV_RANGE,
        CAT.ELECTRICAL_VEHICLE_BATTERY,
        TYPES.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE,
        { unit: distanceUnit, min: 0, max: 1000 },
      ),
      // Controllable: 1 starts the charge, 0 stops it.
      {
        ...binarySensor(
          FEATURE.CHARGING,
          CAT.ELECTRICAL_VEHICLE_CHARGE,
          TYPES.ELECTRICAL_VEHICLE_CHARGE.CHARGE_ON,
        ),
        read_only: false,
        has_feedback: true,
      },
      binarySensor(
        FEATURE.PLUGGED,
        CAT.ELECTRICAL_VEHICLE_CHARGE,
        TYPES.ELECTRICAL_VEHICLE_CHARGE.PLUGGED,
      ),
      sensor(
        FEATURE.CHARGE_POWER,
        CAT.ELECTRICAL_VEHICLE_CHARGE,
        TYPES.ELECTRICAL_VEHICLE_CHARGE.CHARGE_POWER,
        {
          unit: UNITS.KILOWATT,
          min: 0,
          max: 350,
        },
      ),
    );
  }
  features.push(
    percent(FEATURE.BATTERY_12V, CAT.BATTERY, TYPES.BATTERY.INTEGER),
    // Controllable: 1 locks the vehicle, 0 unlocks it.
    {
      ...binarySensor(FEATURE.LOCK, CAT.LOCK, TYPES.LOCK.BINARY),
      read_only: false,
      has_feedback: true,
    },
    binarySensor(
      FEATURE.ALARM,
      CAT.ELECTRICAL_VEHICLE_COMMAND,
      TYPES.ELECTRICAL_VEHICLE_COMMAND.ALARM,
    ),
    binarySensor(
      FEATURE.DOORS_OPEN,
      CAT.ELECTRICAL_VEHICLE_STATE,
      TYPES.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED,
    ),
    binarySensor(
      FEATURE.WINDOWS_OPEN,
      CAT.ELECTRICAL_VEHICLE_STATE,
      TYPES.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED,
    ),
    // Controllable: 1 starts the engine remotely (cabin pre-conditioning), 0 stops it.
    {
      ...binarySensor(
        FEATURE.REMOTE_START,
        CAT.ELECTRICAL_VEHICLE_CLIMATE,
        TYPES.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON,
      ),
      read_only: false,
      has_feedback: true,
    },
  );
  if (fuel) {
    features.push(percent(FEATURE.OIL_LIFE, CAT.MAINTENANCE, TYPES.MAINTENANCE.LIFE_REMAINING));
  }
  features.push(
    sensor(FEATURE.OUTSIDE_TEMPERATURE, CAT.TEMPERATURE_SENSOR, TYPES.SENSOR.DECIMAL, {
      unit: UNITS.CELSIUS,
      min: -50,
      max: 60,
    }),
    ...WHEELS.map((wheel) =>
      sensor(
        TIRE_FEATURES[wheel],
        CAT.ELECTRICAL_VEHICLE_STATE,
        TYPES.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE,
        {
          unit: pressureUnit,
          min: 0,
          max: config.pressure_unit === 'kpa' ? 600 : config.pressure_unit === 'psi' ? 90 : 6,
        },
      ),
    ),
  );
  return features;
}

/**
 * The discovery payload of one vehicle.
 * @param {object} vehicle a garage entry ({ vin, nickname, model, year, engineType })
 */
export function buildVehicleDevice(gladys, vehicle, config) {
  const ids = vehicleIds(gladys, vehicle.vin);
  return {
    name: vehicleName(vehicle),
    external_id: ids.device,
    // Gladys polls a device at most once a minute: the refresh interval of the
    // config is applied by skipping polls (see src/integration.js).
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: vehicleFeatures(vehicle, config).map(({ key, ...feature }) => ({
      name: FEATURE_NAMES[key][config.names_language] ?? FEATURE_NAMES[key].en,
      external_id: ids.feature(key),
      ...feature,
    })),
  };
}

const bool = (value) => (value === null || value === undefined ? null : value ? 1 : 0);
const listFlag = (list) => (list === null || list === undefined ? null : list.length > 0 ? 1 : 0);

/** Snapshot value of every feature key (null = not reported). */
export function featureValues(snapshot, config) {
  const values = {
    [FEATURE.ODOMETER]: convertDistance(snapshot.odometer, config.distance_unit),
    [FEATURE.FUEL_LEVEL]: snapshot.fuelLevel,
    [FEATURE.FUEL_RANGE]: convertDistance(snapshot.fuelRange, config.distance_unit),
    [FEATURE.BATTERY_LEVEL]: snapshot.batteryLevel,
    [FEATURE.EV_RANGE]: convertDistance(snapshot.evRange, config.distance_unit),
    [FEATURE.CHARGING]: bool(snapshot.charging),
    [FEATURE.PLUGGED]: bool(snapshot.plugged),
    [FEATURE.CHARGE_POWER]: snapshot.charging === false ? 0 : snapshot.chargePower,
    [FEATURE.BATTERY_12V]: snapshot.battery12vLevel,
    [FEATURE.LOCK]: bool(snapshot.locked),
    [FEATURE.ALARM]: snapshot.alarm === null ? null : snapshot.alarm === 'DISARMED' ? 0 : 1,
    [FEATURE.DOORS_OPEN]: listFlag(snapshot.openDoors),
    [FEATURE.WINDOWS_OPEN]: listFlag(snapshot.openWindows),
    [FEATURE.REMOTE_START]: bool(snapshot.remoteStartActive),
    [FEATURE.OIL_LIFE]: snapshot.oilLife,
    [FEATURE.OUTSIDE_TEMPERATURE]: snapshot.outsideTemperature,
  };
  for (const wheel of WHEELS) {
    values[TIRE_FEATURES[wheel]] = convertPressure(
      snapshot.tirePressures?.[wheel],
      config.pressure_unit,
    );
  }
  return values;
}

/** The states to publish for one vehicle: its features with a known value. */
export function buildVehicleStates(gladys, vehicle, snapshot, config) {
  const ids = vehicleIds(gladys, vehicle.vin);
  const values = featureValues(snapshot, config);
  return vehicleFeatures(vehicle, config)
    .filter(({ key }) => typeof values[key] === 'number' && Number.isFinite(values[key]))
    .map(({ key }) => ({ device_feature_external_id: ids.feature(key), state: values[key] }));
}

/**
 * The scene events between two snapshots of a vehicle: one per TRANSITION,
 * never one per poll. Nothing fires on the first snapshot (no transition
 * known), except a sounding alarm.
 * @returns {Array<{ key: string, data: object }>}
 */
export function detectSceneEvents(gladys, vehicle, previous, next, config) {
  const device = vehicleIds(gladys, vehicle.vin).device;
  const events = [];
  const threshold = config.low_level_threshold;

  for (const [energy, field] of [
    ['fuel', 'fuelLevel'],
    ['battery', 'batteryLevel'],
  ]) {
    const before = previous?.[field];
    const after = next[field];
    if (
      typeof before === 'number' &&
      typeof after === 'number' &&
      before >= threshold &&
      after < threshold
    ) {
      events.push({ key: SCENE_TRIGGERS.LOW_ENERGY, data: { device, energy, level: after } });
    }
  }

  if (next.alarm === 'TRIGGERED' && previous?.alarm !== 'TRIGGERED') {
    events.push({
      key: SCENE_TRIGGERS.ALARM_TRIGGERED,
      data: { device, latitude: next.latitude, longitude: next.longitude },
    });
  }

  if (previous?.tireWarnings && next.tireWarnings) {
    for (const wheel of next.tireWarnings.filter((w) => !previous.tireWarnings.includes(w))) {
      const pressure = convertPressure(next.tirePressures?.[wheel], config.pressure_unit);
      events.push({
        key: SCENE_TRIGGERS.TIRE_PRESSURE_WARNING,
        data: { device, wheel: wheel.toLowerCase(), pressure },
      });
    }
  }

  if (previous?.charging === true && next.charging === false && next.chargeStatus !== 'FAULT') {
    events.push({
      key: SCENE_TRIGGERS.CHARGE_COMPLETE,
      data: {
        device,
        level: next.batteryLevel,
        range: convertDistance(next.evRange, config.distance_unit),
      },
    });
  }

  if (
    typeof previous?.ignitionOn === 'boolean' &&
    typeof next.ignitionOn === 'boolean' &&
    previous.ignitionOn !== next.ignitionOn
  ) {
    events.push({
      key: SCENE_TRIGGERS.IGNITION_CHANGED,
      data: {
        device,
        state: next.ignitionOn ? 'on' : 'off',
        odometer: convertDistance(next.odometer, config.distance_unit),
      },
    });
  }

  // Scene event values are primitives: drop the unknown (null) ones.
  return events.map(({ key, data }) => ({
    key,
    data: Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== null && value !== undefined),
    ),
  }));
}
