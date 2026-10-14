# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**FordPass for Gladys**: a Gladys Assistant **external integration** that
reads the data of Ford vehicles (FordPass connected services) and sends them
commands. A Node.js service (Node 22+, ESM, no build step) running in its own
sandboxed Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official
[JavaScript template](https://github.com/GladysAssistant/integration-template-js).

Cloud only (manifest `"transports": ["cloud"]`): Ford exposes no local API.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/telemetry.test.js        # one file
node --test --test-name-pattern "lock"    # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                 SDK wiring only: handlers registered before connect()
src/ford/regions.js      Ford sign-in regions (login host, locale, application id)
src/ford/auth.js         PKCE sign-in URL, redirect parsing, token exchanges and refresh
src/ford/session.js      token storage (gladys.setConfig, keys outside config_schema)
src/ford/client.js       HTTP client: garage, telemetry, commands (fetch, injectable)
src/ford/telemetry.js    raw Ford telemetry -> normalized vehicle snapshot (pure)
src/vehicle.js           device blueprint: features, states, scene events of a vehicle
src/integration.js       the runtime: vehicles cache, polling, commands, actions
src/scenes.js            scene action handlers (manifest `scene_actions`)
src/widgets.js           dashboard widget handlers (manifest `widgets`)
src/i18n.js              every user-facing text, in en / fr / de / es
src/units.js             km/mi and bar/kPa/psi conversions
src/config.js            DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
docs/{en,fr,de,es}.md    user documentation, re-hosted by Gladys (en + fr mandatory)
test/                    node --test, against the SDK's fake Gladys, fetch mocked
```

## Rules

- **External ids are forever.** A vehicle is `gladys.externalIds('vehicle', VIN)`;
  feature keys are the `FEATURE` constants of `src/vehicle.js`. Never rename
  one: Gladys keys devices, their history, scenes and dashboards on them. The
  same goes for manifest keys (`config_schema`, `actions`, `scene_triggers`,
  `scene_actions`, `widgets`) and the trigger / output / variable keys.
- **Secrets.** Never log a token, the sign-in redirect address (it carries a
  one-time code), a password. VINs and GPS positions are personal data: log
  them at `debug` level at most. Tokens are stored with `gladys.setConfig`
  under keys outside the `config_schema` (`ford_session`, `ford_pending_login`).
- **The container rootfs is read-only.** Write only under `/data`.
- **Tests never touch the network.** The Ford client takes a `fetch`
  implementation: tests pass a fake one (see `test/helpers.js`).
- **Ford's API is unofficial** and changes without notice: keep every URL,
  header and application id in `src/ford/` and every JSON path in
  `src/ford/telemetry.js`, so a breaking change is a one-file fix. Parsing is
  defensive: a missing metric is `null`, never a crash.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand — except on the README's hand-pushed tag path, which bumps all three
  together before tagging. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Four languages.** Every user-facing text exists in English, French,
  German and Spanish: manifest texts (`label`, `description`, `placeholder`,
  option labels), action / widget / connection messages (`src/i18n.js`), the
  feature names (`src/vehicle.js`) and `docs/*.md`. The tests check the
  manifest and `src/i18n.js`; keep the docs in sync by hand.
- **Manifest.** The catalog `description` holds 10 to 100 characters per
  language. `widgets`, `scene_triggers` and `scene_actions` require
  `gladys_version >=5.1.0`. `test/manifest.test.js` ties the manifest to the
  code (defaults, actions, scene and widget handlers, fired triggers): change
  both sides together.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
