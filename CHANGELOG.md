# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.1.0] - 2026-10-26

### Changed

- Requires Gladys 5.3.0 or later: the manifest declares search keywords for
  the new catalog of Gladys 5.3. Listed under the **Vehicles & EV charging** catalog category.
- Integration SDK 0.16.

## [1.0.5] - 2026-10-23

## [1.0.4] - 2026-10-22

### Security

- `brace-expansion`, pulled in by ESLint, raised to 5.0.12 against the
  high-severity denial-of-service advisories (GHSA-mh99-v99m-4gvg and
  related). A development tool only: the published image never shipped it.
- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [1.0.3] - 2026-10-14

### Changed

- Sign-in guide (documentation and configuration screen) updated for Ford's
  two-factor authentication: open the sign-in address in a tab whose
  developer tools record with "Preserve log" ticked, then copy the red
  `fordapp://userauthorized/?code=` request.

## [1.0.2] - 2026-10-14

## [1.0.1] - 2026-10-14

### Changed

- The project moved to https://github.com/gboulvin/Gladys-FordPass: the
  Docker image is now `ghcr.io/gboulvin/gladys-fordpass`.

## [1.0.0] - 2026-10-14

### Added

- Sign-in to a FordPass account on Ford's own page (OAuth2 + PKCE, the
  password never reaches Gladys), for France, Germany, Spain, Italy, the
  Netherlands, the United Kingdom, the rest of Europe, the United States and
  Canada.
- One Gladys device per vehicle of the account, with the features of its
  engine: odometer, fuel level and range, battery charge and electric range,
  charging and plug state, charging power, 12 V battery, door lock, alarm,
  open doors and windows, remote start, oil life, outside temperature and the
  pressure of each tire.
- Commands from the device features: lock / unlock, remote start / stop,
  start / stop charging.
- Scene triggers: low fuel or battery, alarm triggered, tire pressure
  warning, charging finished, ignition switched on or off.
- Scene actions: send a command to a vehicle (with its outcome), read a
  vehicle's status for the next actions of the scene.
- Dashboard widgets: one vehicle (live energy, range and odometer, status,
  lock / unlock / refresh buttons, map link) and the fleet of the account.
- Configuration actions: complete the sign-in, test the connection,
  disconnect from Ford.
- Choice of the refresh interval, distance unit (km / mi), tire pressure unit
  (bar / kPa / psi), low level threshold and language of the feature names.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.0.5...v1.1.0
[1.0.5]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/gboulvin/Gladys-FordPass/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/gboulvin/Gladys-FordPass/releases/tag/v1.0.0
