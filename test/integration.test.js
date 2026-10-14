import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { PENDING_LOGIN_KEY, SESSION_KEY } from '../src/ford/session.js';
import { FordPassIntegration } from '../src/integration.js';
import { createSceneActions } from '../src/scenes.js';
import {
  BEV_VIN,
  FAST_COMMANDS,
  ICE_VIN,
  createFakeFord,
  telemetry,
  validSession,
} from './helpers.js';

const deviceId = (vin) => `ext:test-integration:vehicle:${vin}`;

/** A runtime signed in, with its vehicles loaded. */
async function connected(config = {}) {
  const ford = createFakeFord();
  const gladys = createFakeGladys({
    config: { [SESSION_KEY]: JSON.stringify(validSession()), ...config },
  });
  const fordpass = new FordPassIntegration(gladys, {
    fetch: ford.fetch,
    commandPolling: FAST_COMMANDS,
  });
  fordpass.applyConfig(await gladys.getConfig());
  await fordpass.start();
  return { ford, gladys, fordpass };
}

test('without a session, no device and a "not connected" status', async () => {
  const gladys = createFakeGladys();
  const fordpass = new FordPassIntegration(gladys, { fetch: createFakeFord().fetch });
  fordpass.applyConfig(await gladys.getConfig());
  await fordpass.start();
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Connecter/);
});

test('the full sign-in: Connect, paste the address, vehicles discovered', async () => {
  const ford = createFakeFord();
  const gladys = createFakeGladys();
  const fordpass = new FordPassIntegration(gladys, { fetch: ford.fetch });
  fordpass.applyConfig(await gladys.getConfig());

  const url = await fordpass.getAuthorizeUrl();
  assert.match(url, /^https:\/\/login\.ford\.com\/.*B2C_1A_SignInSignUp_fr-FR/);
  assert.ok(JSON.parse(gladys.fake.config[PENDING_LOGIN_KEY]).verifier);

  const answer = await fordpass.completeLogin(
    'fordapp://userauthorized/?code=good-code-1234567890',
  );
  assert.match(answer.en, /2 vehicle/);
  assert.match(answer.es, /2 vehículo/);
  // Tokens stored outside the config schema, the pending login cleared.
  assert.equal(JSON.parse(gladys.fake.config[SESSION_KEY]).refresh_token, 'ford-refresh-1');
  assert.equal(gladys.fake.config[PENDING_LOGIN_KEY], '');
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.external_id),
    [deviceId(ICE_VIN), deviceId(BEV_VIN)],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('the session survives a restart (config reloaded)', async () => {
  const { gladys } = await connected();
  const restarted = new FordPassIntegration(gladys, { fetch: createFakeFord().fetch });
  restarted.applyConfig(await gladys.getConfig());
  assert.equal(restarted.isConnected(), true);
});

test('completing a sign-in that was never started says so', async () => {
  const gladys = createFakeGladys();
  const fordpass = new FordPassIntegration(gladys, { fetch: createFakeFord().fetch });
  const answer = await fordpass.completeLogin('fordapp://userauthorized/?code=abc');
  assert.match(answer.fr, /Aucune connexion en cours/);
});

test('a bad address or a refused code are explained', async () => {
  const gladys = createFakeGladys();
  const fordpass = new FordPassIntegration(gladys, { fetch: createFakeFord().fetch });
  await fordpass.getAuthorizeUrl();
  assert.match((await fordpass.completeLogin('https://example.com')).en, /no sign-in code/);
  const refused = await fordpass.completeLogin('fordapp://userauthorized/?code=bad-code');
  assert.match(refused.de, /abgelehnt/);
  assert.equal(fordpass.isConnected(), false);
});

test('poll publishes the states, at the configured interval', async () => {
  const { gladys, fordpass } = await connected({ poll_frequency: 600 });
  const device = { external_id: deviceId(ICE_VIN) };
  const now = Date.now();
  assert.equal(await fordpass.poll(device, now), true);
  assert.equal(gladys.fake.lastState(`${deviceId(ICE_VIN)}:fuel-level`), 63);
  assert.equal(await fordpass.poll(device, now + 60_000), false);
  assert.equal(await fordpass.poll(device, now + 600_000), true);
  assert.equal(await fordpass.poll({ external_id: 'ext:test-integration:vehicle:UNKNOWN' }), false);
});

test('poll fires the scene events of a transition', async () => {
  const { ford, gladys, fordpass } = await connected();
  const device = { external_id: deviceId(ICE_VIN) };
  await fordpass.poll(device, 0);
  ford.telemetry[ICE_VIN] = telemetry({
    alarmStatus: { value: 'TRIGGERED' },
    ignitionStatus: { value: 'ON' },
  });
  await fordpass.poll(device, 10 * 60_000);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((e) => e.key),
    ['alarm_triggered', 'ignition_changed'],
  );
});

