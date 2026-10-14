// -----------------------------------------------------------------------------
// Raw Ford telemetry -> normalized vehicle snapshot.
//
// Pure functions, no I/O: every JSON path of Ford's telemetry lives here. The
// answer is `{ updateTime, metrics: { <name>: { value } | [ { value, ... } ] },
// states, events }`; units are metric (km, kPa, °C). Parsing is defensive: a
// metric the vehicle does not report is `null`, never an exception — an ICE
// car has no battery charge, an EV no fuel level.
// -----------------------------------------------------------------------------

export const WHEELS = ['FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT'];

const upper = (value) =>
  value === null || value === undefined ? null : String(value).toUpperCase();

function number(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const metricValue = (metrics, name) => metrics?.[name]?.value;

function metricList(metrics, name) {
  const value = metrics?.[name];
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

/** LOCKED | PARTLY_LOCKED | UNLOCKED | null, from `doorLockStatus[]`. */
export function lockState(metrics) {
  const entries = metricList(metrics, 'doorLockStatus');
  if (entries.length === 0) {
    return null;
  }
  const isLocked = (entry) => ['LOCKED', 'DOUBLE_LOCKED'].includes(upper(entry.value));
  const all = entries.find((entry) => upper(entry.vehicleDoor) === 'ALL_DOORS');
  if (all && upper(all.value) !== 'UNKNOWN') {
    return isLocked(all) ? 'LOCKED' : 'UNLOCKED';
  }
  // Doors with a mechanical latch (no actuator) cannot report a lock state.
  const known = entries.filter(
    (entry) =>
      upper(entry.value) !== 'UNKNOWN' && upper(entry.tags?.DOOR_LATCH_TYPE) !== 'MECHANICAL',
  );
  if (known.length === 0) {
    return null;
  }
  const locked = known.filter(isLocked).length;
  if (locked === known.length) {
    return 'LOCKED';
  }
  return locked === 0 ? 'UNLOCKED' : 'PARTLY_LOCKED';
}

/** ARMED | DISARMED | TRIGGERED | null, from the free-form `alarmStatus`. */
export function alarmState(metrics) {
  const raw = upper(metricValue(metrics, 'alarmStatus'));
  const panic = upper(metricValue(metrics, 'panicAlarmStatus'));
  if (raw === null && panic === null) {
    return null;
  }
  if (/TRIGGER|SOUNDING|ALARM_ON/.test(raw ?? '') || /^(ON|ACTIVE)$/.test(panic ?? '')) {
    return 'TRIGGERED';
  }
  if (raw === null || /UNKNOWN|ERROR/.test(raw)) {
    return null;
  }
  if (/DISARM|NOT_?SET|^OFF$|INACTIVE/.test(raw)) {
    return 'DISARMED';
  }
  if (/ARM|SET|^ON$|ACTIVE/.test(raw)) {
    return 'ARMED';
  }
  return null;
}

// Door identifier: FRONT_LEFT, TAILGATE… or UNSPECIFIED_FRONT + DRIVER.
function openingName(entry, key) {
  const name = upper(entry[key]) ?? 'UNKNOWN';
  return entry.vehicleSide ? `${name}_${upper(entry.vehicleSide)}` : name;
}

/** Names of the open doors (hood included), or null when unreported. */
export function openDoors(metrics) {
  const doors = metricList(metrics, 'doorStatus');
  const hood = upper(metricValue(metrics, 'hoodStatus'));
  if (doors.length === 0 && hood === null) {
    return null;
  }
  const open = doors
    .filter((entry) => !['CLOSED', 'INVALID', 'UNKNOWN', null].includes(upper(entry.value)))
    .map((entry) => openingName(entry, 'vehicleDoor'));
  if (hood === 'OPEN' || hood === 'AJAR') {
    open.push('HOOD');
  }
  return open;
}

function isWindowOpen(value) {
  if (value && typeof value === 'object') {
    const range = value.doubleRange ?? value;
    const lower = number(range.lowerBound);
    const upperBound = number(range.upperBound);
    if (lower === null && upperBound === null) {
      return null;
    }
    return !(lower === 0 && upperBound === 0);
  }
  const text = upper(value);
  if (text === null || /UNKNOWN|INVALID/.test(text)) {
    return null;
  }
  return !/CLOSED/.test(text);
}

/** Names of the open windows, or null when unreported. */
export function openWindows(metrics) {
  const windows = metricList(metrics, 'windowStatus');
  const known = windows.filter((entry) => isWindowOpen(entry.value) !== null);
  if (known.length === 0) {
    return null;
  }
  return known
    .filter((entry) => isWindowOpen(entry.value))
    .map((entry) => openingName(entry, 'vehicleWindow'));
}

/** Pressure (kPa) per wheel of WHEELS, null when unreported. */
export function tirePressures(metrics) {
  const pressures = Object.fromEntries(WHEELS.map((wheel) => [wheel, null]));
  for (const entry of metricList(metrics, 'tirePressure')) {
    const wheel = upper(entry.vehicleWheel);
    if (wheel in pressures) {
      pressures[wheel] = number(entry.value);
    }
  }
  return pressures;
}

/** Wheels flagged by the tire pressure monitoring, or null when unreported. */
export function tireWarnings(metrics) {
  const statuses = metricList(metrics, 'tirePressureStatus');
  const system = metricList(metrics, 'tirePressureSystemStatus');
  if (statuses.length === 0 && system.length === 0) {
    return null;
  }
  const ok = (value) =>
    ['NORMAL', 'UNKNOWN', 'INVALID', 'NOT_SUPPORTED', null].includes(upper(value));
  const wheels = statuses
    .filter((entry) => !ok(entry.value))
    .map((entry) => upper(entry.vehicleWheel));
  if (
    wheels.length === 0 &&
    system.some((entry) => !ok(entry.value) && !/FAULT/.test(upper(entry.value)))
  ) {
    wheels.push('SYSTEM');
  }
  return wheels;
}

function position(metrics) {
  const location = metricValue(metrics, 'position')?.location;
  const latitude = number(location?.lat);
  const longitude = number(location?.lon);
  if (latitude === null || longitude === null || (latitude === 0 && longitude === 0)) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function chargingState(metrics) {
  const plug = upper(metricValue(metrics, 'xevPlugChargerStatus'));
  const display = upper(metricValue(metrics, 'xevBatteryChargeDisplayStatus'));
  if (plug === null && display === null) {
    return { plugged: null, charging: null, chargeStatus: null };
  }
  const charging =
    ['CHARGING', 'CHARGINGAC'].includes(plug) ||
    (plug === 'CONNECTED' && display === 'IN_PROGRESS');
  return {
    plugged: plug === null ? null : plug !== 'DISCONNECTED',
    charging,
    chargeStatus: display,
  };
}

function chargePowerKw(metrics) {
  const voltage = number(metricValue(metrics, 'xevBatteryChargerVoltageOutput'));
  const current = number(metricValue(metrics, 'xevBatteryChargerCurrentOutput'));
  if (voltage === null || current === null) {
    return null;
  }
  return Math.round((voltage * current) / 100) / 10;
}

function remoteStartActive(metrics) {
  const countdown = metrics?.remoteStartCountdownTimer;
  const seconds = number(countdown?.value);
  if (seconds === null) {
    return null;
  }
  if (seconds <= 0) {
    return false;
  }
  // The countdown is only true at its own updateTime.
  const since = Date.parse(countdown.updateTime);
  return Number.isNaN(since) ? true : since + seconds * 1000 > Date.now();
}

function deepSleep(telemetry) {
  const preclusion = upper(telemetry?.states?.commandPreclusion?.value?.toState);
  if (preclusion) {
    return preclusion === 'COMMANDS_PRECLUDED';
  }
  const flag = metricValue(telemetry?.metrics, 'deepSleepInProgress');
  return typeof flag === 'boolean' ? flag : null;
}

const roundTo = (value, decimals = 0) =>
  value === null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * The normalized snapshot of one vehicle.
 * @param {object} telemetry the raw answer of the telemetry endpoint
 */
export function parseTelemetry(telemetry) {
  const metrics = telemetry?.metrics ?? {};
  const ignition = upper(metricValue(metrics, 'ignitionStatus'));
  const lock = lockState(metrics);
  return {
    updatedAt: telemetry?.updateTime ?? null,
    odometer: roundTo(number(metricValue(metrics, 'odometer')), 1),
    fuelLevel: roundTo(number(metricValue(metrics, 'fuelLevel'))),
    fuelRange: roundTo(number(metricValue(metrics, 'fuelRange'))),
    batteryLevel: roundTo(number(metricValue(metrics, 'xevBatteryStateOfCharge'))),
    evRange: roundTo(number(metricValue(metrics, 'xevBatteryRange'))),
    battery12vLevel: roundTo(number(metricValue(metrics, 'batteryStateOfCharge'))),
    battery12vVoltage: roundTo(number(metricValue(metrics, 'batteryVoltage')), 1),
    lock,
    locked: lock === null ? null : lock === 'LOCKED',
    alarm: alarmState(metrics),
    ignitionOn: ignition === null ? null : ['ON', 'RUN', 'START', 'RUNNING'].includes(ignition),
    openDoors: openDoors(metrics),
    openWindows: openWindows(metrics),
    tirePressures: tirePressures(metrics),
    tireWarnings: tireWarnings(metrics),
    oilLife: roundTo(number(metricValue(metrics, 'oilLifeRemaining'))),
    outsideTemperature: roundTo(
      number(metricValue(metrics, 'outsideTemperature') ?? metricValue(metrics, 'ambientTemp')),
      1,
    ),
    ...position(metrics),
    ...chargingState(metrics),
    chargePower: chargePowerKw(metrics),
    remoteStartActive: remoteStartActive(metrics),
    deepSleep: deepSleep(telemetry),
  };
}
