import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';
import { LANGUAGES, MESSAGES, message, pick } from '../src/i18n.js';
import { convertDistance, convertPressure } from '../src/units.js';

test('an empty config gives the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('form values are typed, clamped and checked', () => {
  const config = normalizeConfig({
    poll_frequency: '30',
    low_level_threshold: '20',
    distance_unit: 'furlong',
    region: 'deu',
    names_language: 'it',
  });
  assert.equal(config.poll_frequency, 60);
  assert.equal(config.low_level_threshold, 20);
  assert.equal(config.distance_unit, 'km');
  assert.equal(config.region, 'deu');
  assert.equal(config.names_language, 'en');
  assert.equal(normalizeConfig({ poll_frequency: null }).poll_frequency, 300);
});

test('every message exists in the four languages, with the same placeholders', () => {
  for (const [key, entry] of Object.entries(MESSAGES)) {
    const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    for (const lang of LANGUAGES) {
      assert.ok(entry[lang], `${key}.${lang}`);
      assert.equal(placeholders(entry[lang]), placeholders(entry.en), `${key}.${lang}`);
    }
  }
});

test('message() fills placeholders, translating multi-language values', () => {
  const text = message('command_sent', {
    vehicle: 'Kuga',
    command: { en: 'Lock', fr: 'Verrouiller' },
  });
  assert.equal(text.en, 'Kuga: "Lock" done.');
  assert.equal(text.fr, 'Kuga : « Verrouiller » effectué.');
  // A missing translation of the value falls back to English.
  assert.equal(text.de, 'Kuga: „Lock“ ausgeführt.');
  assert.throws(() => message('nope'), /Unknown message/);
  assert.equal(pick(text, 'es'), text.es);
  assert.equal(pick(text, 'it'), text.en);
});

test('units are converted from Ford metric values', () => {
  assert.equal(convertDistance(160.9344, 'mi'), 100);
  assert.equal(convertDistance(100.4, 'km'), 100);
  assert.equal(convertDistance(null, 'km'), null);
  assert.equal(convertPressure(240, 'bar'), 2.4);
  assert.equal(convertPressure(240, 'psi'), 34.8);
  assert.equal(convertPressure(240.4, 'kpa'), 240);
});
