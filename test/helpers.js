// -----------------------------------------------------------------------------
// Test helpers: a fake Ford backend behind an injectable `fetch`, and sample
// telemetry. Nothing here touches the network.
// -----------------------------------------------------------------------------

export const ICE_VIN = 'WF0XXXGCDXJA12345';
export const BEV_VIN = 'WF0EXXTTRENA54321';

export const GARAGE = [
  {
    vin: ICE_VIN,
    profile: { model: 'Kuga', year: '2021', engineType: 'ICE' },
    capabilities: { remoteLock: 'Display', remoteStart: 'Display' },
  },
  {
    vin: BEV_VIN,
    profile: { model: 'Mustang Mach-E', year: '2023', engineType: 'BEV' },
    capabilities: { remoteLock: 'Display' },
  },
];

/** A telemetry answer, metrics overridable. */
export function telemetry(overrides = {}, extra = {}) {
  const metrics = {
    odometer: { value: 42137.6 },
    fuelLevel: { value: 63.4 },
    fuelRange: { value: 512.2 },
    xevBatteryStateOfCharge: { value: 81.2 },
    xevBatteryRange: { value: 402 },
    batteryStateOfCharge: { value: 88 },
    batteryVoltage: { value: 12.6, vehicleBattery: 'PRIMARY_BATTERY' },
    doorLockStatus: [{ value: 'LOCKED', vehicleDoor: 'ALL_DOORS' }],
    alarmStatus: { value: 'ARMED' },
    ignitionStatus: { value: 'OFF' },
    doorStatus: [
      { value: 'CLOSED', vehicleDoor: 'UNSPECIFIED_FRONT', vehicleSide: 'DRIVER' },
      { value: 'CLOSED', vehicleDoor: 'UNSPECIFIED_FRONT', vehicleSide: 'PASSENGER' },
      { value: 'CLOSED', vehicleDoor: 'TAILGATE' },
    ],
    hoodStatus: { value: 'CLOSED' },
    windowStatus: [
      {
        value: { doubleRange: { lowerBound: 0, upperBound: 0 } },
        vehicleWindow: 'UNSPECIFIED_FRONT',
        vehicleSide: 'DRIVER',
      },
    ],
    tirePressure: [
      { value: 240, vehicleWheel: 'FRONT_LEFT' },
      { value: 241, vehicleWheel: 'FRONT_RIGHT' },
      { value: 235, vehicleWheel: 'REAR_LEFT' },
      { value: 236, vehicleWheel: 'REAR_RIGHT' },
    ],
    tirePressureStatus: [
      { value: 'NORMAL', vehicleWheel: 'FRONT_LEFT' },
      { value: 'NORMAL', vehicleWheel: 'FRONT_RIGHT' },
      { value: 'NORMAL', vehicleWheel: 'REAR_LEFT' },
      { value: 'NORMAL', vehicleWheel: 'REAR_RIGHT' },
    ],
    tirePressureSystemStatus: [{ value: 'NORMAL' }],
    oilLifeRemaining: { value: 72 },
    outsideTemperature: { value: 14.5 },
    position: { value: { location: { lat: 48.85837, lon: 2.294481, alt: 35 } } },
    xevPlugChargerStatus: { value: 'DISCONNECTED' },
    xevBatteryChargeDisplayStatus: { value: 'NOT_READY' },
    remoteStartCountdownTimer: { value: 0, updateTime: '2026-10-14T08:00:00Z' },
    ...overrides,
  };
  return {
    vin: ICE_VIN,
    updateTime: '2026-10-14T08:00:00.000Z',
    metrics,
    states: { commandPreclusion: { value: { toState: 'COMMANDS_PERMITTED' } } },
    events: {},
    ...extra,
  };
}

const jsonResponse = (status, body) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * A fake Ford backend. `ford.telemetry[vin]` is what the telemetry endpoint
 * serves; `ford.commandStates` the `toState` a sent command reaches;
 * `ford.calls` records every request ({ method, url, headers, body }).
 */
