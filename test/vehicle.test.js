import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { parseGarage } from '../src/ford/client.js';
import { alarmState, lockState, parseTelemetry } from '../src/ford/telemetry.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  FEATURE,
  FEATURE_NAMES,
  SCENE_TRIGGERS,
  buildVehicleDevice,
  buildVehicleStates,
  detectSceneEvents,
  vehicleName,
  vinFromExternalId,
} from '../src/vehicle.js';
import { BEV_VIN, GARAGE, ICE_VIN, telemetry } from './helpers.js';

const [ICE, BEV] = parseGarage(GARAGE);
const config = normalizeConfig();

test('telemetry is normalized to metric values', () => {
  const snapshot = parseTelemetry(telemetry());
  assert.equal(snapshot.odometer, 42137.6);
  assert.equal(snapshot.fuelLevel, 63);
  assert.equal(snapshot.batteryLevel, 81);
  assert.equal(snapshot.lock, 'LOCKED');
  assert.equal(snapshot.locked, true);
  assert.equal(snapshot.alarm, 'ARMED');
  assert.equal(snapshot.ignitionOn, false);
  assert.deepEqual(snapshot.openDoors, []);
  assert.deepEqual(snapshot.openWindows, []);
  assert.deepEqual(snapshot.tireWarnings, []);
  assert.equal(snapshot.tirePressures.REAR_LEFT, 235);
  assert.equal(snapshot.latitude, 48.85837);
  assert.equal(snapshot.plugged, false);
  assert.equal(snapshot.charging, false);
  assert.equal(snapshot.remoteStartActive, false);
  assert.equal(snapshot.deepSleep, false);
});

test('a vehicle reporting nothing gives nulls, never an exception', () => {
  const snapshot = parseTelemetry({});
  for (const key of [
    'odometer',
    'fuelLevel',
    'lock',
    'alarm',
    'openDoors',
    'tireWarnings',
    'latitude',
    'plugged',
  ]) {
    assert.equal(snapshot[key], null, key);
  }
  assert.deepEqual(parseTelemetry(null).tirePressures.FRONT_LEFT, null);
});

test('door locks aggregate to locked, partly locked or unlocked', () => {
  const doors = (...values) => ({
    doorLockStatus: values.map((value, i) => ({ value, vehicleDoor: `DOOR_${i}` })),
  });
  assert.equal(lockState(doors('LOCKED', 'DOUBLE_LOCKED')), 'LOCKED');
  assert.equal(lockState(doors('LOCKED', 'UNLOCKED')), 'PARTLY_LOCKED');
  assert.equal(lockState(doors('UNLOCKED', 'UNKNOWN')), 'UNLOCKED');
  assert.equal(lockState(doors('UNKNOWN')), null);
  assert.equal(lockState({}), null);
});

test('alarm values map to armed, disarmed or triggered', () => {
  assert.equal(alarmState({ alarmStatus: { value: 'ARMED' } }), 'ARMED');
  assert.equal(alarmState({ alarmStatus: { value: 'DISARMED' } }), 'DISARMED');
  assert.equal(alarmState({ alarmStatus: { value: 'NOTSET' } }), 'DISARMED');
  assert.equal(alarmState({ alarmStatus: { value: 'ALARM_TRIGGERED' } }), 'TRIGGERED');
  assert.equal(
    alarmState({ alarmStatus: { value: 'ARMED' }, panicAlarmStatus: { value: 'ON' } }),
    'TRIGGERED',
  );
  assert.equal(alarmState({}), null);
});

test('open doors, hood and windows are named', () => {
  const snapshot = parseTelemetry(
    telemetry({
      doorStatus: [{ value: 'AJAR', vehicleDoor: 'UNSPECIFIED_REAR', vehicleSide: 'PASSENGER' }],
      hoodStatus: { value: 'OPEN' },
      windowStatus: [
        {
          value: { doubleRange: { lowerBound: 10, upperBound: 60 } },
          vehicleWindow: 'UNSPECIFIED_FRONT',
          vehicleSide: 'DRIVER',
        },
        { value: 'Fully_Closed', vehicleWindow: 'UNSPECIFIED_REAR', vehicleSide: 'DRIVER' },
      ],
    }),
  );
  assert.deepEqual(snapshot.openDoors, ['UNSPECIFIED_REAR_PASSENGER', 'HOOD']);
  assert.deepEqual(snapshot.openWindows, ['UNSPECIFIED_FRONT_DRIVER']);
});

