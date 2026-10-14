# FordPass

Bringt Ihre Ford-Fahrzeuge in Gladys: Tank- oder Akkustand, Reichweite,
Kilometerstand, Verriegelung, Alarmanlage, Türen und Fenster, Reifendruck,
Position und die Fernbefehle der FordPass-App (verriegeln, entriegeln,
Fernstart, Laden).

> Diese Integration nutzt dieselben Server wie die FordPass-App. Ford bietet
> dafür keine öffentliche API an: Ford kann sie jederzeit ändern, und die
> Integration braucht dann eventuell ein Update.

## Voraussetzungen

- Ein FordPass-Konto, in dem Ihre Fahrzeuge hinzugefügt und **aktiviert**
  sind (die vernetzten Dienste müssen eingeschaltet sein).
- Ein Computer mit Desktop-Browser (Chrome, Edge, Firefox…) für die einmalige
  Anmeldung.

## Konto verbinden

Ford meldet Sie auf seiner eigenen Seite an und versucht dann, die
FordPass-App zu öffnen. Ein Browser kann die App nicht öffnen, deshalb
kopieren Sie die letzte Adresse von Hand. Das dauert zwei Minuten, einmalig.

1. Öffnen Sie in Gladys den Tab **Konfiguration** der Integration und wählen
   Sie die **Region** Ihres FordPass-Kontos. Speichern.
2. Öffnen Sie die **Entwicklertools** des Browsers (`F12`, oder
   `Strg+Umschalt+I` / `Cmd+Option+I` auf dem Mac) und wählen Sie den Tab
   **Netzwerk**. Lassen Sie ihn geöffnet.
3. Klicken Sie neben _Ford-Konto_ auf **Verbinden**. Die Ford-Anmeldeseite
   öffnet sich: Melden Sie sich mit der E-Mail-Adresse und dem Passwort Ihres
   FordPass-Kontos an (und dem Code, den Ford schickt, falls verlangt).
4. Die Seite scheint dann endlos zu laden: Das ist normal. Suchen Sie im Tab
   **Netzwerk** die Anfrage, deren Adresse mit
   `fordapp://userauthorized/?code=` beginnt (geben Sie `code=` in das
   Filterfeld ein). Rechtsklick → **Kopieren** → **URL kopieren**. In Firefox
   erscheint die Adresse eventuell stattdessen in der Konsole als Fehler
   („Öffnen verhindert“): Kopieren Sie sie von dort.
5. Führen Sie in Gladys die Aktion **Anmeldung abschließen** aus und fügen
   Sie die Adresse ein. Sofort: Der Code ist nur wenige Minuten gültig, und
   die Anmeldung muss innerhalb von 10 Minuten nach dem Klick auf
   **Verbinden** abgeschlossen sein.
6. Die Antwort listet die gefundenen Fahrzeuge auf. Öffnen Sie den Tab
   **Erkennung** und fügen Sie sie hinzu.

Ihr Passwort erreicht Gladys nie: Die Integration erhält nur einen
Einmalcode, der gegen Tokens getauscht wird, die in der Konfiguration der
Integration gespeichert sind. Ford hält die Sitzung monatelang aufrecht; läuft
sie ab (Passwort geändert, zu lange unbenutzt), zeigt der
Konfigurationsbildschirm es an: Wiederholen Sie die Schritte oben.

## Das Fahrzeug in Gladys

Jedes Fahrzeug ist ein Gerät. Seine Funktionen hängen vom Antrieb ab:

| Funktion                                      | Benzin / Diesel / Hybrid | Elektro / Plug-in-Hybrid |
| --------------------------------------------- | :----------------------: | :----------------------: |
| Kilometerstand                                |            ✓             |            ✓             |
| Tankfüllstand, Reichweite (Kraftstoff)        |            ✓             |  ✓ (nur Plug-in-Hybrid)  |
| Akkustand, elektrische Reichweite             |                          |            ✓             |
| Ladevorgang (steuerbar), angesteckt, Leistung |                          |            ✓             |
| 12-V-Batterie                                 |            ✓             |            ✓             |
| Zentralverriegelung (steuerbar)               |            ✓             |            ✓             |
| Alarmanlage scharf                            |            ✓             |            ✓             |
| Tür offen, Fenster offen                      |            ✓             |            ✓             |
| Fernstart (steuerbar)                         |            ✓             |            ✓             |
| Öl-Restlebensdauer                            |            ✓             |  ✓ (nur Plug-in-Hybrid)  |
| Außentemperatur                               |            ✓             |            ✓             |
| Druck jedes Reifens                           |            ✓             |            ✓             |

Ein Wert, den Ihr Fahrzeug nicht meldet, bleibt einfach leer.

Die Funktion **Zentralverriegelung** verriegelt (ein) und entriegelt (aus)
das Fahrzeug, **Fernstart** startet den Motor bzw. die Vorklimatisierung (ein)
oder stoppt sie (aus), **Ladevorgang** startet oder stoppt das Laden. Ford
leitet einen Befehl in 10 bis 60 Sekunden an das Auto weiter; die Funktion
zeigt danach den vom Auto bestätigten Zustand.

## Einstellungen

