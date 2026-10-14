import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ReauthRequiredError,
  buildAuthorizeUrl,
  createPkce,
  exchangeCode,
  parseAuthorizationCode,
} from '../src/ford/auth.js';
import { FordClient, commandOutcome, parseGarage } from '../src/ford/client.js';
import { REGIONS, getRegion } from '../src/ford/regions.js';
import { BEV_VIN, FAST_COMMANDS, ICE_VIN, createFakeFord, validSession } from './helpers.js';

function memoryStore(session) {
  return {
    session,
    saved: [],
    load() {
      return this.session;
    },
    async save(next) {
      this.session = next;
      this.saved.push(next);
    },
  };
}

function client(ford, session = validSession()) {
  const sessionStore = memoryStore(session);
  return {
    sessionStore,
    client: new FordClient({
      fetch: ford.fetch,
      getRegion: () => REGIONS.fra,
      sessionStore,
      commandPolling: FAST_COMMANDS,
    }),
  };
}

test('PKCE: the challenge is the base64url SHA-256 of the verifier', () => {
  const { verifier, challenge } = createPkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{128}$/);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
});

test('the sign-in URL targets the region policy, app id and country', () => {
  const url = buildAuthorizeUrl(REGIONS.deu, 'CHALLENGE');
  assert.ok(
    url.startsWith(
      'https://login.ford.de/4566605f-43a7-400a-946e-89cc9fdb0bd7/B2C_1A_SignInSignUp_de-DE/oauth2/v2.0/authorize?',
    ),
  );
  assert.match(url, /redirect_uri=fordapp:\/\/userauthorized&/);
  assert.match(url, /code_challenge=CHALLENGE&code_challenge_method=S256/);
  assert.match(url, /ford_application_id=667D773E-1BDC-4139-8AD0-2B16474E8DC7/);
  assert.match(url, /country_code=DEU$/);
  assert.match(buildAuthorizeUrl(REGIONS.usa, 'C'), /ford_application_id=BFE8C5ED/);
});

test('an unknown region falls back to France', () => {
  assert.equal(getRegion('atlantis'), REGIONS.fra);
});

test('the code is read from the pasted address, or taken bare', () => {
  assert.equal(
    parseAuthorizationCode('  fordapp://userauthorized/?code=eyJabc.def-ghi  '),
    'eyJabc.def-ghi',
  );
  assert.equal(parseAuthorizationCode('fordapp://userauthorized?code=a%2Bb&state=x'), 'a+b');
  assert.equal(
    parseAuthorizationCode('eyJraWQiOiJjcGltY29yZV8wOTI1MjAyMCIsInZlciI6IjEuMCJ9'),
    'eyJraWQiOiJjcGltY29yZV8wOTI1MjAyMCIsInZlciI6IjEuMCJ9',
  );
  assert.equal(parseAuthorizationCode('https://login.ford.com/error'), null);
  assert.equal(parseAuthorizationCode(''), null);
});

test('exchangeCode chains the B2C and Ford token endpoints', async () => {
  const ford = createFakeFord();
  const session = await exchangeCode({
    fetch: ford.fetch,
    region: REGIONS.fra,
    code: 'good',
    verifier: 'v',
  });
  assert.equal(session.access_token, 'ford-access-1');
  assert.equal(session.refresh_token, 'ford-refresh-1');
  assert.ok(session.expiry_date > Date.now() / 1000);
  const b2c = new URLSearchParams(ford.calls[0].body);
  assert.equal(b2c.get('code_verifier'), 'v');
  assert.equal(b2c.get('redirect_uri'), 'fordapp://userauthorized');
  assert.equal(ford.calls[0].headers['User-Agent'], 'okhttp/4.12.0');
  assert.deepEqual(JSON.parse(ford.calls[1].body), { idpToken: 'b2c-token' });
  assert.equal(ford.calls[1].headers['Application-Id'], REGIONS.fra.appId);
});

test('exchangeCode reports the reason Ford gives', async () => {
  const ford = createFakeFord();
  await assert.rejects(
    exchangeCode({ fetch: ford.fetch, region: REGIONS.fra, code: 'bad-code', verifier: 'v' }),
    /AADB2C90080/,
  );
});

test('the garage parser reads the current and the legacy shapes', () => {
  assert.deepEqual(
    parseGarage([{ vin: 'V1', profile: { model: 'Puma', year: 2022, engineType: 'hev' } }]),
    [
      {
        vin: 'V1',
        nickname: null,
        model: 'Puma',
        year: '2022',
        engineType: 'HEV',
        capabilities: {},
      },
    ],
  );
  assert.equal(parseGarage({ vehicleProfile: [{ VIN: 'V2', model: 'Focus' }] })[0].vin, 'V2');
  assert.deepEqual(parseGarage(null), []);
});

