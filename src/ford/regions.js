// -----------------------------------------------------------------------------
// Ford sign-in regions.
//
// A FordPass account belongs to one region: the sign-in host, the locale and
// the application id must match it, or Ford refuses the token exchange. The
// values mirror the FordPass mobile app (Ford exposes no public API).
// -----------------------------------------------------------------------------

const APP_IDS = {
  europe: '667D773E-1BDC-4139-8AD0-2B16474E8DC7',
  north_america: 'BFE8C5ED-D687-4C19-A5DD-F92CDFC4503A',
};

// Keys are stored in the user config (`region`): never rename one.
export const REGIONS = {
  fra: {
    loginUrl: 'https://login.ford.com',
    locale: 'fr-FR',
    countryCode: 'FRA',
    appId: APP_IDS.europe,
  },
  deu: {
    loginUrl: 'https://login.ford.de',
    locale: 'de-DE',
    countryCode: 'DEU',
    appId: APP_IDS.europe,
  },
  esp: {
    loginUrl: 'https://login.ford.com',
    locale: 'es-ES',
    countryCode: 'ESP',
    appId: APP_IDS.europe,
  },
  ita: {
    loginUrl: 'https://login.ford.com',
    locale: 'it-IT',
    countryCode: 'ITA',
    appId: APP_IDS.europe,
  },
  nld: {
    loginUrl: 'https://login.ford.com',
    locale: 'nl-NL',
    countryCode: 'NLD',
    appId: APP_IDS.europe,
  },
  gbr: {
    loginUrl: 'https://login.ford.co.uk',
    locale: 'en-GB',
    countryCode: 'GBR',
    appId: APP_IDS.europe,
  },
  rest_of_europe: {
    loginUrl: 'https://login.ford.com',
    locale: 'en-GB',
    countryCode: 'GBR',
    appId: APP_IDS.europe,
  },
  usa: {
    loginUrl: 'https://login.ford.com',
    locale: 'en-US',
    countryCode: 'USA',
    appId: APP_IDS.north_america,
  },
  can: {
    loginUrl: 'https://login.ford.com',
    locale: 'en-CA',
    countryCode: 'CAN',
    appId: APP_IDS.north_america,
  },
};

export const DEFAULT_REGION = 'fra';

export function getRegion(key) {
  return REGIONS[key] ?? REGIONS[DEFAULT_REGION];
}