test('a plugged EV charging in progress is charging', () => {
  const snapshot = parseTelemetry(
    telemetry({
      xevPlugChargerStatus: { value: 'CONNECTED' },
      xevBatteryChargeDisplayStatus: { value: 'IN_PROGRESS' },
      xevBatteryChargerVoltageOutput: { value: 230 },
      xevBatteryChargerCurrentOutput: { value: 32 },
    }),
  );
  assert.equal(snapshot.plugged, true);
  assert.equal(snapshot.charging, true);
  assert.equal(snapshot.chargePower, 7.4);
});

test('a petrol car and an EV get the features of their engine', async () => {
  const gladys = createFakeGladys();
  const devices = [
    buildVehicleDevice(gladys, ICE, config),
    buildVehicleDevice(gladys, BEV, config),
  ];
  // The fake Gladys refuses what the real one refuses (category, type, unit, poll frequency).
  await gladys.publishDiscoveredDevices(devices);
  const keys = (device) => device.features.map((f) => f.external_id.split(':').pop());
  assert.ok(keys(devices[0]).includes(FEATURE.FUEL_LEVEL));
  assert.ok(!keys(devices[0]).includes(FEATURE.BATTERY_LEVEL));
  assert.ok(keys(devices[1]).includes(FEATURE.BATTERY_LEVEL));
  assert.ok(keys(devices[1]).includes(FEATURE.CHARGING));
  assert.ok(!keys(devices[1]).includes(FEATURE.FUEL_LEVEL));
  assert.equal(devices[0].external_id, `ext:test-integration:vehicle:${ICE_VIN}`);
  assert.equal(devices[0].name, 'Ford 2021 Kuga');
  const writable = devices[1].features
    .filter((f) => !f.read_only)
    .map((f) => f.external_id.split(':').pop());
  assert.deepEqual(writable.sort(), [FEATURE.CHARGING, FEATURE.LOCK, FEATURE.REMOTE_START].sort());
});

test('feature names follow the configured language and units', () => {
  const gladys = createFakeGladys();
  const device = buildVehicleDevice(
    gladys,
    ICE,
    normalizeConfig({ names_language: 'de', distance_unit: 'mi', pressure_unit: 'psi' }),
  );
  const odometer = device.features.find((f) => f.external_id.endsWith(':odometer'));
  assert.equal(odometer.name, 'Kilometerstand');
  assert.equal(odometer.unit, 'mile');
  assert.equal(device.features.find((f) => f.external_id.endsWith(':tire-front-left')).unit, 'psi');
});

test('every feature name exists in the four languages', () => {
  for (const [key, names] of Object.entries(FEATURE_NAMES)) {
    for (const lang of LANGUAGES) {
      assert.ok(names[lang], `${key}.${lang}`);
    }
  }
});

test('states are published for the known values, converted', async () => {
  const gladys = createFakeGladys();
  const snapshot = parseTelemetry(telemetry());
  const states = buildVehicleStates(gladys, ICE, snapshot, config);
  await gladys.publishStates(states);
  const ids = (key) => `ext:test-integration:vehicle:${ICE_VIN}:${key}`;
  assert.equal(gladys.fake.lastState(ids(FEATURE.ODOMETER)), 42138);
  assert.equal(gladys.fake.lastState(ids(FEATURE.LOCK)), 1);
  assert.equal(gladys.fake.lastState(ids(FEATURE.DOORS_OPEN)), 0);
  assert.equal(gladys.fake.lastState(ids(FEATURE.TIRE_FRONT_LEFT)), 2.4);
  // Only the features the device declares.
  assert.equal(gladys.fake.lastState(ids(FEATURE.BATTERY_LEVEL)), undefined);
  // An unreported metric is not published.
  const empty = buildVehicleStates(
    gladys,
    ICE,
    parseTelemetry({ metrics: { odometer: { value: 10 } } }),
    config,
  );
  assert.equal(empty.length, 1);
});

