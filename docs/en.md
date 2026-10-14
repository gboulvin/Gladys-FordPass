# FordPass

Brings your Ford vehicles into Gladys: fuel or battery level, range, odometer,
locks, alarm, doors and windows, tire pressures, position, and the remote
commands of the FordPass app (lock, unlock, remote start, charging).

> This integration uses the same servers as the FordPass mobile app. Ford
> offers no public API for it: Ford can change it at any time, and the
> integration may then need an update.

## What you need

- A FordPass account with your vehicle(s) added and **activated** in the
  FordPass app (the connected services must be switched on).
- A computer with a desktop browser (Chrome, Edge, Firefox...) for the
  one-time sign-in.

## Connect your account

Ford signs you in on its own page and then tries to open the FordPass app.
A browser cannot open the app, so you copy the final address by hand. It
takes two minutes, once.

1. In Gladys, open the integration's **Configuration** tab and pick the
   **region** your FordPass account belongs to. Save.
2. Open your browser's **developer tools** (`F12`, or `Ctrl+Shift+I` /
   `Cmd+Option+I` on a Mac) and select the **Network** tab. Keep it open.
3. Click **Connect** next to _Ford account_. Ford's sign-in page opens: sign
   in with your FordPass email and password (and the code Ford sends, if
   asked).
4. The page then seems to load forever: that is expected. In the **Network**
   tab, find the request whose address starts with
   `fordapp://userauthorized/?code=` (type `code=` in the filter box). Right
   click it → **Copy** → **Copy URL**. In Firefox, the address may show in
   the console as an error ("prevented from opening") instead: copy it
   from there.
5. Back in Gladys, run the **Complete the sign-in** action and paste the
   address. Do it right away: the code is only valid a few minutes, and the
   sign-in must be completed within 10 minutes of the click on **Connect**.
6. The answer lists the vehicles found. Open the **Discovery** tab and add
   them.

Your password never reaches Gladys: the integration only receives a one-time
code, exchanged for tokens stored in the integration's configuration. Ford
keeps the session alive for months; if it expires (password changed, too
long without use), the Configuration screen says so: repeat the steps above.

## The vehicle in Gladys

Each vehicle is one device. Its features depend on its engine:

| Feature                                    | Petrol / diesel / hybrid | Electric / plug-in hybrid |
| ------------------------------------------ | :----------------------: | :-----------------------: |
| Odometer                                   |            ✓             |             ✓             |
| Fuel level, fuel range                     |            ✓             |  ✓ (plug-in hybrid only)  |
| Battery charge, electric range             |                          |             ✓             |
| Charging (controllable), plugged in, power |                          |             ✓             |
| 12 V battery                               |            ✓             |             ✓             |
| Door lock (controllable)                   |            ✓             |             ✓             |
| Alarm armed                                |            ✓             |             ✓             |
| Door open, window open                     |            ✓             |             ✓             |
| Remote start (controllable)                |            ✓             |             ✓             |
| Oil life                                   |            ✓             |  ✓ (plug-in hybrid only)  |
| Outside temperature                        |            ✓             |             ✓             |
| Pressure of each tire                      |            ✓             |             ✓             |

A value your vehicle does not report simply stays empty.

The **door lock** feature locks (on) and unlocks (off) the vehicle, **remote
start** starts the engine or the climate pre-conditioning (on) or stops it
(off), **charging** starts or stops the charge. Ford relays a command to the
car in 10 to 60 seconds; the feature then shows the state the car confirmed.

## Settings

- **Refresh interval**: how often each vehicle is read (5 minutes by default,
  1 minute at least). Reading only fetches what Ford's servers already know:
  it never wakes the car up nor drains its battery. The car itself sends new
  values when it is driven, locked, charged...
- **Distance unit** and **tire pressure unit**.
- **Low fuel / battery threshold**: the level that fires the _Low fuel or
  battery_ scene trigger (15 % by default).
- **Language of the feature names**: English, French, German or Spanish,
  applied when a vehicle is added to Gladys.

## Actions

- **Complete the sign-in** — see above.
- **Test the connection** — lists the vehicles of the account.
- **Disconnect from Ford** — deletes the stored tokens. The vehicles stay in
  Gladys with their history.

## Scenes

The integration adds its own cards to the scene editor (Gladys 5.1 or later).

Triggers:

- **Low fuel or battery** — the level went under the configured threshold.
  Filter on the vehicle and on the energy (fuel, battery). Variables:
  `{{triggerEvent.data.energy}}`, `{{triggerEvent.data.level}}`.
- **Alarm triggered** — the anti-theft alarm went off. Variables: the
  `latitude` and `longitude` of the vehicle.
- **Tire pressure warning** — a wheel was flagged by the tire pressure
  monitoring. Variables: `wheel` (e.g. `rear_left`), `pressure`.
- **Charging finished** — an electric or plug-in hybrid vehicle stopped
  charging. Variables: `level`, `range`.
- **Ignition switched on or off** — start or end of a trip. Filter on _Switched
  on_ / _Switched off_. Variables: `state`, `odometer`.

The device features also work with the standard _A device changes state_
trigger (e.g. "door lock goes to 0").

Actions:

- **Send a command to a Ford vehicle** — lock, unlock, remote start, stop
  remote start, start or stop charging, or refresh the data (this one wakes
  the vehicle up: limited to 24 per day). Outputs: `success` and `status`, so
  the next actions can check that the car obeyed.
- **Read a Ford vehicle's status** — the last values known by Ford, usable by
  the next actions: `odometer`, `fuel_level`, `battery_level`, `range`,
  `locked`, `doors_open`, `windows_open`, `charging`, `latitude`,
  `longitude`.

Example: _every evening at 10 pm → read the vehicle's status → if `locked` is
false → send the "Lock" command and a notification_.

## Dashboard

- **Ford vehicle** — pick a vehicle: live energy, range and odometer, the
  state of the locks, alarm, doors, windows, tires and charge, the time of
  the last update, and buttons to lock, unlock (with a confirmation), refresh
  and open the position on a map.
- **Ford vehicles** — every vehicle of the account with its level, range,
  lock state and a map link.

## Troubleshooting

- **"Ford refused the sign-in"**: the code expired or was already used. Click
  **Connect** again and paste the new address right away. Check the region.
- **"No sign-in in progress"**: more than 10 minutes passed since the click on
  **Connect**: click it again.
- **No vehicle found**: the vehicle must be added and activated in the
  FordPass app with the same account.
- **"Vehicle not authorized"** in the logs: accept the connected services
  again in the FordPass app.
- **A command fails**: the vehicle may be in deep sleep (left unused for
  days, low 12 V battery), out of mobile coverage, or refuse the command
  (remote start with a door open, alarm...). The widget shows "Commands
  paused" during a deep sleep.
- **Values do not move**: the car only sends new values when it is used; run
  _Refresh_ from the widget to ask it for fresh ones.

The logs of the integration (Gladys → Integrations → FordPass) never contain
your tokens nor your password.
