import { ROUND_KEYS } from '../constants/playoffConstants';
import { getNBATeamProfile } from '../utils/teamIdentity';

const COLUMN_WIDTHS = [196, 176, 186, 264, 186, 176, 196];
const COLUMN_GAP = 16;
const ROW_HEIGHT = 66;
const HEADER_HEIGHT = 96;
const CARD_INSET_Y = 8;
const STANDARD_ROW_SPAN = 2;
const FINALS_ROW_SPAN = 3;
const CANVAS_HEIGHT = HEADER_HEIGHT + (16 * ROW_HEIGHT);
const TOTAL_WIDTH =
  COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0) +
  (COLUMN_GAP * (COLUMN_WIDTHS.length - 1));

const ROW_POSITIONS = Object.freeze({
  firstRound: [1, 5, 9, 13],
  semifinals: [3, 11],
  conferenceFinals: 7,
  finals: 7,
  champion: 4
});

const EXPORT_PADDING_X = 40;
const EXPORT_PADDING_Y = 30;
const EXPORT_WIDTH = TOTAL_WIDTH + (EXPORT_PADDING_X * 2);
const EXPORT_HEIGHT = CANVAS_HEIGHT + (EXPORT_PADDING_Y * 2) + 12;
const FONT_STACK = 'Arial, Helvetica, sans-serif';

const getColumnX = (columnIndex) => (
  COLUMN_WIDTHS.slice(0, columnIndex).reduce((sum, width) => sum + width, 0) +
  (columnIndex * COLUMN_GAP)
);

const getColumnCenterX = (columnIndex) => getColumnX(columnIndex) + (COLUMN_WIDTHS[columnIndex] / 2);

const getCardY = (rowStart) => HEADER_HEIGHT + ((rowStart - 1) * ROW_HEIGHT) + CARD_INSET_Y;

const getCardHeight = (rowSpan = STANDARD_ROW_SPAN) => (rowSpan * ROW_HEIGHT) - (CARD_INSET_Y * 2);

const getCardCenterY = (rowStart, rowSpan = STANDARD_ROW_SPAN) => (
  getCardY(rowStart) + (getCardHeight(rowSpan) / 2)
);

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const encodeBase64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const svgToDataUrl = (svgMarkup) => `data:image/svg+xml;base64,${encodeBase64(svgMarkup)}`;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const resolveTeamName = (matchup, key) => {
  if (!matchup) return '';

  if (matchup[key] && String(matchup[key]).trim()) {
    return matchup[key];
  }

  const seedValue = matchup[`${key}Seed`];
  if (seedValue !== null && seedValue !== undefined) {
    return `#${seedValue} Seed`;
  }

  return '';
};

const truncateLabel = (value = '', maxLength = 15) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

const buildPolyline = (points, tone = 'neutral', strokeWidth = null) => {
  const styles = {
    neutral: { stroke: '#dbe4f0', width: 1.8 },
    east: { stroke: '#93c5fd', width: 2.2 },
    west: { stroke: '#f9a8d4', width: 2.2 }
  };
  const style = styles[tone] || styles.neutral;

  return `<polyline points="${points
    .map(([x, y]) => `${x + EXPORT_PADDING_X},${y + EXPORT_PADDING_Y}`)
    .join(' ')}" fill="none" stroke="${style.stroke}" stroke-width="${strokeWidth || style.width}" stroke-linecap="round" stroke-linejoin="round" />`;
};

const buildEastConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn) + COLUMN_WIDTHS[fromColumn];
  const endX = getColumnX(toColumn);
  const midX = (startX + endX) / 2;
  const startY = getCardCenterY(fromRow);
  const endY = getCardCenterY(toRow);

  return [[startX, startY], [midX, startY], [midX, endY], [endX, endY]];
};

const buildWestConnector = (fromColumn, fromRow, toColumn, toRow) => {
  const startX = getColumnX(fromColumn);
  const endX = getColumnX(toColumn) + COLUMN_WIDTHS[toColumn];
  const midX = (startX + endX) / 2;
  const startY = getCardCenterY(fromRow);
  const endY = getCardCenterY(toRow);

  return [[startX, startY], [midX, startY], [midX, endY], [endX, endY]];
};

