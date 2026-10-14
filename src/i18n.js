// -----------------------------------------------------------------------------
// User-facing texts, in the four languages of the Gladys UI.
//
// Gladys picks the user's language out of a multi-language object
// (`{ en, fr, de, es }`, `en` mandatory) everywhere it shows a text the
// integration sends: action messages, the connection status, widget contents.
// Every text lives here so the four languages never drift apart (the tests
// check that each entry carries all of them).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const MESSAGES = {
  // --- Sign-in -----------------------------------------------------------------
  not_connected: {
    en: 'Not connected to Ford: click "Connect", then run "Complete the sign-in".',
    fr: 'Non connecté à Ford : cliquez sur « Connecter », puis lancez « Terminer la connexion ».',
    de: 'Nicht mit Ford verbunden: Klicken Sie auf „Verbinden“ und dann auf „Anmeldung abschließen“.',
    es: 'No conectado a Ford: pulse «Conectar» y luego ejecute «Completar el inicio de sesión».',
  },
  login_no_pending: {
    en: 'No sign-in in progress: click "Connect" first, then paste the address within 10 minutes.',
    fr: "Aucune connexion en cours : cliquez d'abord sur « Connecter », puis collez l'adresse sous 10 minutes.",
    de: 'Keine Anmeldung läuft: Klicken Sie zuerst auf „Verbinden“ und fügen Sie die Adresse innerhalb von 10 Minuten ein.',
    es: 'No hay ningún inicio de sesión en curso: pulse primero «Conectar» y pegue la dirección en 10 minutos.',
  },
  login_bad_url: {
    en: 'This address holds no sign-in code: copy the whole "fordapp://userauthorized/?code=…" address.',
    fr: "Cette adresse ne contient pas de code de connexion : copiez toute l'adresse « fordapp://userauthorized/?code=… ».",
    de: 'Diese Adresse enthält keinen Anmeldecode: Kopieren Sie die vollständige Adresse „fordapp://userauthorized/?code=…“.',
    es: 'Esta dirección no contiene ningún código: copie la dirección completa «fordapp://userauthorized/?code=…».',
  },
  login_success: {
    en: 'Connected to Ford: {count} vehicle(s) found. Add them from the Discovery tab.',
    fr: "Connecté à Ford : {count} véhicule(s) trouvé(s). Ajoutez-les depuis l'onglet Découverte.",
    de: 'Mit Ford verbunden: {count} Fahrzeug(e) gefunden. Fügen Sie sie im Tab „Erkennung“ hinzu.',
    es: 'Conectado a Ford: {count} vehículo(s) encontrado(s). Añádalos desde la pestaña Descubrimiento.',
  },
  login_failed: {
    en: 'Ford refused the sign-in ({reason}). Click "Connect" again: a code is only valid a few minutes.',
    fr: 'Ford a refusé la connexion ({reason}). Cliquez de nouveau sur « Connecter » : un code ne vaut que quelques minutes.',
    de: 'Ford hat die Anmeldung abgelehnt ({reason}). Klicken Sie erneut auf „Verbinden“: Ein Code gilt nur wenige Minuten.',
    es: 'Ford rechazó el inicio de sesión ({reason}). Pulse de nuevo «Conectar»: un código solo es válido unos minutos.',
  },
  session_expired: {
    en: 'The Ford session expired: click "Connect" and complete the sign-in again.',
    fr: 'La session Ford a expiré : cliquez sur « Connecter » et terminez à nouveau la connexion.',
    de: 'Die Ford-Sitzung ist abgelaufen: Klicken Sie auf „Verbinden“ und schließen Sie die Anmeldung erneut ab.',
    es: 'La sesión de Ford ha caducado: pulse «Conectar» y complete de nuevo el inicio de sesión.',
  },
  ford_unreachable: {
    en: 'Ford servers unreachable, retrying at the next refresh.',
    fr: 'Serveurs Ford injoignables, nouvel essai au prochain rafraîchissement.',
    de: 'Ford-Server nicht erreichbar, neuer Versuch bei der nächsten Aktualisierung.',
    es: 'Servidores de Ford inaccesibles, se reintentará en la próxima actualización.',
  },
  logout_done: {
    en: 'Disconnected from Ford: the tokens were deleted. Your vehicles stay in Gladys.',
    fr: 'Déconnecté de Ford : les jetons ont été supprimés. Vos véhicules restent dans Gladys.',
    de: 'Von Ford abgemeldet: Die Tokens wurden gelöscht. Ihre Fahrzeuge bleiben in Gladys.',
    es: 'Desconectado de Ford: se han borrado los tokens. Sus vehículos permanecen en Gladys.',
  },
  test_ok: {
    en: 'Ford connection OK: {vehicles}.',
    fr: 'Connexion Ford OK : {vehicles}.',
    de: 'Ford-Verbindung OK: {vehicles}.',
    es: 'Conexión con Ford correcta: {vehicles}.',
  },
  test_no_vehicle: {
    en: 'Connected, but no vehicle is linked to this FordPass account.',
    fr: "Connecté, mais aucun véhicule n'est associé à ce compte FordPass.",
    de: 'Verbunden, aber mit diesem FordPass-Konto ist kein Fahrzeug verknüpft.',
    es: 'Conectado, pero no hay ningún vehículo asociado a esta cuenta FordPass.',
  },

  // --- Commands ----------------------------------------------------------------
  command_sent: {
    en: '{vehicle}: "{command}" done.',
    fr: '{vehicle} : « {command} » effectué.',
    de: '{vehicle}: „{command}“ ausgeführt.',
    es: '{vehicle}: «{command}» realizado.',
  },
  command_failed: {
    en: '{vehicle}: "{command}" failed ({reason}).',
    fr: '{vehicle} : « {command} » a échoué ({reason}).',
    de: '{vehicle}: „{command}“ fehlgeschlagen ({reason}).',
    es: '{vehicle}: «{command}» ha fallado ({reason}).',
  },
  unknown_vehicle: {
    en: 'Unknown vehicle: add it from the Discovery tab first.',
    fr: "Véhicule inconnu : ajoutez-le d'abord depuis l'onglet Découverte.",
    de: 'Unbekanntes Fahrzeug: Fügen Sie es zuerst im Tab „Erkennung“ hinzu.',
    es: 'Vehículo desconocido: añádalo primero desde la pestaña Descubrimiento.',
  },
  refresh_done: {
    en: '{vehicle}: data refreshed.',
    fr: '{vehicle} : données actualisées.',
    de: '{vehicle}: Daten aktualisiert.',
    es: '{vehicle}: datos actualizados.',
  },
};