test('an expired session shows in the connection status', async () => {
  const { ford, gladys, fordpass } = await connected();
  ford.refreshStatus = 401;
  fordpass.sessionStore.session.expiry_date = 0;
  await fordpass.poll({ external_id: deviceId(ICE_VIN) });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /expired/);
});

test('the lock feature locks and unlocks the vehicle', async () => {
  const { ford, gladys, fordpass } = await connected();
  const device = { external_id: deviceId(ICE_VIN) };
  await fordpass.setValue(device, { external_id: `${deviceId(ICE_VIN)}:lock` }, 0);
  const sent = ford.calls
    .filter((c) => c.url.includes('/commands'))
    .map((c) => JSON.parse(c.body).type);
  assert.deepEqual(sent, ['unlock']);
  // The telemetry read while waiting is published: the lock now reads 0.
  assert.equal(gladys.fake.lastState(`${deviceId(ICE_VIN)}:lock`), 0);
});

test('a refused command fails the feature command', async () => {
  const { ford, fordpass } = await connected();
  ford.commandToState = 'COMMAND_FAILED_ON_DEVICE';
  await assert.rejects(
    fordpass.setValue(
      { external_id: deviceId(ICE_VIN) },
      { external_id: `${deviceId(ICE_VIN)}:remote-start` },
      1,
    ),
    /Remote start.*failed \(DOOR_OPEN\)/,
  );
});

test('read-only features refuse commands', async () => {
  const { fordpass } = await connected();
  await assert.rejects(
    fordpass.setValue(
      { external_id: deviceId(ICE_VIN) },
      { external_id: `${deviceId(ICE_VIN)}:odometer` },
      1,
    ),
    /read-only/,
  );
});

test('status refreshes are capped per day, then served from the cache', async () => {
  const { ford, fordpass } = await connected();
  const now = Date.now();
  fordpass.statusRefreshes = Array.from({ length: 24 }, () => now - 1000);
  const result = await fordpass.runCommand(ICE_VIN, 'refresh', now);
  assert.equal(result.status, 'CACHED');
  assert.equal(ford.calls.filter((c) => c.url.includes('/commands')).length, 0);
  // A day later the budget is back.
  assert.equal(
    (await fordpass.runCommand(ICE_VIN, 'refresh', now + 25 * 3600_000)).status,
    'SUCCESS',
  );
});

test('scene actions send a command and read the status', async () => {
  const { fordpass } = await connected({ distance_unit: 'mi' });
  const actions = createSceneActions(fordpass);
  assert.deepEqual(
    await actions.vehicle_command({ vehicle: deviceId(BEV_VIN), command: 'start_charge' }),
    {
      success: true,
      status: 'SUCCESS',
    },
  );
  const status = await actions.vehicle_status({ vehicle: deviceId(ICE_VIN) });
  assert.equal(status.odometer, 26183);
  assert.equal(status.locked, true);
  assert.equal(status.doors_open, false);
  assert.equal(status.latitude, 48.85837);
  await assert.rejects(actions.vehicle_status({ vehicle: deviceId('NOPE') }), /Unknown vehicle/);
});

test('test_connection lists the vehicles, logout forgets the tokens', async () => {
  const { gladys, fordpass } = await connected();
  assert.match((await fordpass.testConnection()).en, /Ford 2021 Kuga, Ford 2023 Mustang Mach-E/);
  assert.match((await fordpass.logout()).fr, /jetons ont été supprimés/);
  assert.equal(gladys.fake.config[SESSION_KEY], '');
  assert.equal(fordpass.isConnected(), false);
  assert.match((await fordpass.testConnection()).en, /Not connected/);
});

test('changing the units asks for the devices to be re-published', async () => {
  const { fordpass } = await connected();
  assert.equal(fordpass.applyConfig({ ...fordpass.config, poll_frequency: 900 }), false);
  assert.equal(fordpass.applyConfig({ ...fordpass.config, pressure_unit: 'psi' }), true);
});
