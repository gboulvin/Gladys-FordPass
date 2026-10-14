// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+), declared in the manifest `scene_actions` and
// registered by index.js with `gladys.onSceneAction(key, ...)`.
//
//   - `vehicle_command`: lock, unlock, remote start, charge... A command the
//     vehicle refuses is an OUTPUT (`success: false`), not an exception: a
//     scene action is never a condition, the scene author gates on it.
//   - `vehicle_status`: read the last values Ford has, exposed to the next
//     actions of the scene ({{<column>.<row>.fuel_level}}...).
//
// Scene TRIGGERS are fired by the polling, see detectSceneEvents in
// src/vehicle.js. Never fire one as a consequence of an action received here.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { convertDistance } from './units.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTION_KEYS = {
  VEHICLE_COMMAND: 'vehicle_command',
  VEHICLE_STATUS: 'vehicle_status',
};

/** The `vehicle_status` outputs of a snapshot (unknown values left out). */
export function statusOutputs(snapshot, config) {
  const range = snapshot.evRange ?? snapshot.fuelRange;
  const outputs = {
    odometer: convertDistance(snapshot.odometer, config.distance_unit),
    fuel_level: snapshot.fuelLevel,
    battery_level: snapshot.batteryLevel,
    range: convertDistance(range, config.distance_unit),
    locked: snapshot.locked,
    doors_open: snapshot.openDoors === null ? null : snapshot.openDoors.length > 0,
    windows_open: snapshot.openWindows === null ? null : snapshot.openWindows.length > 0,
    charging: snapshot.charging,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
  };
  return Object.fromEntries(Object.entries(outputs).filter(([, value]) => value !== null));
}

/** @param {import('./integration.js').FordPassIntegration} fordpass */
export function createSceneActions(fordpass) {
  return {
    async [SCENE_ACTION_KEYS.VEHICLE_COMMAND](fields) {
      logger.info(`Scene action vehicle_command <- ${fields.command}`);
      const result = await fordpass.runCommand(fields.vehicle, fields.command);
      return { success: result.success, status: result.status };
    },

    async [SCENE_ACTION_KEYS.VEHICLE_STATUS](fields) {
      logger.info('Scene action vehicle_status');
      const entry = fordpass.requireVehicle(fields.vehicle);
      const snapshot = await fordpass.refreshVehicle(entry);
      return statusOutputs(snapshot, fordpass.config);
    },
  };
}
