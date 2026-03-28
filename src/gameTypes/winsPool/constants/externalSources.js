// src/gameTypes/winsPool/constants/externalSources.js

/**
 * ESPN configuration for supported leagues.
 * Each league provides a standings endpoint and mapping helpers.
 */
export const ESPN_LEAGUE_CONFIG = {
  NBA: {
    standingsUrl: 'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings',
    params: {
      region: 'us',
      lang: 'en'
    },
    // Abbreviation overrides where ESPN deviates from standard team IDs
    abbreviationOverrides: {
      NOP: ['NO', 'NOP'],
      SAS: ['SA', 'SAS'],
      GSW: ['GS', 'GSW'],
      NYK: ['NY', 'NYK'],
      LAL: ['LAL', 'LA'],
      LAC: ['LAC', 'LAC'],
      UTA: ['UTAH', 'UTA']
    }
  },
  NFL: {
    standingsUrl: 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings',
    params: {
      region: 'us',
      lang: 'en'
    },
    // ESPN uses the same abbreviations for most teams, but a few wrap city names differently
    abbreviationOverrides: {
      ARI: ['ARI', 'ARZ', 'ARZ'],
      LAR: ['LAR', 'LA'],
      LAC: ['LAC', 'LAC'],
      LV: ['LV', 'OAK', 'RAI'],
      NE: ['NE', 'NWE'],
      NO: ['NO', 'NOR'],
      SF: ['SF', 'SFO'],
      TB: ['TB', 'TAM'],
      WAS: ['WSH', 'WAS']
    }
  }
};

/**
 * Supported league keys in uppercase form.
 */
export const SUPPORTED_ESPN_LEAGUES = Object.keys(ESPN_LEAGUE_CONFIG);
