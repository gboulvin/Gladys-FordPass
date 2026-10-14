// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+), declared in the manifest `widgets`.
//
//   - `vehicle_overview`: one vehicle — live tiles (energy, range, odometer)
//     bound to its features, a status list computed from the last snapshot
//     (locks, alarm, openings, tires, last update) and buttons (lock, unlock,
//     refresh, map);
//   - `vehicle_fleet`: every vehicle of the account as a card list.
//
// The content is declarative: the core renders it with its own theme, and
// picks the user's language out of the `{ en, fr, de, es }` texts.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { COMMAND_LABELS } from './i18n.js';
import { DISTANCE_LABELS, PRESSURE_LABELS, convertDistance, convertPressure } from './units.js';
import { FEATURE, engineCapabilities, vehicleIds, vehicleName } from './vehicle.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = {
  VEHICLE_OVERVIEW: 'vehicle_overview',
  VEHICLE_FLEET: 'vehicle_fleet',
};

// Keys of the `button` actions of the vehicle_overview content.
const OVERVIEW_ACTIONS = ['lock', 'unlock', 'refresh'];

const T = {
  vehicle: { en: 'Vehicle', fr: 'Véhicule', de: 'Fahrzeug', es: 'Vehículo' },
  fuel: { en: 'Fuel', fr: 'Carburant', de: 'Kraftstoff', es: 'Combustible' },
  battery: { en: 'Battery', fr: 'Batterie', de: 'Akku', es: 'Batería' },
  range: { en: 'Range', fr: 'Autonomie', de: 'Reichweite', es: 'Autonomía' },
  odometer: { en: 'Odometer', fr: 'Kilométrage', de: 'Kilometerstand', es: 'Kilometraje' },
  doors: { en: 'Doors', fr: 'Portes', de: 'Türen', es: 'Puertas' },
  windows: { en: 'Windows', fr: 'Vitres', de: 'Fenster', es: 'Ventanillas' },
  alarm: { en: 'Alarm', fr: 'Alarme', de: 'Alarm', es: 'Alarma' },
  tires: { en: 'Tires', fr: 'Pneus', de: 'Reifen', es: 'Neumáticos' },
  lock: { en: 'Locks', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  charge: { en: 'Charge', fr: 'Charge', de: 'Laden', es: 'Carga' },
  updated: { en: 'Last update', fr: 'Mise à jour', de: 'Aktualisiert', es: 'Actualizado' },
  sleep: { en: 'Deep sleep', fr: 'Veille profonde', de: 'Tiefschlaf', es: 'Reposo profundo' },
  locked: { en: 'Locked', fr: 'Verrouillé', de: 'Verriegelt', es: 'Bloqueado' },
  partly: { en: 'Partly locked', fr: 'Partiellement', de: 'Teilweise', es: 'Parcialmente' },
  unlocked: { en: 'Unlocked', fr: 'Déverrouillé', de: 'Entriegelt', es: 'Desbloqueado' },
  closed: { en: 'Closed', fr: 'Fermées', de: 'Geschlossen', es: 'Cerradas' },
  open: { en: 'Open', fr: 'Ouvertes', de: 'Offen', es: 'Abiertas' },
  armed: { en: 'Armed', fr: 'Armée', de: 'Scharf', es: 'Activada' },
  disarmed: { en: 'Disarmed', fr: 'Désarmée', de: 'Unscharf', es: 'Desactivada' },
  triggered: { en: 'TRIGGERED', fr: 'DÉCLENCHÉE', de: 'AUSGELÖST', es: 'DISPARADA' },
  tires_ok: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  tires_check: {
    en: 'Check pressure',
    fr: 'Vérifier la pression',
    de: 'Druck prüfen',
    es: 'Revisar presión',
  },
  charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  plugged: { en: 'Plugged in', fr: 'Branché', de: 'Angesteckt', es: 'Enchufado' },
  unplugged: { en: 'Unplugged', fr: 'Débranché', de: 'Abgesteckt', es: 'Desenchufado' },
  sleep_on: {
    en: 'Commands paused',
    fr: 'Commandes suspendues',
    de: 'Befehle pausiert',
    es: 'Órdenes en pausa',
  },
  map: { en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  waiting: {
    en: 'Waiting for data…',
    fr: 'En attente…',
    de: 'Warten auf Daten…',
    es: 'Esperando datos…',
  },
  pick_vehicle: {
    en: 'Pick a vehicle in the widget settings (add it from the Discovery tab first).',
    fr: "Choisissez un véhicule dans les réglages du widget (ajoutez-le d'abord depuis la Découverte).",
    de: 'Wählen Sie ein Fahrzeug in den Widget-Einstellungen (zuerst in der Erkennung hinzufügen).',
    es: 'Elija un vehículo en los ajustes del widget (añádalo antes desde Descubrimiento).',
  },
  no_vehicle: {
    en: 'No vehicle yet: connect your FordPass account in the integration settings.',
    fr: "Aucun véhicule : connectez votre compte FordPass dans les réglages de l'intégration.",
    de: 'Noch kein Fahrzeug: Verbinden Sie Ihr FordPass-Konto in den Integrationseinstellungen.',
    es: 'Aún no hay vehículos: conecte su cuenta FordPass en los ajustes de la integración.',
  },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

function formatDate(iso, language) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(LOCALES[language] ?? 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function mapUrl(snapshot) {
  if (snapshot?.latitude === null || snapshot?.latitude === undefined) {
    return null;
  }
  const lat = snapshot.latitude.toFixed(5);
  const lon = snapshot.longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

/** The status rows of a vehicle snapshot (unknown values left out). */
export function statusItems(snapshot, config, language) {
  const items = [];
  if (snapshot.lock) {
    const lock = {
      LOCKED: [T.locked, WIDGET_COLORS.SUCCESS],
      PARTLY_LOCKED: [T.partly, WIDGET_COLORS.WARNING],
    }[snapshot.lock] ?? [T.unlocked, WIDGET_COLORS.DANGER];
    items.push({ label: T.lock, icon: 'lock', value: lock[0], color: lock[1] });
  }
  if (snapshot.alarm) {
    const alarm = {
      TRIGGERED: [T.triggered, WIDGET_COLORS.DANGER],
      ARMED: [T.armed, WIDGET_COLORS.SUCCESS],
      DISARMED: [T.disarmed, WIDGET_COLORS.NEUTRAL],
    }[snapshot.alarm];
    items.push({ label: T.alarm, icon: 'bell', value: alarm[0], color: alarm[1] });
  }
  for (const [label, list, icon] of [
    [T.doors, snapshot.openDoors, 'log-out'],
    [T.windows, snapshot.openWindows, 'wind'],
  ]) {
    if (list) {
      items.push({
        label,
        icon,
        value: list.length > 0 ? T.open : T.closed,
        color: list.length > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      });
    }
  }
  if (snapshot.tireWarnings) {
    const pressures = Object.values(snapshot.tirePressures ?? {})
      .filter((value) => value !== null)
      .map((value) => convertPressure(value, config.pressure_unit));
    const detail =
      pressures.length > 0
        ? ` (${Math.min(...pressures)}–${Math.max(...pressures)} ${PRESSURE_LABELS[config.pressure_unit]})`
        : '';
    const ok = snapshot.tireWarnings.length === 0;
    const text = ok ? T.tires_ok : T.tires_check;
    items.push({
      label: T.tires,
      icon: 'disc',
      value: Object.fromEntries(
        Object.entries(text).map(([lang, value]) => [lang, `${value}${detail}`]),
      ),
      color: ok ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    });
  }
  if (snapshot.plugged !== null) {
    const charge = snapshot.charging ? T.charging : snapshot.plugged ? T.plugged : T.unplugged;
    items.push({
      label: T.charge,
      icon: 'battery-charging',
      value: charge,
      color: snapshot.charging ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (snapshot.deepSleep) {
    items.push({ label: T.sleep, icon: 'moon', value: T.sleep_on, color: WIDGET_COLORS.WARNING });
  }
  const updated = snapshot.updatedAt ? formatDate(snapshot.updatedAt, language) : null;
  if (updated) {
    items.push({ label: T.updated, icon: 'clock', value: updated, color: WIDGET_COLORS.NEUTRAL });
  }
  return items;
}

function overviewContent(fordpass, entry, language) {
  const { vehicle, snapshot } = entry;
  const ids = vehicleIds(fordpass.gladys, vehicle.vin);
  const { fuel, battery } = engineCapabilities(vehicle.engineType);
  // At most 8 components: 3 tiles, 1 status list (or a caption), 4 buttons.
  const components = [];
  // Live tiles: they follow the published states, nothing to refresh.
  if (battery) {
    components.push(
      {
        type: 'gauge',
        label: T.battery,
        icon: 'battery',
        device_feature: ids.feature(FEATURE.BATTERY_LEVEL),
      },
      {
        type: 'value',
        label: T.range,
        icon: 'navigation',
        device_feature: ids.feature(FEATURE.EV_RANGE),
      },
    );
  }
  if (fuel) {
    components.push({
      type: 'gauge',
      label: T.fuel,
      icon: 'droplet',
      device_feature: ids.feature(FEATURE.FUEL_LEVEL),
    });
    if (!battery) {
      components.push({
        type: 'value',
        label: T.range,
        icon: 'navigation',
        device_feature: ids.feature(FEATURE.FUEL_RANGE),
      });
    }
  }
  components.push({
    type: 'value',
    label: T.odometer,
    icon: 'activity',
    device_feature: ids.feature(FEATURE.ODOMETER),
  });

  const nameRow = {
    label: T.vehicle,
    icon: 'truck',
    value: vehicleName(vehicle),
    color: WIDGET_COLORS.NEUTRAL,
  };
  if (!snapshot) {
    components.push({
      type: 'status',
      items: [
        nameRow,
        { label: T.updated, icon: 'clock', value: T.waiting, color: WIDGET_COLORS.NEUTRAL },
      ],
    });
  } else {
    components.push({
      type: 'status',
      items: [nameRow, ...statusItems(snapshot, fordpass.config, language)].slice(0, 10),
    });
  }

  // `params` are declared here and sent back as-is: never user input.
  const params = { vehicle: vehicle.vin };
  components.push(
    {
      type: 'button',
      label: COMMAND_LABELS.lock,
      icon: 'lock',
      style: 'primary',
      action: { key: 'lock', params },
    },
    {
      type: 'button',
      label: COMMAND_LABELS.unlock,
      icon: 'unlock',
      style: 'danger',
      action: { key: 'unlock', params, confirm: true },
    },
    {
      type: 'button',
      label: COMMAND_LABELS.refresh,
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: 'refresh', params },
    },
  );
  const url = mapUrl(snapshot);
  if (url) {
    components.push({
      type: 'button',
      label: T.map,
      icon: 'map-pin',
      style: 'secondary',
      link: { url },
    });
  }
  return components;
}

function fleetItem(entry, config) {
  const { vehicle, snapshot } = entry;
  // A plug-in hybrid shows its battery: the fuel is the fallback.
  const { battery } = engineCapabilities(vehicle.engineType);
  const level = battery ? snapshot?.batteryLevel : snapshot?.fuelLevel;
  const range = convertDistance(
    battery ? snapshot?.evRange : snapshot?.fuelRange,
    config.distance_unit,
  );
  const parts = [];
  if (typeof level === 'number') {
    parts.push(`${level} %`);
  }
  if (typeof range === 'number') {
    parts.push(`${range} ${DISTANCE_LABELS[config.distance_unit]}`);
  }
  const item = { title: vehicleName(vehicle) };
  if (parts.length > 0) {
    item.subtitle = parts.join(' · ');
  }
  if (snapshot?.lock) {
    item.badge =
      snapshot.lock === 'LOCKED'
        ? { text: T.locked, color: WIDGET_COLORS.SUCCESS }
        : {
            text: snapshot.lock === 'PARTLY_LOCKED' ? T.partly : T.unlocked,
            color: WIDGET_COLORS.DANGER,
          };
  }
  const url = mapUrl(snapshot);
  if (url) {
    item.links = [{ url, label: T.map }];
  }
  return item;
}

/** @param {import('./integration.js').FordPassIntegration} fordpass */
export function createWidgets(fordpass) {
  return {
    [WIDGET_KEYS.VEHICLE_OVERVIEW]: {
      async get({ settings = {}, language = 'en' } = {}) {
        logger.debug(`onWidgetGet <- ${WIDGET_KEYS.VEHICLE_OVERVIEW}`);
        const entry = settings.vehicle ? fordpass.findVehicle(settings.vehicle) : null;
        if (!entry) {
          return {
            ttl_seconds: 60,
            components: [
              {
                type: 'text',
                text: fordpass.listVehicles().length === 0 ? T.no_vehicle : T.pick_vehicle,
              },
            ],
          };
        }
        // The computed rows change with each poll: index.js nudges the widget
        // after every new snapshot, the TTL is a safety net.
        return { ttl_seconds: 600, components: overviewContent(fordpass, entry, language) };
      },

      // Resolve a toast (≤ 200 characters), in the user's language — a
      // command the vehicle refused says so too.
      async action({ actionKey, params }) {
        logger.info(`onWidgetAction <- ${WIDGET_KEYS.VEHICLE_OVERVIEW}.${actionKey}`);
        if (!OVERVIEW_ACTIONS.includes(actionKey)) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        const result = await fordpass.runCommand(params.vehicle, actionKey);
        return result.message;
      },
    },

    [WIDGET_KEYS.VEHICLE_FLEET]: {
      async get() {
        const vehicles = fordpass.listVehicles();
        if (vehicles.length === 0) {
          return { ttl_seconds: 300, components: [{ type: 'text', text: T.no_vehicle }] };
        }
        return {
          ttl_seconds: 600,
          components: [
            {
              type: 'card-list',
              display: 'list',
              items: vehicles.slice(0, 8).map((entry) => fleetItem(entry, fordpass.config)),
            },
          ],
        };
      },
    },
  };
}

/** Ask the core to re-pull every widget now (rate-limited 1 per 10 s per widget). */
export function refreshWidgets(gladys) {
  for (const key of Object.values(WIDGET_KEYS)) {
    gladys.requestWidgetRefresh(key);
  }
}
