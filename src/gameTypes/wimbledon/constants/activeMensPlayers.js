import { WIMBLEDON_DRAW_SIZE } from './wimbledonConstants';

const PLAYERS = [
  ['Carlos Alcaraz', 'ESP'],
  ['Jannik Sinner', 'ITA'],
  ['Novak Djokovic', 'SRB'],
  ['Alexander Zverev', 'GER'],
  ['Lorenzo Musetti', 'ITA'],
  ['Alex de Minaur', 'AUS'],
  ['Taylor Fritz', 'USA'],
  ['Ben Shelton', 'USA'],
  ['Daniil Medvedev', ''],
  ['Felix Auger-Aliassime', 'CAN'],
  ['Alexander Bublik', 'KAZ'],
  ['Jack Draper', 'GBR'],
  ['Casper Ruud', 'NOR'],
  ['Andrey Rublev', ''],
  ['Karen Khachanov', ''],
  ['Tommy Paul', 'USA'],
  ['Jakub Mensik', 'CZE'],
  ['Holger Rune', 'DEN'],
  ['Frances Tiafoe', 'USA'],
  ['Flavio Cobolli', 'ITA'],
  ['Ugo Humbert', 'FRA'],
  ['Jiri Lehecka', 'CZE'],
  ['Francisco Cerundolo', 'ARG'],
  ['Tomas Machac', 'CZE'],
  ['Arthur Fils', 'FRA'],
  ['Denis Shapovalov', 'CAN'],
  ['Alejandro Davidovich Fokina', 'ESP'],
  ['Cameron Norrie', 'GBR'],
  ['Alexei Popyrin', 'AUS'],
  ['Matteo Berrettini', 'ITA'],
  ['Alejandro Tabilo', 'CHI'],
  ['Tomas Martin Etcheverry', 'ARG'],
  ['Sebastian Korda', 'USA'],
  ['Brandon Nakashima', 'USA'],
  ['Luciano Darderi', 'ITA'],
  ['Gabriel Diallo', 'CAN'],
  ['Giovanni Mpetshi Perricard', 'FRA'],
  ['Nuno Borges', 'POR'],
  ['Alex Michelsen', 'USA'],
  ['Matteo Arnaldi', 'ITA'],
  ['Jordan Thompson', 'AUS'],
  ['Pedro Martinez', 'ESP'],
  ['Corentin Moutet', 'FRA'],
  ['Lorenzo Sonego', 'ITA'],
  ['Miomir Kecmanovic', 'SRB'],
  ['Marcos Giron', 'USA'],
  ['Roberto Bautista Agut', 'ESP'],
  ['Gael Monfils', 'FRA'],
  ['Sebastian Baez', 'ARG'],
  ['Zhizhen Zhang', 'CHN'],
  ['Jaume Munar', 'ESP'],
  ['Fabian Marozsan', 'HUN'],
  ['Hubert Hurkacz', 'POL'],
  ['Mariano Navone', 'ARG'],
  ['Mattia Bellucci', 'ITA'],
  ['Jacob Fearnley', 'GBR'],
  ['Zizou Bergs', 'BEL'],
  ['David Goffin', 'BEL'],
  ['Daniel Altmaier', 'GER'],
  ['Arthur Rinderknech', 'FRA'],
  ['Tallon Griekspoor', 'NED'],
  ['Yoshihito Nishioka', 'JPN'],
  ['Juncheng Shang', 'CHN'],
  ['Yunchaokete Bu', 'CHN'],
  ['Learner Tien', 'USA'],
  ['Joao Fonseca', 'BRA'],
  ['Roman Safiullin', ''],
  ['Botic van de Zandschulp', 'NED'],
  ['Laslo Djere', 'SRB'],
  ['Benjamin Bonzi', 'FRA'],
  ['Quentin Halys', 'FRA'],
  ['Alexandre Muller', 'FRA'],
  ['Roberto Carballes Baena', 'ESP'],
  ['Marton Fucsovics', 'HUN'],
  ['Christopher OConnell', 'AUS'],
  ['Thanasi Kokkinakis', 'AUS'],
  ['Reilly Opelka', 'USA'],
  ['Aleksandar Vukic', 'AUS'],
  ['Adam Walton', 'AUS'],
  ['James Duckworth', 'AUS'],
  ['Rinky Hijikata', 'AUS'],
  ['Damir Dzumhur', 'BIH'],
  ['Sumit Nagal', 'IND'],
  ['Kei Nishikori', 'JPN'],
  ['Yannick Hanfmann', 'GER'],
  ['Dominik Koepfer', 'GER'],
  ['Pavel Kotov', ''],
  ['Alexander Shevchenko', 'KAZ'],
  ['Hamad Medjedovic', 'SRB'],
  ['Dusan Lajovic', 'SRB'],
  ['Luca Nardi', 'ITA'],
  ['Luca Van Assche', 'FRA'],
  ['Thiago Seyboth Wild', 'BRA'],
  ['Thiago Monteiro', 'BRA'],
  ['Hugo Dellien', 'BOL'],
  ['Cristian Garin', 'CHI'],
  ['Camilo Ugo Carabelli', 'ARG'],
  ['Facundo Diaz Acosta', 'ARG'],
  ['Federico Coria', 'ARG'],
  ['Francisco Comesana', 'ARG'],
  ['Roman Andres Burruchaga', 'ARG'],
  ['Juan Manuel Cerundolo', 'ARG'],
  ['Vit Kopriva', 'CZE'],
  ['Jozef Kovalik', 'SVK'],
  ['Otto Virtanen', 'FIN'],
  ['Jesper de Jong', 'NED'],
  ['Raphael Collignon', 'BEL'],
  ['Alexander Blockx', 'BEL'],
  ['Harold Mayot', 'FRA'],
  ['Terence Atmane', 'FRA'],
  ['Hugo Gaston', 'FRA'],
  ['Arthur Cazaux', 'FRA'],
  ['Dino Prizmic', 'CRO'],
  ['Francesco Passaro', 'ITA'],
  ['Andrea Vavassori', 'ITA'],
  ['Stefano Travaglia', 'ITA'],
  ['Borna Coric', 'CRO'],
  ['Borna Gojo', 'CRO'],
  ['Marin Cilic', 'CRO'],
  ['Daniel Evans', 'GBR'],
  ['Billy Harris', 'GBR'],
  ['Jack Pinnington Jones', 'GBR'],
  ['Tristan Schoolkate', 'AUS'],
  ['Taro Daniel', 'JPN'],
  ['Yosuke Watanuki', 'JPN'],
  ['Soonwoo Kwon', 'KOR'],
  ['Chun-Hsin Tseng', 'TPE'],
  ['Coleman Wong', 'HKG']
];

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const SEEDED_SLOT_POSITIONS = [
  1, 128, 33, 96, 65, 64, 97, 32,
  17, 112, 49, 80, 81, 48, 113, 16,
  9, 120, 41, 88, 73, 56, 105, 24,
  25, 104, 57, 72, 89, 40, 121, 8
];