export function createFakeFord() {
  const ford = {
    calls: [],
    garage: GARAGE,
    telemetry: { [ICE_VIN]: telemetry(), [BEV_VIN]: telemetry({}, { vin: BEV_VIN }) },
    // Answer of the next token calls, overridable per test.
    b2cStatus: 200,
    refreshStatus: 200,
    autonomicUnauthorizedOnce: false,
    commandToState: 'SUCCESS',
    commandCount: 0,
    tokenRefreshes: 0,
    autonomicTokens: 0,
  };

  ford.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body;
    ford.calls.push({ method, url, headers: init.headers ?? {}, body });
    const auth = init.headers?.Authorization;

    if (url.endsWith('/oauth2/v2.0/token')) {
      const params = new URLSearchParams(body);
      if (ford.b2cStatus !== 200 || params.get('code') === 'bad-code') {
        return jsonResponse(400, {
          error: 'invalid_grant',
          error_description: 'AADB2C90080: expired',
        });
      }
      return jsonResponse(200, { access_token: 'b2c-token', id_token: 'id' });
    }
    if (url.endsWith('/token/v2/cat-with-b2c-access-token')) {
      return jsonResponse(200, {
        access_token: 'ford-access-1',
        refresh_token: 'ford-refresh-1',
        expires_in: 1800,
        refresh_expires_in: 15_552_000,
      });
    }
    if (url.endsWith('/token/v2/cat-with-refresh-token')) {
      ford.tokenRefreshes += 1;
      if (ford.refreshStatus !== 200) {
        return jsonResponse(ford.refreshStatus, {
          message: 'Invalid or Expired Token',
          errorCode: '460',
        });
      }
      const n = ford.tokenRefreshes + 1;
      return jsonResponse(200, {
        access_token: `ford-access-${n}`,
        refresh_token: `ford-refresh-${n}`,
        expires_in: 1800,
        refresh_expires_in: 15_552_000,
      });
    }
    if (url === 'https://accounts.autonomic.ai/v1/auth/oidc/token') {
      ford.autonomicTokens += 1;
      return jsonResponse(200, { access_token: `auto-${ford.autonomicTokens}`, expires_in: 300 });
    }
    if (url.endsWith('/fpcpl-user-garage-service/v1/user/garage')) {
      return jsonResponse(207, ford.garage);
    }
    if (url.startsWith('https://api.autonomic.ai/')) {
      if (ford.autonomicUnauthorizedOnce) {
        ford.autonomicUnauthorizedOnce = false;
        return jsonResponse(401, { error: 'UNAUTHORIZED' });
      }
      if (!auth?.startsWith('Bearer auto-')) {
        return jsonResponse(401, { error: 'UNAUTHORIZED' });
      }
      const telemetryMatch = url.match(/\/telemetry\/sources\/fordpass\/vehicles\/([^?:/]+)/);
      if (telemetryMatch) {
        const vin = decodeURIComponent(telemetryMatch[1]);
        return ford.telemetry[vin] ? jsonResponse(200, ford.telemetry[vin]) : jsonResponse(404, {});
      }
      const commandMatch = url.match(/\/command\/vehicles\/([^/]+)\/commands$/);
      if (commandMatch && method === 'POST') {
        const vin = decodeURIComponent(commandMatch[1]);
        const { type } = JSON.parse(body);
        ford.commandCount += 1;
        const commandId = `cmd-${ford.commandCount}`;
        const key = type.endsWith('Command') ? type : `${type}Command`;
        const current = ford.telemetry[vin];
        ford.telemetry[vin] = {
          ...current,
          states: {
            ...current.states,
            [key]: {
              commandId,
              value: {
                toState: ford.commandToState,
                data:
                  ford.commandToState === 'COMMAND_FAILED_ON_DEVICE'
                    ? {
                        commandError: { commandExecutionFailure: { oemErrorContext: 'DOOR_OPEN' } },
                      }
                    : undefined,
              },
            },
          },
        };
        if (type === 'unlock' && ford.commandToState === 'SUCCESS') {
          ford.telemetry[vin].metrics = {
            ...current.metrics,
            doorLockStatus: [{ value: 'UNLOCKED', vehicleDoor: 'ALL_DOORS' }],
          };
        }
        return jsonResponse(200, { id: commandId });
      }
    }
    return jsonResponse(404, { error: 'not found' });
  };
  return ford;
}

/** A session that is valid right now. */
export function validSession() {
  return {
    access_token: 'ford-access-1',
    refresh_token: 'ford-refresh-1',
    expiry_date: Date.now() / 1000 + 1800,
    refresh_expiry_date: Date.now() / 1000 + 15_552_000,
  };
}

// Commands answer at once in the tests.
export const FAST_COMMANDS = { initialDelayMs: 0, intervalMs: 1, timeoutMs: 50 };