// Labels of the vehicle commands, shared by the action messages and the widget.
export const COMMAND_LABELS = {
  lock: { en: 'Lock', fr: 'Verrouiller', de: 'Verriegeln', es: 'Bloquear' },
  unlock: { en: 'Unlock', fr: 'Déverrouiller', de: 'Entriegeln', es: 'Desbloquear' },
  remote_start: {
    en: 'Remote start',
    fr: 'Démarrage à distance',
    de: 'Fernstart',
    es: 'Arranque remoto',
  },
  cancel_remote_start: {
    en: 'Stop remote start',
    fr: 'Arrêt du démarrage',
    de: 'Fernstart stoppen',
    es: 'Detener arranque',
  },
  start_charge: {
    en: 'Start charging',
    fr: 'Lancer la charge',
    de: 'Laden starten',
    es: 'Iniciar carga',
  },
  stop_charge: {
    en: 'Stop charging',
    fr: 'Arrêter la charge',
    de: 'Laden stoppen',
    es: 'Detener carga',
  },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
};

/**
 * Build a multi-language text from a MESSAGES entry, `{name}` placeholders
 * replaced by `vars`. A var may itself be a multi-language object (a command
 * label): each language then gets its own translation.
 * @param {keyof MESSAGES} key
 * @param {Record<string, unknown>} vars
 * @returns {Record<string, string>}
 */
export function message(key, vars = {}) {
  const entry = MESSAGES[key];
  if (!entry) {
    throw new Error(`Unknown message: ${key}`);
  }
  return Object.fromEntries(
    LANGUAGES.map((lang) => [
      lang,
      entry[lang].replace(/\{(\w+)\}/g, (match, name) => {
        const value = vars[name];
        if (value === undefined || value === null) {
          return match;
        }
        return typeof value === 'object' ? (value[lang] ?? value.en) : String(value);
      }),
    ]),
  );
}

/**
 * The text of one language out of a multi-language object, English otherwise.
 * @param {Record<string, string> | string} text
 * @param {string} language
 */
export function pick(text, language) {
  if (typeof text === 'string') {
    return text;
  }
  return text[language] ?? text.en;
}