const buildStageLabel = ({ left, width, top, label, tone = 'slate' }) => {
  const toneFill = tone === 'east' ? '#0369a1' : tone === 'west' ? '#be185d' : '#64748b';
  return `<text x="${left + (width / 2) + EXPORT_PADDING_X}" y="${top + EXPORT_PADDING_Y}" fill="${toneFill}" font-family="${FONT_STACK}" font-size="10" font-weight="700" letter-spacing="2.3" text-anchor="middle">${escapeXml(label.toUpperCase())}</text>`;
};

const buildGamesLabel = ({ left, width, top, gamesLabel, toneFill = '#475569' }) => {
  if (!gamesLabel) {
    return '';
  }

  return `<text x="${left + (width / 2) + EXPORT_PADDING_X}" y="${top + EXPORT_PADDING_Y}" fill="${toneFill}" font-family="${FONT_STACK}" font-size="10" font-weight="700" letter-spacing="1.6" text-anchor="middle">${escapeXml(gamesLabel.toUpperCase())}</text>`;
};

const buildMetaBlock = ({ left, width, top, gamesLabel, mvpPick = '' }) => {
  if (!gamesLabel && !mvpPick) {
    return '';
  }

  const centerX = left + (width / 2) + EXPORT_PADDING_X;
  const parts = [];

  if (gamesLabel) {
    parts.push(
      `<text x="${centerX}" y="${top + EXPORT_PADDING_Y}" fill="#475569" font-family="${FONT_STACK}" font-size="10" font-weight="700" letter-spacing="1.6" text-anchor="middle">${escapeXml(gamesLabel.toUpperCase())}</text>`
    );
  }

  if (mvpPick) {
    const mvpBaseY = top + EXPORT_PADDING_Y + (gamesLabel ? 20 : 0);
    parts.push(
      `<text x="${centerX}" y="${mvpBaseY}" fill="#94a3b8" font-family="${FONT_STACK}" font-size="9" font-weight="700" letter-spacing="1.4" text-anchor="middle">MVP PICK</text>`
    );
    parts.push(
      `<text x="${centerX}" y="${mvpBaseY + 18}" fill="#334155" font-family="${FONT_STACK}" font-size="12" font-weight="700" text-anchor="middle">${escapeXml(mvpPick)}</text>`
    );
  }

  return parts.join('');
};