- **Aktualisierungsintervall**: wie oft jedes Fahrzeug gelesen wird
  (standardmäßig 5 Minuten, mindestens 1 Minute). Das Lesen holt nur, was die
  Ford-Server schon kennen: Es weckt das Auto nie auf und entlädt seine
  Batterie nicht. Das Auto schickt selbst neue Werte, wenn es fährt,
  verriegelt wird, lädt…
- **Entfernungseinheit** und **Einheit des Reifendrucks**.
- **Schwelle niedriger Tank / Akku**: der Wert, der den Szenen-Auslöser
  _Tank oder Akku niedrig_ auslöst (standardmäßig 15 %).
- **Sprache der Funktionsnamen**: Englisch, Französisch, Deutsch oder
  Spanisch, angewendet beim Hinzufügen eines Fahrzeugs.

## Aktionen

- **Anmeldung abschließen** — siehe oben.
- **Verbindung testen** — listet die Fahrzeuge des Kontos auf.
- **Von Ford abmelden** — löscht die gespeicherten Tokens. Die Fahrzeuge
  bleiben mit ihrem Verlauf in Gladys.

## Szenen

Die Integration fügt dem Szenen-Editor eigene Karten hinzu (Gladys 5.1 oder
neuer).

Auslöser:

- **Tank oder Akku niedrig** — der Stand ist unter die eingestellte Schwelle
  gefallen. Filter: Fahrzeug und Energie (Kraftstoff, Akku). Variablen:
  `{{triggerEvent.data.energy}}`, `{{triggerEvent.data.level}}`.
- **Alarm ausgelöst** — die Diebstahlwarnanlage wurde ausgelöst. Variablen:
  `latitude` und `longitude` des Fahrzeugs.
- **Reifendruckwarnung** — die Reifendruckkontrolle hat ein Rad gemeldet.
  Variablen: `wheel` (z. B. `rear_left`), `pressure`.
- **Laden beendet** — ein Elektro- oder Plug-in-Hybridfahrzeug hat das Laden
  beendet. Variablen: `level`, `range`.
- **Zündung ein- oder ausgeschaltet** — Beginn oder Ende einer Fahrt. Filter:
  _Eingeschaltet_ / _Ausgeschaltet_. Variablen: `state`, `odometer`.

Die Gerätefunktionen funktionieren auch mit dem Standard-Auslöser _Ein Gerät
ändert seinen Zustand_ (z. B. „Zentralverriegelung wechselt auf 0“).

Aktionen:

- **Befehl an ein Ford-Fahrzeug senden** — verriegeln, entriegeln, Fernstart,
  Fernstart stoppen, Laden starten oder stoppen oder Daten aktualisieren
  (Letzteres weckt das Fahrzeug auf: begrenzt auf 24 pro Tag). Ausgaben:
  `success` und `status`, damit die nächsten Aktionen prüfen können, ob das
  Auto gehorcht hat.
- **Status eines Ford-Fahrzeugs lesen** — die letzten bei Ford bekannten
  Werte für die nächsten Aktionen: `odometer`, `fuel_level`,
  `battery_level`, `range`, `locked`, `doors_open`, `windows_open`,
  `charging`, `latitude`, `longitude`.

Beispiel: _jeden Abend um 22 Uhr → Status des Fahrzeugs lesen → wenn `locked`
falsch ist → Befehl „Verriegeln“ senden und benachrichtigen_.

## Dashboard

- **Ford-Fahrzeug** — wählen Sie ein Fahrzeug: Energie, Reichweite und
  Kilometerstand live, der Zustand von Verriegelung, Alarm, Türen, Fenstern,
  Reifen und Ladung, die Zeit der letzten Aktualisierung, und Schaltflächen
  zum Verriegeln, Entriegeln (mit Bestätigung), Aktualisieren und Öffnen der
  Position auf einer Karte.
- **Ford-Fahrzeuge** — alle Fahrzeuge des Kontos mit Stand, Reichweite,
  Verriegelung und einem Kartenlink.

## Fehlerbehebung

- **„Ford hat die Anmeldung abgelehnt“**: Der Code ist abgelaufen oder wurde
  schon benutzt. Klicken Sie erneut auf **Verbinden** und fügen Sie die neue
  Adresse sofort ein. Prüfen Sie die Region.
- **„Keine Anmeldung läuft“**: Seit dem Klick auf **Verbinden** sind mehr als
  10 Minuten vergangen: Klicken Sie erneut.
- **Kein Fahrzeug gefunden**: Das Fahrzeug muss mit demselben Konto in der
  FordPass-App hinzugefügt und aktiviert sein.
- **„Vehicle not authorized“** in den Logs: Akzeptieren Sie die vernetzten
  Dienste erneut in der FordPass-App.
- **Ein Befehl schlägt fehl**: Das Fahrzeug ist vielleicht im Tiefschlaf
  (tagelang unbenutzt, schwache 12-V-Batterie), ohne Mobilfunkempfang, oder
  verweigert den Befehl (Fernstart bei offener Tür, Alarm…). Das Widget zeigt
  „Befehle pausiert“ während des Tiefschlafs.
- **Die Werte ändern sich nicht**: Das Auto schickt neue Werte nur bei
  Benutzung; lösen Sie im Widget _Aktualisieren_ aus, um neue anzufordern.

Die Logs der Integration (Gladys → Integrationen → FordPass) enthalten nie
Ihre Tokens oder Ihr Passwort.
