// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store validator checks the manifest shape; only these tests know which
// handlers the code registers and which triggers it fires.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { DEFAULT_CONFIG } from '../src/config.js';
import { COMMANDS } from '../src/ford/client.js';
import { REGIONS } from '../src/ford/regions.js';
import { LANGUAGES } from '../src/i18n.js';
import { FordPassIntegration } from '../src/integration.js';
import { createSceneActions, statusOutputs } from '../src/scenes.js';
import { parseTelemetry } from '../src/ford/telemetry.js';
import { SCENE_TRIGGERS } from '../src/vehicle.js';
import { createWidgets } from '../src/widgets.js';
import { telemetry } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

const fordpass = new FordPassIntegration(createFakeGladys(), { fetch: async () => {} });
const SCENE_ACTIONS = createSceneActions(fordpass);
const WIDGETS = createWidgets(fordpass);

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every multi-language text of the manifest, with its path.
function* texts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    for (const [i, child] of node.entries()) {
      yield* texts(child, `${path}[${i}]`);
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (['label', 'description', 'placeholder'].includes(key) && typeof value === 'object') {
        yield { path: `${path}.${key}`, value };
      } else {
        yield* texts(value, `${path}.${key}`);
      }
    }
  }
}

test('every manifest text exists in English, French, German and Spanish', () => {
  let count = 0;
  for (const { path, value } of texts(manifest)) {
    count += 1;
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), path);
    for (const lang of LANGUAGES) {
      assert.ok(value[lang].trim().length > 0, `${path}.${lang}`);
    }
  }
  assert.ok(count > 100);
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('the integration is cloud only', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/gboulvin/gladys-fordpass:${manifest.version}`);
});

test('scene capabilities, widgets and catalog keywords require Gladys >= 5.3.0', () => {
  assert.match(manifest.gladys_version, /^>=5\.3\.0/);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('every region option is a known region, and the other way round', () => {
  const field = manifest.config_schema.find((f) => f.key === 'region');
  assert.deepEqual(field.options.map((o) => o.value).sort(), Object.keys(REGIONS).sort());
});

test('the sign-in is an account_link field (Ford never redirects back)', () => {
  const field = manifest.config_schema.find((f) => f.key === 'ford_account');
  assert.equal(field.type, 'account_link');
  assert.match(indexSource, /onOAuthAuthorizeUrl/);
});

test('every manifest action has a handler in index.js', () => {
  for (const key of keysOf(manifest.actions)) {
    assert.match(indexSource, new RegExp(`onAction\\('${key}'`), key);
  }
});

test('every scene_actions key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('the vehicle_command options are the client commands', () => {
  const action = manifest.scene_actions.find((a) => a.key === 'vehicle_command');
  const options = action.fields.find((f) => f.key === 'command').options.map((o) => o.value);
  assert.deepEqual(options.sort(), Object.keys(COMMANDS).sort());
});

test('the vehicle_status outputs are declared', () => {
  const action = manifest.scene_actions.find((a) => a.key === 'vehicle_status');
  const declared = keysOf(action.outputs);
  for (const key of Object.keys(statusOutputs(parseTelemetry(telemetry()), DEFAULT_CONFIG))) {
    assert.ok(declared.includes(key), key);
  }
});

test('every widgets key has a content handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
});

test('every scene trigger the code fires is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(SCENE_TRIGGERS).sort());
});

test('dynamic selects declare a source and no static options', () => {
  const fields = [
    ...manifest.config_schema,
    ...[...manifest.actions, ...manifest.scene_triggers, ...manifest.scene_actions].flatMap(
      (i) => i.fields ?? [],
    ),
    ...manifest.widgets.flatMap((w) => w.settings ?? []),
  ];
  for (const field of fields.filter((f) => f.source)) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, field.key);
  }
});

test('section fields store no value', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.default, undefined);
    assert.equal(section.required, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});
