// -----------------------------------------------------------------------------
// Entry point of the FordPass integration for Gladys Assistant.
//
// Wiring only: the SDK events are routed to the runtime (src/integration.js),
// which holds the vehicles and talks to Ford. Handlers are registered BEFORE
// connect().
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR
// The SDK reads them: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { FordPassIntegration } from './src/integration.js';
import { createSceneActions } from './src/scenes.js';
import { createWidgets, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();
const fordpass = new FordPassIntegration(gladys, {
  // Every new snapshot changes the computed rows of the widgets.
  onSnapshot: () => refreshWidgets(gladys),
});

// --- Discovery -----------------------------------------------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> reloading the vehicles of the Ford account');
  if (!fordpass.isConnected()) {
    await fordpass.start();
    return;
  }
  await fordpass.loadVehicles();
  await fordpass.publishDevices();
});

// --- Polling: Gladys polls every vehicle once a minute, the runtime reads it
// at the interval the user chose ------------------------------------------------
gladys.onPoll(async (device) => {
  if (!(await fordpass.poll(device))) {
    logger.debug('onPoll skipped (not due)');
  }
});

// --- Commands: lock, remote start, charge features ------------------------------
gladys.onSetValue((device, feature, value) => fordpass.setValue(device, feature, value));

// --- Sign-in: the "Connect" button of the `ford_account` field ------------------
// An `account_link` field: Ford redirects to its mobile app, never back to
// Gladys, so `redirectUri` is undefined and no callback comes. The user pastes
// the final address into the `complete_login` action.
gladys.onOAuthAuthorizeUrl(() => fordpass.getAuthorizeUrl());

// --- Manifest actions (Configuration screen buttons) ----------------------------
gladys.onAction('complete_login', (fields) => fordpass.completeLogin(fields.redirect_url));
gladys.onAction('test_connection', () => fordpass.testConnection());
gladys.onAction('logout', () => fordpass.logout());

// --- Scene actions (Gladys 5.1+) ---------------------------------------------------
for (const [key, handler] of Object.entries(createSceneActions(fordpass))) {
  gladys.onSceneAction(key, handler);
}

// --- Dashboard widgets (Gladys 5.1+) -----------------------------------------------
for (const [key, widget] of Object.entries(createWidgets(fordpass))) {
  gladys.onWidgetGet(key, (request) => widget.get(request));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
      widget.action({ actionKey, params, settings }),
    );
  }
}

// --- Configuration updated by the user (or by the session storage) -------------
gladys.onConfigUpdated(async (newConfig) => {
  const reshaped = fordpass.applyConfig(newConfig);
  // The session keys are written by the integration itself: only a change of
  // units, names or region needs the devices re-published.
  if (reshaped && fordpass.isConnected()) {
    logger.info('Configuration changed -> re-publishing the vehicles');
    await fordpass.start();
  }
  refreshWidgets(gladys);
});

// --- Connection lifecycle ------------------------------------------------------------
gladys.on('connected', async () => {
  try {
    fordpass.applyConfig(await gladys.getConfig());
    await fordpass.start();
    // Nudges sent while the socket was down were dropped: re-sync dashboards.
    refreshWidgets(gladys);
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Initialisierung fehlgeschlagen, prüfen Sie die Logs der Integration.',
        es: 'La inicialización ha fallado, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

logger.info('Starting the FordPass integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