export const ACTIVE_MENS_PLAYERS = Object.freeze(
  PLAYERS.map(([name, countryCode], index) => Object.freeze({
    name,
    countryCode,
    seed: index < 32 ? index + 1 : null,
    externalId: `fixture-${slugify(name)}`
  }))
);

export const createActiveMensDrawRows = () => {
  if (ACTIVE_MENS_PLAYERS.length !== WIMBLEDON_DRAW_SIZE) {
    throw new Error(`Active men's player fixture must contain exactly ${WIMBLEDON_DRAW_SIZE} players`);
  }

  const seededPlayers = ACTIVE_MENS_PLAYERS.slice(0, SEEDED_SLOT_POSITIONS.length);
  const unseededPlayers = ACTIVE_MENS_PLAYERS.slice(SEEDED_SLOT_POSITIONS.length);
  const seededByPosition = new Map(
    SEEDED_SLOT_POSITIONS.map((position, index) => [position, seededPlayers[index]])
  );
  let unseededIndex = 0;

  return Array.from({ length: WIMBLEDON_DRAW_SIZE }, (_, index) => {
    const position = index + 1;
    const player = seededByPosition.get(position) || unseededPlayers[unseededIndex++];
    return {
      slotId: `slot-${position}`,
      ...player,
      entryStatus: ''
    };
  });
};