test('getVehicles sends the Ford token and accepts a 207', async () => {
  const ford = createFakeFord();
  const { client: c } = client(ford);
  const vehicles = await c.getVehicles();
  assert.deepEqual(
    vehicles.map((v) => v.vin),
    [ICE_VIN, BEV_VIN],
  );
  const garageCall = ford.calls.find((call) => call.url.includes('garage'));
  assert.equal(garageCall.headers['auth-token'], 'ford-access-1');
  assert.equal(garageCall.headers.countryCode, 'FRA');
});

test('an expired Ford token is refreshed once, even by parallel calls', async () => {
  const ford = createFakeFord();
  const session = { ...validSession(), expiry_date: Date.now() / 1000 - 10 };
  const { client: c, sessionStore } = client(ford, session);
  await Promise.all([c.getTelemetry(ICE_VIN), c.getTelemetry(BEV_VIN), c.getVehicles()]);
  assert.equal(ford.tokenRefreshes, 1);
  assert.equal(ford.autonomicTokens, 1);
  assert.equal(sessionStore.session.refresh_token, 'ford-refresh-2');
  // The Autonomic exchange uses the Ford REFRESH token.
  const exchange = ford.calls.find((call) => call.url.includes('accounts.autonomic.ai'));
  assert.equal(new URLSearchParams(exchange.body).get('subject_token'), 'ford-refresh-2');
});

test('a revoked refresh token asks for a new sign-in', async () => {
  const ford = createFakeFord();
  ford.refreshStatus = 401;
  const { client: c } = client(ford, { ...validSession(), expiry_date: 0 });
  await assert.rejects(c.getVehicles(), ReauthRequiredError);
});

test('no session at all asks for a sign-in', async () => {
  const { client: c } = client(createFakeFord(), null);
  assert.equal(c.isConnected(), false);
  await assert.rejects(c.getTelemetry(ICE_VIN), ReauthRequiredError);
});

test('a 401 from Autonomic gets a new token and one retry', async () => {
  const ford = createFakeFord();
  const { client: c } = client(ford);
  await c.getTelemetry(ICE_VIN);
  ford.autonomicUnauthorizedOnce = true;
  const raw = await c.getTelemetry(ICE_VIN);
  assert.equal(raw.vin, ICE_VIN);
  assert.equal(ford.autonomicTokens, 2);
});

test('sendCommand posts the command and waits for its outcome', async () => {
  const ford = createFakeFord();
  const { client: c } = client(ford);
  const result = await c.sendCommand(ICE_VIN, 'lock');
  assert.equal(result.success, true);
  assert.equal(result.status, 'SUCCESS');
  const post = ford.calls.find((call) => call.method === 'POST' && call.url.includes('/command/'));
  assert.equal(post.url, `https://api.autonomic.ai/v1/command/vehicles/${ICE_VIN}/commands`);
  assert.deepEqual(JSON.parse(post.body), { tags: {}, type: 'lock', wakeUp: true, properties: {} });
});

test('charge commands use the v1beta endpoint with a version', async () => {
  const ford = createFakeFord();
  const { client: c } = client(ford);
  await c.sendCommand(BEV_VIN, 'start_charge');
  const post = ford.calls.find((call) => call.method === 'POST' && call.url.includes('/command/'));
  assert.ok(post.url.startsWith('https://api.autonomic.ai/v1beta/command/'));
  assert.deepEqual(JSON.parse(post.body), {
    tags: {},
    type: 'startGlobalChargeCommand',
    wakeUp: true,
    version: '1.0.1',
  });
});

test('a command the vehicle refuses carries the reason', async () => {
  const ford = createFakeFord();
  ford.commandToState = 'COMMAND_FAILED_ON_DEVICE';
  const { client: c } = client(ford);
  const result = await c.sendCommand(ICE_VIN, 'remote_start');
  assert.deepEqual(
    { success: result.success, status: result.status, reason: result.reason },
    { success: false, status: 'COMMAND_FAILED_ON_DEVICE', reason: 'DOOR_OPEN' },
  );
});

test('a command that never answers times out', async () => {
  const ford = createFakeFord();
  ford.commandToState = 'REQUEST_QUEUED';
  const { client: c } = client(ford);
  const result = await c.sendCommand(ICE_VIN, 'unlock');
  assert.equal(result.success, false);
  assert.equal(result.status, 'TIMEOUT');
});

test('commandOutcome ignores the outcome of another command', () => {
  const telemetry = {
    states: { commands: { lockCommand: { commandId: 'old', value: { toState: 'SUCCESS' } } } },
  };
  assert.equal(commandOutcome(telemetry, 'lock', 'new'), null);
  assert.deepEqual(commandOutcome(telemetry, 'lock', 'old'), { success: true, status: 'SUCCESS' });
});
