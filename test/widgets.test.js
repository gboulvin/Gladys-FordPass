import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SESSION_KEY } from '../src/ford/session.js';
import { FordPassIntegration } from '../src/integration.js';
import { WIDGET_KEYS, createWidgets, refreshWidgets } from '../src/widgets.js';
import {
  BEV_VIN,
  FAST_COMMANDS,
  ICE_VIN,
  createFakeFord,
  telemetry,
  validSession,
} from './helpers.js';

const deviceId = (vin) => `ext:test-integration:vehicle:${vin}`;

async function setup() {
  const ford = createFakeFord();
  const gladys = createFakeGladys({ config: { [SESSION_KEY]: JSON.stringify(validSession()) } });
  const fordpass = new FordPassIntegration(gladys, {
    fetch: ford.fetch,
    commandPolling: FAST_COMMANDS,
  });
  fordpass.applyConfig(await gladys.getConfig());
  await fordpass.start();
  return { ford, gladys, fordpass, widgets: createWidgets(fordpass) };
}

const featureIds = (gladys, fordpass) =>
  new Set(fordpass.buildDevices().flatMap((device) => device.features.map((f) => f.external_id)));

for (const language of ['en', 'fr', 'de', 'es']) {
  test(`the vehicle overview is rendered exactly as sent (${language})`, async () => {
    const { ford, gladys, fordpass, widgets } = await setup();
    ford.telemetry[ICE_VIN] = telemetry({
      doorStatus: [{ value: 'AJAR', vehicleDoor: 'TAILGATE' }],
      tirePressureStatus: [{ value: 'LOW', vehicleWheel: 'REAR_LEFT' }],
    });
    for (const vin of [ICE_VIN, BEV_VIN]) {
      await fordpass.poll({ external_id: deviceId(vin) });
      const content = await widgets[WIDGET_KEYS.VEHICLE_OVERVIEW].get({
        settings: { vehicle: deviceId(vin) },
        language,
      });
      assert.deepEqual(validateWidgetContent(content), []);
      // Live tiles reference features the vehicle publishes.
      const ids = featureIds(gladys, fordpass);
      for (const component of content.components.filter((c) => c.device_feature)) {
        assert.ok(ids.has(component.device_feature), component.device_feature);
      }
      assert.ok(content.components.some((c) => c.type === 'status'));
      assert.ok(
        content.components.some((c) => c.link?.url.startsWith('https://www.openstreetmap.org/')),
      );
    }
  });
}

test('before the first reading and without settings, the overview explains itself', async () => {
  const { widgets } = await setup();
  const waiting = await widgets[WIDGET_KEYS.VEHICLE_OVERVIEW].get({
    settings: { vehicle: deviceId(ICE_VIN) },
  });
  assert.deepEqual(validateWidgetContent(waiting), []);
  assert.ok(
    waiting.components.some(
      (c) => c.type === 'status' && c.items[1].value.en.startsWith('Waiting'),
    ),
  );
  const unset = await widgets[WIDGET_KEYS.VEHICLE_OVERVIEW].get({ settings: {} });
  assert.deepEqual(validateWidgetContent(unset), []);
  assert.match(unset.components[0].text.fr, /Choisissez un véhicule/);
});

test('every overview button is handled and answers a short toast', async () => {
  const { widgets } = await setup();
  const widget = widgets[WIDGET_KEYS.VEHICLE_OVERVIEW];
  const content = await widget.get({ settings: { vehicle: deviceId(ICE_VIN) } });
  const buttons = content.components.filter((c) => c.type === 'button' && c.action);
  assert.deepEqual(
    buttons.map((b) => b.action.key),
    ['lock', 'unlock', 'refresh'],
  );
  for (const { action } of buttons) {
    const toast = await widget.action({
      actionKey: action.key,
      params: action.params,
      settings: {},
    });
    for (const lang of ['en', 'fr', 'de', 'es']) {
      assert.ok(toast[lang].length <= 200, lang);
    }
  }
  await assert.rejects(
    widget.action({ actionKey: 'self_destruct', params: {} }),
    /Unknown widget action/,
  );
});

test('the fleet widget lists every vehicle', async () => {
  const { fordpass, widgets } = await setup();
  await fordpass.poll({ external_id: deviceId(ICE_VIN) });
  const content = await widgets[WIDGET_KEYS.VEHICLE_FLEET].get({ settings: {}, language: 'fr' });
  assert.deepEqual(validateWidgetContent(content), []);
  const [list] = content.components;
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0].subtitle, '63 % · 512 km');
  assert.equal(list.items[0].badge.text.fr, 'Verrouillé');
});

test('without vehicles, the fleet widget says how to add some', async () => {
  const gladys = createFakeGladys();
  const widgets = createWidgets(new FordPassIntegration(gladys, { fetch: createFakeFord().fetch }));
  const content = await widgets[WIDGET_KEYS.VEHICLE_FLEET].get({});
  assert.deepEqual(validateWidgetContent(content), []);
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.values(WIDGET_KEYS));
});