test('vinFromExternalId reads device and feature ids only', () => {
  const gladys = createFakeGladys();
  assert.equal(vinFromExternalId(gladys, `ext:test-integration:vehicle:${BEV_VIN}`), BEV_VIN);
  assert.equal(vinFromExternalId(gladys, `ext:test-integration:vehicle:${BEV_VIN}:lock`), BEV_VIN);
  assert.equal(vinFromExternalId(gladys, 'ext:other:vehicle:X'), null);
  assert.equal(vinFromExternalId(gladys, undefined), null);
});

test('vehicle names prefer the nickname', () => {
  assert.equal(vehicleName({ vin: 'X', nickname: 'Mustang du dimanche' }), 'Mustang du dimanche');
  assert.equal(vehicleName({ vin: 'WF0ABCDEF123456', model: null, year: null }), 'Ford 123456');
});

const events = (previous, next, cfg = config) =>
  detectSceneEvents(
    createFakeGladys(),
    ICE,
    previous && parseTelemetry(previous),
    parseTelemetry(next),
    cfg,
  );

test('scene events fire on transitions only', () => {
  // First snapshot: no transition known.
  assert.deepEqual(events(null, telemetry({ fuelLevel: { value: 5 } })), []);
  // Unchanged: nothing.
  assert.deepEqual(events(telemetry(), telemetry()), []);
});

test('low_energy fires when the level crosses the threshold', () => {
  const fired = events(
    telemetry({ fuelLevel: { value: 16 } }),
    telemetry({ fuelLevel: { value: 14 } }),
  );
  assert.deepEqual(fired, [
    {
      key: SCENE_TRIGGERS.LOW_ENERGY,
      data: { device: `ext:test-integration:vehicle:${ICE_VIN}`, energy: 'fuel', level: 14 },
    },
  ]);
  assert.deepEqual(
    events(telemetry({ fuelLevel: { value: 14 } }), telemetry({ fuelLevel: { value: 12 } })),
    [],
  );
});

test('alarm_triggered fires when the alarm goes off, even on the first read', () => {
  const triggered = telemetry({ alarmStatus: { value: 'TRIGGERED' } });
  assert.equal(events(null, triggered)[0].key, SCENE_TRIGGERS.ALARM_TRIGGERED);
  assert.equal(events(telemetry(), triggered)[0].data.latitude, 48.85837);
  assert.deepEqual(events(triggered, triggered), []);
});

test('tire_pressure_warning fires once per newly flagged wheel', () => {
  const low = telemetry({
    tirePressureStatus: [{ value: 'LOW_PRESSURE', vehicleWheel: 'REAR_LEFT' }],
  });
  assert.deepEqual(
    events(telemetry(), low).map((e) => e.data),
    [{ device: `ext:test-integration:vehicle:${ICE_VIN}`, wheel: 'rear_left', pressure: 2.35 }],
  );
  assert.deepEqual(events(low, low), []);
});

test('charge_complete and ignition_changed fire on their transitions', () => {
  const charging = telemetry({
    xevPlugChargerStatus: { value: 'CONNECTED' },
    xevBatteryChargeDisplayStatus: { value: 'IN_PROGRESS' },
  });
  const done = telemetry({
    xevPlugChargerStatus: { value: 'CONNECTED' },
    xevBatteryChargeDisplayStatus: { value: 'STOPPED' },
  });
  assert.equal(events(charging, done)[0].key, SCENE_TRIGGERS.CHARGE_COMPLETE);
  const started = events(telemetry(), telemetry({ ignitionStatus: { value: 'ON' } }));
  assert.equal(started[0].key, SCENE_TRIGGERS.IGNITION_CHANGED);
  assert.equal(started[0].data.state, 'on');
  assert.equal(started[0].data.odometer, 42138);
});