const loadLogoDataUrl = async (logoUrl, cache) => {
  if (!logoUrl) return null;
  if (cache.has(logoUrl)) return cache.get(logoUrl);

  try {
    const response = await fetch(logoUrl, {
      mode: 'cors',
      credentials: 'same-origin',
      cache: 'force-cache'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch logo: ${response.status}`);
    }

    const svgMarkup = await response.text();
    const dataUrl = svgToDataUrl(svgMarkup);
    cache.set(logoUrl, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn('Export logo load failed:', logoUrl, error);
    cache.set(logoUrl, null);
    return null;
  }
};

const getMatchupTeams = (matchup = {}, logoCache) => {
  const team1Name = resolveTeamName(matchup, 'team1');
  const team2Name = resolveTeamName(matchup, 'team2');
  const team1Profile = getNBATeamProfile(team1Name);
  const team2Profile = getNBATeamProfile(team2Name);

  return Promise.all([
    loadLogoDataUrl(team1Profile?.logo || null, logoCache),
    loadLogoDataUrl(team2Profile?.logo || null, logoCache)
  ]).then(([team1Logo, team2Logo]) => ({
    team1: {
      name: team1Profile?.displayName || team1Name || 'TBD',
      logo: team1Logo,
      selected: matchup?.winner === matchup?.team1
    },
    team2: {
      name: team2Profile?.displayName || team2Name || 'TBD',
      logo: team2Logo,
      selected: matchup?.winner === matchup?.team2
    }
  }));
};

const buildLogoMark = ({ x, y, size, logo, fallback, selected = false }) => {
  const ringStroke = selected ? '#38bdf8' : '#cbd5e1';
  const ringFill = selected ? '#eff6ff' : '#ffffff';
  const parts = [
    `<circle cx="${x + (size / 2)}" cy="${y + (size / 2)}" r="${size / 2}" fill="${ringFill}" stroke="${ringStroke}" stroke-width="${selected ? 2.5 : 1.25}" />`
  ];

  if (logo) {
    parts.push(
      `<image href="${logo}" xlink:href="${logo}" x="${x + 6}" y="${y + 6}" width="${size - 12}" height="${size - 12}" preserveAspectRatio="xMidYMid meet" />`
    );
  } else {
    parts.push(
      `<text x="${x + (size / 2)}" y="${y + (size / 2) + 4}" fill="#64748b" font-family="${FONT_STACK}" font-size="${size < 30 ? 8 : 10}" font-weight="700" letter-spacing="1" text-anchor="middle">${escapeXml(fallback)}</text>`
    );
  }

  return parts.join('');
};

const buildTeamRow = ({ team, x, y, width, compact = true }) => {
  const rowHeight = compact ? 40 : 48;
  const logoSize = compact ? 26 : 34;
  const nameX = x + logoSize + 16;
  const fallback = (team.name || 'TBD').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" rx="18" fill="#ffffff" stroke="${team.selected ? '#7dd3fc' : '#e2e8f0'}" stroke-width="${team.selected ? 1.8 : 1.1}" />
    ${buildLogoMark({ x: x + 8, y: y + ((rowHeight - logoSize) / 2), size: logoSize, logo: team.logo, fallback, selected: team.selected })}
    <text x="${nameX}" y="${y + (rowHeight / 2) + 4}" fill="${team.selected ? '#0f172a' : '#334155'}" font-family="${FONT_STACK}" font-size="${compact ? 11 : 13}" font-weight="${team.selected ? 700 : 600}">${escapeXml(truncateLabel(team.name, compact ? 16 : 22))}</text>
  `;
};

const buildMatchupCard = ({ x, y, width, height, teams, title = '', emphasis = 'standard' }) => {
  const isChampionship = emphasis === 'championship';
  const isFeatured = emphasis === 'featured';
  const bgFill = isChampionship ? '#fff7e6' : isFeatured ? '#f8fafc' : '#ffffff';
  const borderStroke = isChampionship ? '#fbbf24' : '#cbd5e1';
  const titleFill = isChampionship ? '#92400e' : '#64748b';
  const cardPadding = isChampionship ? 14 : 12;
  const rowGap = 8;
  const headerHeight = title ? 18 : 6;
  const rowWidth = width - (cardPadding * 2);
  const rowStartY = y + cardPadding + headerHeight;

  return `
    <g>
      <rect x="${x + EXPORT_PADDING_X}" y="${y + EXPORT_PADDING_Y}" width="${width}" height="${height}" rx="22" fill="${bgFill}" stroke="${borderStroke}" stroke-width="${isChampionship ? 2.2 : 1.2}" />
      ${title ? `<text x="${x + EXPORT_PADDING_X + (width / 2)}" y="${y + EXPORT_PADDING_Y + 18}" fill="${titleFill}" font-family="${FONT_STACK}" font-size="10" font-weight="700" letter-spacing="1.6" text-anchor="middle">${escapeXml(title.toUpperCase())}</text>` : ''}
      ${buildTeamRow({
        team: teams.team1,
        x: x + EXPORT_PADDING_X + cardPadding,
        y: rowStartY + EXPORT_PADDING_Y,
        width: rowWidth
      })}
      ${buildTeamRow({
        team: teams.team2,
        x: x + EXPORT_PADDING_X + cardPadding,
        y: rowStartY + EXPORT_PADDING_Y + 40 + rowGap,
        width: rowWidth
      })}
    </g>
  `;
};

const buildFinalsCompetitor = ({ team, x, y, width, cardCenterY, align = 'left' }) => {
  const logoSize = 52;
  const logoX = align === 'left' ? x + 18 : x + width - 18 - logoSize;
  const logoCenterY = cardCenterY - 12;
  const logoY = logoCenterY - (logoSize / 2);
  const nameCenterX = logoX + (logoSize / 2);
  const fallback = (team.name || 'TBD').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const ringStroke = team.selected ? '#38bdf8' : '#cbd5e1';
  const ringWidth = team.selected ? 3 : 1.5;

  return `
    <g>
      <circle cx="${logoX + (logoSize / 2)}" cy="${logoCenterY}" r="${logoSize / 2}" fill="#ffffff" stroke="${ringStroke}" stroke-width="${ringWidth}" />
      ${team.logo
        ? `<image href="${team.logo}" xlink:href="${team.logo}" x="${logoX + 8}" y="${logoY + 8}" width="${logoSize - 16}" height="${logoSize - 16}" preserveAspectRatio="xMidYMid meet" />`
        : `<text x="${logoX + (logoSize / 2)}" y="${logoCenterY + 5}" fill="#64748b" font-family="${FONT_STACK}" font-size="11" font-weight="700" text-anchor="middle">${escapeXml(fallback)}</text>`
      }
      <text x="${nameCenterX}" y="${cardCenterY + 38}" fill="${team.selected ? '#0f172a' : '#334155'}" font-family="${FONT_STACK}" font-size="13" font-weight="${team.selected ? 700 : 600}" text-anchor="middle">${escapeXml(truncateLabel(team.name, 14))}</text>
    </g>
  `;
};

const buildFinalsCard = ({ x, y, width, height, teams, title = '' }) => {
  const centerX = x + EXPORT_PADDING_X + (width / 2);
  const centerY = y + EXPORT_PADDING_Y + (height / 2);

  return `
    <g>
      <rect x="${x + EXPORT_PADDING_X}" y="${y + EXPORT_PADDING_Y}" width="${width}" height="${height}" rx="22" fill="#fff7e6" stroke="#fbbf24" stroke-width="2.2" />
      ${title ? `<text x="${centerX}" y="${y + EXPORT_PADDING_Y + 18}" fill="#92400e" font-family="${FONT_STACK}" font-size="10" font-weight="700" letter-spacing="1.6" text-anchor="middle">${escapeXml(title.toUpperCase())}</text>` : ''}
      ${buildFinalsCompetitor({ team: teams.team1, x: x + EXPORT_PADDING_X, y: y + EXPORT_PADDING_Y + 20, width, cardCenterY: centerY, align: 'left' })}
      ${buildFinalsCompetitor({ team: teams.team2, x: x + EXPORT_PADDING_X, y: y + EXPORT_PADDING_Y + 20, width, cardCenterY: centerY, align: 'right' })}
      <text x="${centerX}" y="${centerY - 2}" fill="#94a3b8" font-family="${FONT_STACK}" font-size="11" font-weight="700" letter-spacing="1.4" text-anchor="middle">VS</text>
    </g>
  `;
};

const buildChampionBlock = ({ championName, championLogo }) => {
  const displayName = championName || 'TBD';
  const fallback = displayName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  const width = 176;
  const height = 176;
  const left = getColumnCenterX(3) - (width / 2);
  const top = HEADER_HEIGHT + ((ROW_POSITIONS.champion - 1) * ROW_HEIGHT) - 34;

  return `
    <g>
      <circle cx="${left + EXPORT_PADDING_X + (width / 2)}" cy="${top + EXPORT_PADDING_Y + (height / 2)}" r="82" fill="#d4a017" />
      <circle cx="${left + EXPORT_PADDING_X + (width / 2)}" cy="${top + EXPORT_PADDING_Y + (height / 2)}" r="80" fill="none" stroke="#f6d470" stroke-width="4" />
      <text x="${left + EXPORT_PADDING_X + (width / 2)}" y="${top + EXPORT_PADDING_Y + 38}" fill="#ffffff" font-family="${FONT_STACK}" font-size="11" font-weight="800" letter-spacing="1.8" text-anchor="middle">CHAMPION</text>
      <circle cx="${left + EXPORT_PADDING_X + (width / 2)}" cy="${top + EXPORT_PADDING_Y + 78}" r="26" fill="#ffffff" stroke="#f6d470" stroke-width="3" />
      ${championLogo
        ? `<image href="${championLogo}" xlink:href="${championLogo}" x="${left + EXPORT_PADDING_X + 60}" y="${top + EXPORT_PADDING_Y + 52}" width="56" height="56" preserveAspectRatio="xMidYMid meet" />`
        : `<text x="${left + EXPORT_PADDING_X + (width / 2)}" y="${top + EXPORT_PADDING_Y + 84}" fill="#64748b" font-family="${FONT_STACK}" font-size="11" font-weight="700" text-anchor="middle">${escapeXml(fallback)}</text>`
      }
      <text x="${left + EXPORT_PADDING_X + (width / 2)}" y="${top + EXPORT_PADDING_Y + 122}" fill="#ffffff" font-family="${FONT_STACK}" font-size="${displayName.length > 12 ? 14 : 16}" font-weight="700" text-anchor="middle">${escapeXml(displayName)}</text>
    </g>
  `;
};

const normalizeBracketData = (bracketData = {}) => {
  const firstRound = bracketData[ROUND_KEYS.FIRST_ROUND] || [];
  const semis = bracketData[ROUND_KEYS.CONF_SEMIS] || [];
  const confFinals = bracketData[ROUND_KEYS.CONF_FINALS] || [];
  const finals = bracketData[ROUND_KEYS.NBA_FINALS] || null;

  return {
    eastFirstRound: firstRound.filter((matchup) => matchup.conference === 'East'),
    westFirstRound: firstRound.filter((matchup) => matchup.conference === 'West'),
    eastSemis: semis.filter((matchup) => matchup.conference === 'East'),
    westSemis: semis.filter((matchup) => matchup.conference === 'West'),
    eastFinal: confFinals.find((matchup) => matchup.conference === 'East') || null,
    westFinal: confFinals.find((matchup) => matchup.conference === 'West') || null,
    finals,
    championName:
      bracketData[ROUND_KEYS.CHAMPION] ||
      finals?.winner ||
      ''
  };
};

const buildExportSvgMarkup = async (bracketData) => {
  const normalized = normalizeBracketData(bracketData);
  const logoCache = new Map();

  const matchupPromises = [
    ...normalized.eastFirstRound.map((matchup) => getMatchupTeams(matchup, logoCache)),
    ...normalized.eastSemis.map((matchup) => getMatchupTeams(matchup, logoCache)),
    ...(normalized.eastFinal ? [getMatchupTeams(normalized.eastFinal, logoCache)] : []),
    ...(normalized.finals ? [getMatchupTeams(normalized.finals, logoCache)] : []),
    ...(normalized.westFinal ? [getMatchupTeams(normalized.westFinal, logoCache)] : []),
    ...normalized.westSemis.map((matchup) => getMatchupTeams(matchup, logoCache)),
    ...normalized.westFirstRound.map((matchup) => getMatchupTeams(matchup, logoCache))
  ];

  const allTeams = await Promise.all(matchupPromises);
  let teamIndex = 0;
  const takeTeams = () => allTeams[teamIndex++];

  const championProfile = getNBATeamProfile(normalized.championName);
  const championLogo = await loadLogoDataUrl(championProfile?.logo || null, logoCache);
  const championBlock = buildChampionBlock({
    championName: championProfile?.displayName || normalized.championName || 'TBD',
    championLogo
  });

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" viewBox="0 0 ${EXPORT_WIDTH} ${EXPORT_HEIGHT}">`,
    `<defs>
      <linearGradient id="exportBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#eef2f7" />
      </linearGradient>
      <linearGradient id="eastFade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#eff6ff" stop-opacity="0.95" />
        <stop offset="100%" stop-color="#eff6ff" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="westFade" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#fff1f2" stop-opacity="0.95" />
        <stop offset="100%" stop-color="#fff1f2" stop-opacity="0" />
      </linearGradient>
    </defs>`,
    `<rect width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" fill="url(#exportBg)" />`,
    `<rect x="0" y="0" width="${Math.round(EXPORT_WIDTH * 0.38)}" height="${EXPORT_HEIGHT}" fill="url(#eastFade)" />`,
    `<rect x="${EXPORT_WIDTH - Math.round(EXPORT_WIDTH * 0.38)}" y="0" width="${Math.round(EXPORT_WIDTH * 0.38)}" height="${EXPORT_HEIGHT}" fill="url(#westFade)" />`,
    `<rect x="${EXPORT_PADDING_X}" y="${EXPORT_PADDING_Y}" width="${TOTAL_WIDTH}" height="${CANVAS_HEIGHT}" rx="30" fill="none" stroke="#e2e8f0" stroke-width="1" />`,
    buildPolyline(buildEastConnector(0, ROW_POSITIONS.firstRound[0], 1, ROW_POSITIONS.semifinals[0])),
    buildPolyline(buildEastConnector(0, ROW_POSITIONS.firstRound[1], 1, ROW_POSITIONS.semifinals[0])),
    buildPolyline(buildEastConnector(0, ROW_POSITIONS.firstRound[2], 1, ROW_POSITIONS.semifinals[1])),
    buildPolyline(buildEastConnector(0, ROW_POSITIONS.firstRound[3], 1, ROW_POSITIONS.semifinals[1])),
    buildPolyline(buildEastConnector(1, ROW_POSITIONS.semifinals[0], 2, ROW_POSITIONS.conferenceFinals), 'east'),
    buildPolyline(buildEastConnector(1, ROW_POSITIONS.semifinals[1], 2, ROW_POSITIONS.conferenceFinals), 'east'),
    buildPolyline(buildWestConnector(6, ROW_POSITIONS.firstRound[0], 5, ROW_POSITIONS.semifinals[0])),
    buildPolyline(buildWestConnector(6, ROW_POSITIONS.firstRound[1], 5, ROW_POSITIONS.semifinals[0])),
    buildPolyline(buildWestConnector(6, ROW_POSITIONS.firstRound[2], 5, ROW_POSITIONS.semifinals[1])),
    buildPolyline(buildWestConnector(6, ROW_POSITIONS.firstRound[3], 5, ROW_POSITIONS.semifinals[1])),
    buildPolyline(buildWestConnector(5, ROW_POSITIONS.semifinals[0], 4, ROW_POSITIONS.conferenceFinals), 'west'),
    buildPolyline(buildWestConnector(5, ROW_POSITIONS.semifinals[1], 4, ROW_POSITIONS.conferenceFinals), 'west'),
    buildPolyline(buildEastConnector(2, ROW_POSITIONS.conferenceFinals, 3, ROW_POSITIONS.finals), 'east', 2.6),
    buildPolyline(buildWestConnector(4, ROW_POSITIONS.conferenceFinals, 3, ROW_POSITIONS.finals), 'west', 2.6)
  ];

  normalized.eastFirstRound.forEach((matchup, index) => {
    const cardY = getCardY(ROW_POSITIONS.firstRound[index]);
    parts.push(
      buildMatchupCard({
        x: getColumnX(0),
        y: cardY,
        width: COLUMN_WIDTHS[0],
        height: getCardHeight(),
        teams: takeTeams()
      }),
      buildGamesLabel({
        left: getColumnX(0),
        width: COLUMN_WIDTHS[0],
        top: cardY + getCardHeight() + 16,
        gamesLabel: matchup?.numGames ? `${matchup.numGames} games` : ''
      })
    );
  });

  normalized.eastSemis.forEach((matchup, index) => {
    const cardY = getCardY(ROW_POSITIONS.semifinals[index]);
    parts.push(
      buildMatchupCard({
        x: getColumnX(1),
        y: cardY,
        width: COLUMN_WIDTHS[1],
        height: getCardHeight(),
        teams: takeTeams()
      }),
      buildGamesLabel({
        left: getColumnX(1),
        width: COLUMN_WIDTHS[1],
        top: cardY + getCardHeight() + 16,
        gamesLabel: matchup?.numGames ? `${matchup.numGames} games` : ''
      })
    );
  });

  if (normalized.eastFinal) {
    parts.push(
      buildStageLabel({
        left: getColumnX(2),
        width: COLUMN_WIDTHS[2],
        top: getCardY(ROW_POSITIONS.conferenceFinals) - 24,
        label: 'East Final',
        tone: 'east'
      }),
      buildMatchupCard({
        x: getColumnX(2),
        y: getCardY(ROW_POSITIONS.conferenceFinals),
        width: COLUMN_WIDTHS[2],
        height: getCardHeight(),
        teams: takeTeams(),
        emphasis: 'featured'
      }),
      buildMetaBlock({
        left: getColumnX(2),
        width: COLUMN_WIDTHS[2],
        top: getCardY(ROW_POSITIONS.conferenceFinals) + getCardHeight() + 18,
        gamesLabel: normalized.eastFinal?.numGames ? `${normalized.eastFinal.numGames} games` : ''
      })
    );
  }

  parts.push(championBlock);

  if (normalized.finals) {
    parts.push(
      buildFinalsCard({
        x: getColumnX(3),
        y: getCardY(ROW_POSITIONS.finals),
        width: COLUMN_WIDTHS[3],
        height: getCardHeight(FINALS_ROW_SPAN),
        teams: takeTeams(),
        title: 'NBA Finals'
      }),
      buildMetaBlock({
        left: getColumnX(3),
        width: COLUMN_WIDTHS[3],
        top: getCardY(ROW_POSITIONS.finals) + getCardHeight(FINALS_ROW_SPAN) + 24,
        gamesLabel: normalized.finals?.numGames ? `${normalized.finals.numGames} games` : '',
        mvpPick:
          normalized.finals?.predictedMVP ||
          normalized.finals?.mvp ||
          bracketData?.[ROUND_KEYS.FINALS_MVP] ||
          ''
      })
    );
  }

  if (normalized.westFinal) {
    parts.push(
      buildStageLabel({
        left: getColumnX(4),
        width: COLUMN_WIDTHS[4],
        top: getCardY(ROW_POSITIONS.conferenceFinals) - 24,
        label: 'West Final',
        tone: 'west'
      }),
      buildMatchupCard({
        x: getColumnX(4),
        y: getCardY(ROW_POSITIONS.conferenceFinals),
        width: COLUMN_WIDTHS[4],
        height: getCardHeight(),
        teams: takeTeams(),
        emphasis: 'featured'
      }),
      buildMetaBlock({
        left: getColumnX(4),
        width: COLUMN_WIDTHS[4],
        top: getCardY(ROW_POSITIONS.conferenceFinals) + getCardHeight() + 18,
        gamesLabel: normalized.westFinal?.numGames ? `${normalized.westFinal.numGames} games` : ''
      })
    );
  }

  normalized.westSemis.forEach((matchup, index) => {
    const cardY = getCardY(ROW_POSITIONS.semifinals[index]);
    parts.push(
      buildMatchupCard({
        x: getColumnX(5),
        y: cardY,
        width: COLUMN_WIDTHS[5],
        height: getCardHeight(),
        teams: takeTeams()
      }),
      buildGamesLabel({
        left: getColumnX(5),
        width: COLUMN_WIDTHS[5],
        top: cardY + getCardHeight() + 16,
        gamesLabel: matchup?.numGames ? `${matchup.numGames} games` : ''
      })
    );
  });

  normalized.westFirstRound.forEach((matchup, index) => {
    const cardY = getCardY(ROW_POSITIONS.firstRound[index]);
    parts.push(
      buildMatchupCard({
        x: getColumnX(6),
        y: cardY,
        width: COLUMN_WIDTHS[6],
        height: getCardHeight(),
        teams: takeTeams()
      }),
      buildGamesLabel({
        left: getColumnX(6),
        width: COLUMN_WIDTHS[6],
        top: cardY + getCardHeight() + 16,
        gamesLabel: matchup?.numGames ? `${matchup.numGames} games` : ''
      })
    );
  });

  parts.push('</svg>');
  return parts.join('');
};

export const exportBracketToPng = async ({
  bracketData,
  filename = 'nba-playoffs-bracket.png'
}) => {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const svgMarkup = await buildExportSvgMarkup(bracketData);
  const svgUrl = svgToDataUrl(svgMarkup);

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = svgUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH * 2;
  canvas.height = EXPORT_HEIGHT * 2;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to create export canvas context');
  }

  context.setTransform(2, 0, 0, 2, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  context.drawImage(image, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  const pngBlob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch (error) {
      reject(error);
    }
  });

  if (pngBlob) {
    downloadBlob(pngBlob, filename);
    return;
  }

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};
