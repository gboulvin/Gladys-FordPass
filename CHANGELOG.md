# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

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

[Unreleased]: https://github.com/gboulvin/FordPass/commits/main
