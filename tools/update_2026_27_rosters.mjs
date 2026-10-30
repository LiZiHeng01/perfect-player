/* ============================================================
 * Build the 2026-27 NBA roster + rating data used by the game.
 *
 * Data flow:
 *   ESPN 2026-27 team rosters  ->  name / age / height / experience
 *   ESPN 2026 draft class      ->  rookie pick, Chinese name, headshot
 *   2025-26 ratings + stats    ->  returning-player attributes
 *   2026 draft pick curve      ->  rookie attributes (no NBA sample yet)
 *
 * Usage:
 *   node tools/update_2026_27_rosters.mjs --refresh   # fetch ESPN, then build
 *   node tools/update_2026_27_rosters.mjs             # use cached ESPN files
 *   node tools/update_2026_27_rosters.mjs --dry-run   # build + report, no writes
 * ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(TOOL_DIR);

const ROSTER_PATH = path.join(ROOT, 'assets/js/hupu/script-01-2678-5hu3djrc-upload-1783494754597-12.js');
const RATINGS_PATH = path.join(ROOT, 'assets/js/current-player-ratings-2026.js');
const HTML_PATH = path.join(ROOT, 'nba-perfect-player.html');
const ESPN_CACHE_PATH = path.join(ROOT, 'assets/data/nba-2026-27-espn-rosters.json');
const DRAFT_CACHE_PATH = path.join(ROOT, 'assets/data/nba-2026-27-draft.json');
const REPORT_PATH = path.join(ROOT, 'assets/data/nba-2026-27-roster-report.json');
const PER_GAME_PATH = path.join(ROOT, 'assets/data/nba-2025-26-per-game.json');
const ADVANCED_PATH = path.join(ROOT, 'assets/data/nba-2025-26-advanced.json');
const DRAFT_MANIFEST_PATH = path.join(ROOT, 'assets/data/official-headshot-manifest.json');
const PLAYER_IMAGES_PATH = path.join(ROOT, 'assets/data/nba-player-images.js');
const ESPN_HEADSHOT_DIR = path.join(ROOT, 'assets/images/Player/espn-current');

const SEASON = '2026-27';
const RATING_BASIS = '2025-26 NBA regular season (latest completed season)';
const REFRESH = process.argv.includes('--refresh');
const DRY_RUN = process.argv.includes('--dry-run');

const ATTRS = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
const OVR_WEIGHTS = {
  PG: { threePT:.10, MID:.10, FIN:.08, DNK:.04, HAN:.14, PAS:.14, PDEF:.10, IDEF:.04, BLK:.02, REB:.04, ATH:.08, STR:.04, CLU:.08 },
  SG: { threePT:.12, MID:.12, FIN:.10, DNK:.06, HAN:.10, PAS:.08, PDEF:.10, IDEF:.04, BLK:.02, REB:.04, ATH:.08, STR:.04, CLU:.10 },
  SF: { threePT:.10, MID:.10, FIN:.10, DNK:.08, HAN:.08, PAS:.06, PDEF:.10, IDEF:.08, BLK:.04, REB:.06, ATH:.08, STR:.06, CLU:.06 },
  PF: { threePT:.08, MID:.06, FIN:.12, DNK:.06, HAN:.06, PAS:.04, PDEF:.10, IDEF:.12, BLK:.08, REB:.10, ATH:.06, STR:.08, CLU:.04 },
  C:  { threePT:.04, MID:.04, FIN:.14, DNK:.06, HAN:.04, PAS:.04, PDEF:.08, IDEF:.14, BLK:.12, REB:.12, ATH:.04, STR:.10, CLU:.04 },
};

const TEAM_ORDER = ['ATL','BKN','BOS','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
const ESPN_TEAM_MAP = { GS:'GSW', NO:'NOP', NY:'NYK', SA:'SAS', UTAH:'UTA', WSH:'WAS' };

// Undrafted 2026 players whose Chinese names are not yet in the historical roster CSVs.
const MANUAL_CNAMES = {
  'Kylan Boswell': '凯兰-博斯韦尔',
  'Tobe Awaka': '托比-阿瓦卡',
  'Jaylin Sellers': '杰林-塞勒斯',
  'Ernest Udeh Jr.': '欧内斯特-乌德-二世',
  'Alpha Diallo': '阿尔法-迪亚洛',
  'Graham Ike': '格雷厄姆-艾克',
  'Quadir Copeland': '卡迪尔-科普兰',
  'Lawson Lovering': '劳森-洛弗林',
  'AK Okereke': 'AK-奥克雷克',
  'Carson Cooper': '卡森-库珀',
  'Tre Donaldson': '特雷-唐纳森',
  'Malik Dia': '马利克-迪亚',
  'Jaden Akins': '贾登-阿金斯',
  'Josh Dix': '乔什-迪克斯',
  'Nate Bittle': '内特-比特尔',
  // The legacy roster stored this name in English (his dictionary entry uses "Mohamed Bamba").
  'Mo Bamba': '穆罕默德-班巴',
};

// Veterans who are on a 2026-27 roster but were not part of the 2025-26 525-man table.
const VETERAN_PROFILES = {
  'James Harden': {
    ovr: 84, pos: 'PG / SG', type: 'Crafty Offensive Engine',
    overrides: { threePT:86, MID:90, FIN:84, DNK:48, HAN:94, PAS:94, PDEF:62, IDEF:48, BLK:48, REB:58, ATH:70, STR:62, CLU:88 },
  },
  'DeMar DeRozan': {
    ovr: 81, pos: 'SG / SF', type: 'Mid-Range Maestro',
    overrides: { threePT:60, MID:95, FIN:88, DNK:55, HAN:92, PAS:78, PDEF:62, IDEF:48, BLK:40, REB:52, ATH:62, STR:62, CLU:88 },
  },
  'Jonathan Kuminga': {
    ovr: 78, pos: 'SF / PF', type: 'Explosive Two-Way Wing',
    overrides: { threePT:70, MID:74, FIN:88, DNK:93, HAN:80, PAS:62, PDEF:78, IDEF:70, BLK:62, REB:72, ATH:89, STR:79, CLU:70 },
  },
  'Ben Simmons': {
    ovr: 74, pos: 'PG / PF', type: 'Point Forward',
    overrides: { threePT:25, MID:45, FIN:78, DNK:65, HAN:82, PAS:86, PDEF:85, IDEF:82, BLK:68, REB:78, ATH:76, STR:80, CLU:55 },
  },
  'Mario Hezonja': {
    ovr: 72, pos: 'SF / SG', type: 'Versatile Wing',
    overrides: { threePT:80, MID:74, FIN:76, DNK:72, HAN:75, PAS:65, PDEF:68, IDEF:55, BLK:45, REB:60, ATH:72, STR:64, CLU:68 },
  },
  'Georges Niang': {
    ovr: 74, pos: 'PF / SF', type: 'Stretch Forward',
    overrides: { threePT:88, MID:74, FIN:74, DNK:35, HAN:76, PAS:68, PDEF:52, IDEF:52, BLK:42, REB:58, ATH:48, STR:68, CLU:70 },
  },
  'Brandon Williams': {
    ovr: 75, pos: 'PG / SG', type: 'Scoring Guard',
    overrides: { threePT:76, MID:80, FIN:82, DNK:74, HAN:82, PAS:72, PDEF:62, IDEF:50, BLK:42, REB:52, ATH:76, STR:56, CLU:74 },
  },
  'Grant Nelson': {
    ovr: 68, pos: 'PF / SF', type: 'Athletic Forward',
    overrides: { threePT:68, MID:64, FIN:74, DNK:72, HAN:68, PAS:58, PDEF:66, IDEF:64, BLK:62, REB:70, ATH:70, STR:68, CLU:60 },
  },
  'Arthur Kaluma': {
    ovr: 68, pos: 'SF / PF', type: 'Physical Wing',
    overrides: { threePT:70, MID:66, FIN:74, DNK:74, HAN:68, PAS:58, PDEF:68, IDEF:62, BLK:58, REB:66, ATH:72, STR:68, CLU:60 },
  },
  'Pete Nance': {
    ovr: 70, pos: 'PF / C', type: 'Stretch Big',
    overrides: { threePT:78, MID:70, FIN:72, DNK:62, HAN:70, PAS:62, PDEF:58, IDEF:60, BLK:58, REB:66, ATH:58, STR:68, CLU:66 },
  },
  'James Wiseman': {
    ovr: 71, pos: 'C', type: 'Athletic Rim Runner',
    overrides: { threePT:35, MID:55, FIN:82, DNK:80, HAN:65, PAS:40, PDEF:58, IDEF:72, BLK:72, REB:78, ATH:72, STR:78, CLU:60 },
  },
  'Tacko Fall': {
    ovr: 66, pos: 'C', type: 'Paint Protector',
    overrides: { threePT:25, MID:30, FIN:70, DNK:75, HAN:45, PAS:30, PDEF:40, IDEF:65, BLK:80, REB:76, ATH:45, STR:85, CLU:50 },
  },
  'Duop Reath': {
    ovr: 68, pos: 'C', type: 'Stretch Center',
    overrides: { threePT:76, MID:62, FIN:72, DNK:60, HAN:62, PAS:45, PDEF:50, IDEF:66, BLK:64, REB:70, ATH:52, STR:70, CLU:62 },
  },
  'Micah Potter': {
    ovr: 73, pos: 'C / PF', type: 'Stretch Center',
    overrides: { threePT:82, MID:70, FIN:78, DNK:68, HAN:70, PAS:55, PDEF:55, IDEF:72, BLK:70, REB:76, ATH:58, STR:74, CLU:70 },
  },
  'Leaky Black': {
    ovr: 70, pos: 'SF / PF', type: 'Defensive Wing',
    overrides: { threePT:68, MID:64, FIN:74, DNK:72, HAN:68, PAS:60, PDEF:76, IDEF:70, BLK:62, REB:68, ATH:72, STR:68, CLU:62 },
  },
  'Reece Beekman': {
    ovr: 69, pos: 'PG / SG', type: 'Defensive Guard',
    overrides: { threePT:64, MID:66, FIN:74, DNK:66, HAN:76, PAS:76, PDEF:74, IDEF:55, BLK:48, REB:52, ATH:74, STR:58, CLU:62 },
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeName = value => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

function evalObject(source, marker, endMarker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Marker not found: ' + marker);
  const objStart = source.indexOf('{', start);
  const end = endMarker ? source.indexOf(endMarker, objStart) : source.length;
  let body = source.slice(objStart, end).trim();
  body = body.replace(/;?\s*$/, '');
  return new Function('return (' + body + ')')();
}

function loadLocalRoster() {
  const source = fs.readFileSync(ROSTER_PATH, 'utf8');
  return evalObject(source, 'const NBA2K_DATA =', 'const NBA2K_TEAMS');
}

function loadRatings() {
  const source = fs.readFileSync(RATINGS_PATH, 'utf8');
  const ratings = JSON.parse(source.match(/const NBA_CURRENT_RATINGS_2026 = (\{[\s\S]*?\});/)[1]);
  const samples = JSON.parse(source.match(/const NBA_CURRENT_RATINGS_2026_SAMPLES = (\{[\s\S]*?\});/)[1]);
  const meta = JSON.parse(source.match(/const NBA_CURRENT_RATINGS_2026_META = (\{[\s\S]*?\});/)[1]);
  return { ratings, samples, meta };
}

function loadDraftClass() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const marker = 'var DRAFT_CLASS_2026 = [';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('DRAFT_CLASS_2026 not found');
  const arrStart = html.indexOf('[', start);
  const arrEnd = html.indexOf('];', arrStart);
  return new Function('return (' + html.slice(arrStart, arrEnd + 1) + ')')();
}

function loadChineseNameDictionary() {
  const dict = new Map();
  const files = fs.readdirSync(path.join(ROOT, 'assets/data')).filter(name => /^rosters.*\.csv$/i.test(name));
  for (const file of files) {
    const lines = fs.readFileSync(path.join(ROOT, 'assets/data', file), 'utf8').split(/\r?\n/);
    for (const line of lines.slice(1)) {
      const cols = line.split(';');
      if (cols.length > 2 && cols[1] && cols[2]) {
        dict.set(normalizeName(cols[2]), cols[1].trim());
      }
    }
  }
  return dict;
}

function loadPlayerImages() {
  const source = fs.readFileSync(PLAYER_IMAGES_PATH, 'utf8').trim();
  const body = source.replace(/^var\s+NBA_PLAYER_IMAGES\s*=\s*/, '').replace(/;?\s*$/, '');
  return new Function('return (' + body + ')')();
}

function load2025_26Stats() {
  const perRows = JSON.parse(fs.readFileSync(PER_GAME_PATH, 'utf8')).rows || [];
  const advancedRows = JSON.parse(fs.readFileSync(ADVANCED_PATH, 'utf8')).rows || [];
  const perByName = new Map();
  const advByName = new Map();
  const group = rows => {
    const map = new Map();
    for (const row of rows) {
      if (!row.player_id) continue;
      if (!map.has(row.player_id)) map.set(row.player_id, []);
      map.get(row.player_id).push(row);
    }
    return map;
  };
  const perGroups = group(perRows);
  const advGroups = group(advancedRows);
  for (const rows of perGroups.values()) {
    const total = rows.find(row => /^\d+TM$/.test(row.team_name_abbr || '')) ||
      rows.slice().sort((a, b) => number(b.games) - number(a.games))[0];
    if (total) perByName.set(normalizeName(total.name_display), total);
  }
  for (const rows of advGroups.values()) {
    const total = rows.find(row => /^\d+TM$/.test(row.team_name_abbr || '')) ||
      rows.slice().sort((a, b) => number(b.games) - number(a.games))[0];
    if (total) advByName.set(normalizeName(total.name_display), total);
  }
  return { perByName, advByName };
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'perfect-player-roster-updater/1.0', 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error(url + ' -> HTTP ' + response.status);
  return response.json();
}

async function loadEspnRosters() {
  if (!REFRESH && fs.existsSync(ESPN_CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(ESPN_CACHE_PATH, 'utf8'));
  }
  console.log('Fetching ESPN 2026-27 rosters ...');
  const teamsPayload = await getJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams');
  const teams = teamsPayload.sports[0].leagues[0].teams.map(entry => entry.team);
  const out = {
    _meta: {
      season: SEASON,
      source: 'ESPN NBA team roster API',
      sourceUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
      fetchedAt: new Date().toISOString(),
    },
    teams: {},
  };
  for (const team of teams) {
    const roster = await getJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/' + team.id + '/roster');
    const abbr = ESPN_TEAM_MAP[team.abbreviation] || team.abbreviation;
    out.teams[abbr] = (roster.athletes || []).map(athlete => ({
      espnId: String(athlete.id || ''),
      name: athlete.fullName || athlete.displayName || '',
      age: number(athlete.age, 0),
      pos: (athlete.position && athlete.position.abbreviation) || '',
      height: athlete.displayHeight || '',
      exp: number(athlete.experience && athlete.experience.years, 0),
      headshot: (athlete.headshot && athlete.headshot.href) || '',
    })).filter(player => player.name);
  }
  fs.writeFileSync(ESPN_CACHE_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

async function loadDraft() {
  if (!REFRESH && fs.existsSync(DRAFT_CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(DRAFT_CACHE_PATH, 'utf8'));
    if (cached._meta && cached._meta.version === 2) return cached;
  }
  console.log('Fetching ESPN 2026 draft class ...');
  const payload = await getJson('https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/draft?season=2026');
  const out = {
    _meta: {
      version: 2,
      season: 2026,
      source: 'ESPN NBA draft API',
      sourceUrl: 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/draft?season=2026',
      fetchedAt: new Date().toISOString(),
    },
    picks: (payload.picks || []).map(pick => ({
      // ESPN's `pick` is the pick inside the round; `overall` is 1-60.
      pick: number(pick.overall, 0) || number(pick.pick, 0),
      round: number(pick.round, 0),
      roundPick: number(pick.pick, 0),
      name: pick.athlete && (pick.athlete.displayName || pick.athlete.fullName) || '',
      pos: pick.athlete && pick.athlete.position && pick.athlete.position.abbreviation || '',
      height: pick.athlete && pick.athlete.displayHeight || '',
      espnId: String(pick.athlete && pick.athlete.id || ''),
    })).filter(pick => pick.pick && pick.name),
  };
  fs.writeFileSync(DRAFT_CACHE_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

function positionGroup(pos) {
  const primary = String(pos || 'SF').split('/')[0].trim();
  return OVR_WEIGHTS[primary] ? primary : 'SF';
}

function calcOvr(attrs, pos) {
  const weights = OVR_WEIGHTS[positionGroup(pos)];
  return ATTRS.reduce((sum, key) => sum + number(attrs[key], 50) * weights[key], 0);
}

function parseHeightInches(height) {
  const match = String(height || '').match(/(\d+)\s*['′]\s*(\d+)/);
  if (!match) return 0;
  return number(match[1]) * 12 + number(match[2]);
}

function normalizeHeight(height) {
  const inches = parseHeightInches(height);
  if (!inches) return String(height || '').replace(/\s+/g, '');
  return Math.floor(inches / 12) + "'" + (inches % 12) + "'";
}

function newPlayerPosition(espnPos, draftPos, height) {
  const inches = parseHeightInches(height);
  const kind = draftPos === '后卫' || espnPos === 'G' ? 'G'
    : draftPos === '中锋' || espnPos === 'C' ? 'C'
    : draftPos === '前锋' || espnPos === 'F' ? 'F'
    : 'F';
  if (kind === 'C') return 'C';
  if (kind === 'G') return inches >= 78 ? 'SG / PG' : 'PG / SG';
  if (inches >= 83) return 'PF / C';
  if (inches >= 82) return 'PF / SF';
  return 'SF / PF';
}

function archetypeFor(pos) {
  const group = positionGroup(pos);
  if (group === 'PG') return 'Floor General';
  if (group === 'SG') return 'Shot Creator';
  if (group === 'SF') return 'Two-Way Wing';
  if (group === 'PF') return 'Modern Forward';
  return 'Rim Protector';
}

function draftPickOvr(pick) {
  if (pick <= 1) return 82;
  if (pick <= 3) return 83 - pick;       // 2 -> 81, 3 -> 80
  if (pick <= 8) return 79;
  if (pick <= 15) return 78;
  if (pick <= 22) return 77;
  if (pick <= 30) return 76;
  if (pick <= 40) return 73;
  if (pick <= 50) return 70;
  if (pick <= 60) return 68;
  return 67;
}

function undraftedOvr(age) {
  if (age <= 21) return 66;
  if (age <= 23) return 67;
  if (age <= 25) return 68;
  if (age <= 28) return 69;
  return 70;
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildAttributes(targetOvr, pos, seedText, pool, overrides) {
  const group = positionGroup(pos);
  const candidates = pool
    .filter(player => positionGroup(player.pos) === group)
    .sort((a, b) => Math.abs(a.ovr - targetOvr) - Math.abs(b.ovr - targetOvr))
    .slice(0, 12);
  const random = mulberry32(hashText(seedText));
  const picked = [];
  const working = candidates.slice();
  while (picked.length < Math.min(3, working.length)) {
    const index = Math.floor(Math.pow(random(), 1.4) * working.length);
    picked.push(working.splice(index, 1)[0]);
  }
  const base = picked.length ? picked : candidates;
  const attrs = {};
  for (const key of ATTRS) {
    if (!base.length) {
      attrs[key] = clamp(Math.round(targetOvr - 3 + (random() * 6 - 3)), 25, 99);
    } else {
      const average = base.reduce((sum, player) => sum + number(player[key], targetOvr - 3), 0) / base.length;
      attrs[key] = clamp(Math.round(average + (random() * 5 - 2.5)), 25, 99);
    }
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (key in attrs) attrs[key] = clamp(Math.round(value), 25, 99);
    }
  }
  return attrs;
}

function csvPlayers(localRoster) {
  const players = [];
  for (const [team, roster] of Object.entries(localRoster)) {
    for (const player of roster) {
      if (player && player.name) players.push({ team, ...player });
    }
  }
  return players;
}

function seasonSampleFromStats(name, perByName) {
  const row = perByName.get(normalizeName(name));
  if (!row) return { games: 0, minutes: 0, basis: 'no-2025-26-games' };
  const games = number(row.games, 0);
  const minutes = Math.round(games * number(row.mp_per_g, 0));
  return {
    games,
    minutes,
    basis: minutes >= 400 ? '2025-26-season' : '2025-26-small-sample',
  };
}

function buildRoster(params) {
  const {
    localRoster, ratings, samples, draftClass, draftPicks, espnRosters,
    dictionary, playerImages, stats, draftManifest,
  } = params;

  const localPlayers = csvPlayers(localRoster);
  const localByNorm = new Map();
  for (const player of localPlayers) localByNorm.set(normalizeName(player.name), player);

  const ratingByNorm = new Map();
  const sampleByNorm = new Map();
  for (const [key, rating] of Object.entries(ratings)) {
    const name = key.split('|').slice(1).join('|');
    ratingByNorm.set(normalizeName(name), rating);
  }
  for (const [key, sample] of Object.entries(samples)) {
    const name = key.split('|').slice(1).join('|');
    sampleByNorm.set(normalizeName(name), sample);
  }

  const draftByNorm = new Map();
  for (const pick of draftPicks.picks) draftByNorm.set(normalizeName(pick.name), pick);

  const manifestByPick = new Map();
  for (const row of (draftManifest.draft2026 || [])) manifestByPick.set(number(row.pick, 0), row);

  const imageByNorm = new Map();
  for (const [name, id] of Object.entries(playerImages)) {
    const key = normalizeName(name);
    if (key && !imageByNorm.has(key)) imageByNorm.set(key, number(id, 0));
  }

  const pool = localPlayers.map(player => {
    const rating = ratingByNorm.get(normalizeName(player.name)) || player;
    return {
      name: player.name,
      pos: player.pos,
      ovr: number(rating.ovr, number(player.ovr, 70)),
      ...Object.fromEntries(ATTRS.map(attr => [attr, number(rating[attr], number(player[attr], 50))])),
    };
  });

  const teams = {};
  const ratingOutput = {};
  const sampleOutput = {};
  const reportNew = [];
  const reportMatched = [];
  const seenNames = new Set();

  for (const team of TEAM_ORDER) {
    const espnRoster = (espnRosters.teams[team] || []).slice();
    espnRoster.sort((a, b) => {
      const ovrA = number((ratingByNorm.get(normalizeName(a.name)) || {}).ovr, 0);
      const ovrB = number((ratingByNorm.get(normalizeName(b.name)) || {}).ovr, 0);
      return ovrB - ovrA;
    });
    teams[team] = [];

    for (const espnPlayer of espnRoster) {
      const norm = normalizeName(espnPlayer.name);
      if (seenNames.has(norm)) {
        throw new Error('Duplicate player in ESPN rosters: ' + espnPlayer.name);
      }
      seenNames.add(norm);

      const local = localByNorm.get(norm);
      const draftPick = draftByNorm.get(norm);
      const oldRating = ratingByNorm.get(norm);
      const oldSample = sampleByNorm.get(norm);
      const isDraftedRookie = !!draftPick;
      const isNew = !local;
      const draftIndex = draftPick ? draftPick.pick - 1 : -1;
      const draftInfo = draftIndex >= 0 ? draftClass[draftIndex] : null;

      let cname = '';
      const localCn = local && local.cname && local.cname !== local.name ? local.cname : '';
      if (localCn) cname = localCn;
      else if (draftInfo && draftInfo.cn) cname = draftInfo.cn;
      else cname = dictionary.get(norm) || MANUAL_CNAMES[espnPlayer.name] || localCn || espnPlayer.name;

      let player;
      let sample;
      let targetOvr;
      let kind;

      if (local) {
        kind = 'returning';
        player = { ...local };
        player.name = local.name;
        player.cname = cname;
        player.pos = local.pos;
        player.height = local.height;
        player.type = local.type;
        player.ovr = number(oldRating && oldRating.ovr, number(local.ovr, 70));
        for (const attr of ATTRS) player[attr] = number(oldRating && oldRating[attr], number(local[attr], 50));
        sample = oldSample || seasonSampleFromStats(local.name, stats.perByName);
        targetOvr = player.ovr;
        reportMatched.push({ team, name: player.name, cname: player.cname, oldTeam: local.team, ovr: player.ovr });
      } else if (isDraftedRookie) {
        kind = 'rookie-drafted';
        targetOvr = draftPickOvr(draftPick.pick);
        // Older rookies are usually a little more ready; teenagers get the raw curve.
        if (espnPlayer.age >= 23) targetOvr += 1;
        if (espnPlayer.age <= 19) targetOvr -= 1;
        targetOvr = clamp(targetOvr, 65, 84);
        const pos = newPlayerPosition(espnPlayer.pos, draftInfo && draftInfo.pos, espnPlayer.height);
        const attrs = buildAttributes(targetOvr, pos, 'rookie|' + draftPick.pick + '|' + espnPlayer.name, pool, null);
        player = {
          name: espnPlayer.name,
          cname,
          pos,
          height: normalizeHeight(espnPlayer.height),
          type: archetypeFor(pos),
          ovr: targetOvr,
          ...attrs,
        };
        sample = { games: 0, minutes: 0, basis: '2026-27-rookie' };
      } else if (VETERAN_PROFILES[espnPlayer.name]) {
        kind = 'new-veteran';
        const profile = VETERAN_PROFILES[espnPlayer.name];
        targetOvr = profile.ovr;
        const pos = profile.pos || newPlayerPosition(espnPlayer.pos, null, espnPlayer.height);
        const attrs = buildAttributes(targetOvr, pos, 'veteran|' + espnPlayer.name, pool, profile.overrides);
        player = {
          name: espnPlayer.name,
          cname,
          pos,
          height: normalizeHeight(espnPlayer.height),
          type: profile.type || archetypeFor(pos),
          ovr: targetOvr,
          ...attrs,
        };
        sample = seasonSampleFromStats(espnPlayer.name, stats.perByName);
      } else {
        kind = espnPlayer.exp === 0 ? 'rookie-undrafted' : 'new-veteran';
        targetOvr = espnPlayer.exp === 0 ? undraftedOvr(espnPlayer.age) : clamp(68 + Math.floor((espnPlayer.age - 24) / 3), 66, 72);
        const pos = newPlayerPosition(espnPlayer.pos, null, espnPlayer.height);
        const attrs = buildAttributes(targetOvr, pos, kind + '|' + espnPlayer.name, pool, null);
        player = {
          name: espnPlayer.name,
          cname,
          pos,
          height: normalizeHeight(espnPlayer.height),
          type: archetypeFor(pos),
          ovr: targetOvr,
          ...attrs,
        };
        sample = seasonSampleFromStats(espnPlayer.name, stats.perByName);
      }

      player.age = espnPlayer.age;
      player._age = espnPlayer.age;
      player._enterYear = 2026 - Math.max(0, espnPlayer.exp);
      player.espnId = espnPlayer.espnId;

      if (isDraftedRookie) {
        const manifest = manifestByPick.get(draftPick.pick);
        player.draftPick = draftPick.pick;
        if (manifest) {
          player.nbaId = number(manifest.nbaId, 0) || undefined;
          player.photoLocal = manifest.photoLocal || undefined;
          player.photoUrl = manifest.photoUrl || undefined;
          player.photoSource = 'nba-official-draft-profile';
          player.photoStatus = 'cached';
        }
      } else if (isNew) {
        const imageId = imageByNorm.get(norm);
        if (imageId) {
          player.nbaId = imageId;
        } else if (espnPlayer.headshot) {
          player.photoLocal = espnPlayer.headshot;
          player.photoSource = 'espn-headshot';
        }
      }

      player.ratingSeason = SEASON;
      player.ratingBasis = sample.basis;
      player.ratingSampleGames = sample.games;
      player.ratingSampleMinutes = sample.minutes;

      // Remove undefined values so the generated JS stays clean.
      for (const key of Object.keys(player)) {
        if (player[key] === undefined) delete player[key];
      }

      teams[team].push(player);
      const key = team + '|' + player.name;
      ratingOutput[key] = { ovr: player.ovr, ...Object.fromEntries(ATTRS.map(attr => [attr, player[attr]])) };
      sampleOutput[key] = sample;

      if (isNew) {
        reportNew.push({
          team,
          name: espnPlayer.name,
          cname: player.cname,
          age: espnPlayer.age,
          exp: espnPlayer.exp,
          draftPick: isDraftedRookie ? draftPick.pick : null,
          kind,
          pos: player.pos,
          ovr: player.ovr,
          attrs: Object.fromEntries(ATTRS.map(attr => [attr, player[attr]])),
          ratingBasis: sample.basis,
        });
      }
    }
  }

  return { teams, ratingOutput, sampleOutput, reportNew, reportMatched };
}

function serializeRoster(teams) {
  const lines = [];
  lines.push('/* ============================================================');
  lines.push(' * 2026-27 NBA current rosters.');
  lines.push(' * Auto-generated by tools/update_2026_27_rosters.mjs.');
  lines.push(' * Sources: ESPN 2026-27 team rosters + 2026 NBA draft class.');
  lines.push(' * Ratings: returning players keep their 2025-26 performance ratings;');
  lines.push(' * new rookies use the 2026 draft pick curve.');
  lines.push(' * ============================================================ */');
  lines.push('const NBA2K_DATA = {');
  lines.push('');
  for (const team of TEAM_ORDER) {
    lines.push('  "' + team + '": [');
    for (const player of teams[team]) {
      lines.push('    {');
      const fields = [];
      for (const [key, value] of Object.entries(player)) {
        if (value === undefined) continue;
        fields.push('      "' + key + '": ' + JSON.stringify(value));
      }
      lines.push(fields.join(',\r\n'));
      lines.push('    },');
      lines.push('');
    }
    lines.push('  ],');
    lines.push('');
  }
  lines.push('};');
  lines.push('');
  lines.push('const NBA2K_TEAMS = Object.keys(NBA2K_DATA);');
  return lines.join('\r\n');
}

function serializeRatings(meta, ratings, samples) {
  return '/* Auto-generated by tools/update_2026_27_rosters.mjs. */\n' +
    'const NBA_CURRENT_RATINGS_2026_META = ' + JSON.stringify(meta, null, 2) + ';\n' +
    'const NBA_CURRENT_RATINGS_2026 = ' + JSON.stringify(ratings) + ';\n' +
    'const NBA_CURRENT_RATINGS_2026_SAMPLES = ' + JSON.stringify(samples) + ';\n' +
    '(function applyCurrentPlayerRatings2026() {\n' +
    '  if (typeof NBA2K_DATA === \'undefined\') return;\n' +
    '  Object.keys(NBA2K_DATA).forEach(function(team) {\n' +
    '    (NBA2K_DATA[team] || []).forEach(function(player) {\n' +
    '      var key = team + \'|\' + player.name;\n' +
    '      var rating = NBA_CURRENT_RATINGS_2026[key];\n' +
    '      if (!rating) return;\n' +
    '      Object.keys(rating).forEach(function(attr) { player[attr] = rating[attr]; });\n' +
    '      var sample = NBA_CURRENT_RATINGS_2026_SAMPLES[key] || {};\n' +
    '      player.ratingSeason = NBA_CURRENT_RATINGS_2026_META.season;\n' +
    '      player.ratingBasis = sample.basis || \'2025-26-season\';\n' +
    '      player.ratingSampleGames = sample.games || 0;\n' +
    '      player.ratingSampleMinutes = sample.minutes || 0;\n' +
    '    });\n' +
    '  });\n' +
    '  if (typeof window !== \'undefined\') {\n' +
    '    window.NBA_CURRENT_RATINGS_2026_META = NBA_CURRENT_RATINGS_2026_META;\n' +
    '    window.NBA_2026_27_ROSTERS_APPLIED = true;\n' +
    '    window.NBA_2026_27_ROSTERS_META = NBA_CURRENT_RATINGS_2026_META;\n' +
    '  }\n' +
    '})();\n';
}

async function localizeNbaHeadshots(teams) {
  const dir = path.join(ROOT, 'assets/images/Player/nba-official');
  fs.mkdirSync(dir, { recursive: true });
  for (const roster of Object.values(teams)) {
    for (const player of roster) {
      if (!player.nbaId) continue;
      const localPath = path.join(dir, player.nbaId + '.png');
      if (fs.existsSync(localPath)) continue;
      try {
        const response = await fetch('https://cdn.nba.com/headshots/nba/latest/260x190/' + player.nbaId + '.png', {
          headers: { 'User-Agent': 'perfect-player-roster-updater/1.0', 'Accept': 'image/png,image/*' },
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        fs.writeFileSync(localPath, Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        console.warn('NBA headshot download failed for ' + player.name + ': ' + error.message);
      }
    }
  }
}

async function localizeEspnHeadshots(teams) {
  fs.mkdirSync(ESPN_HEADSHOT_DIR, { recursive: true });
  for (const roster of Object.values(teams)) {
    for (const player of roster) {
      if (!player.photoLocal || !/^https?:\/\//.test(player.photoLocal)) continue;
      const fileName = String(player.espnId || hashText(player.name)) + '.png';
      const localPath = path.join(ESPN_HEADSHOT_DIR, fileName);
      if (!fs.existsSync(localPath)) {
        try {
          const response = await fetch(player.photoLocal, {
            headers: { 'User-Agent': 'perfect-player-roster-updater/1.0', 'Accept': 'image/png,image/*' },
          });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          fs.writeFileSync(localPath, Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.warn('Headshot download failed for ' + player.name + ': ' + error.message);
          continue;
        }
      }
      player.photoLocal = 'assets/images/Player/espn-current/' + fileName;
    }
  }
}

async function main() {
  const localRoster = loadLocalRoster();
  const { ratings, samples, meta: existingMeta } = loadRatings();
  if (existingMeta.season === SEASON) {
    throw new Error(
      '当前输入已经是 ' + SEASON + ' 生成结果。请先从 git 恢复上一赛季的名单和评分基线，再重新运行，' +
      '否则所有球员都会被误判为回归球员。'
    );
  }
  const draftClass = loadDraftClass();
  const dictionary = loadChineseNameDictionary();
  const playerImages = loadPlayerImages();
  const stats = load2025_26Stats();
  const draftManifest = JSON.parse(fs.readFileSync(DRAFT_MANIFEST_PATH, 'utf8'));
  const [espnRosters, draftPicks] = await Promise.all([loadEspnRosters(), loadDraft()]);

  const built = buildRoster({
    localRoster, ratings, samples, draftClass, draftPicks, espnRosters,
    dictionary, playerImages, stats, draftManifest,
  });
  await localizeNbaHeadshots(built.teams);
  await localizeEspnHeadshots(built.teams);

  const allPlayers = Object.values(built.teams).flat();
  const sampleBasis = Object.values(built.sampleOutput);
  const noGames = sampleBasis.filter(sample => sample.basis === 'no-2025-26-games').length;
  const seasonMatches = sampleBasis.filter(sample => sample.basis.indexOf('2025-26') === 0 && sample.games > 0).length;
  const rookies = built.reportNew.filter(player => player.kind.indexOf('rookie') === 0).length;
  const newVeterans = built.reportNew.filter(player => player.kind === 'new-veteran').length;

  const meta = {
    season: SEASON,
    seasonType: 'Regular Season',
    generated: new Date().toISOString().slice(0, 10),
    players: allPlayers.length,
    teams: TEAM_ORDER.length,
    returningPlayers: built.reportMatched.length,
    newPlayers: built.reportNew.length,
    rookies,
    newVeterans,
    directMatches: built.reportMatched.length,
    seasonMatches,
    noSeasonGames: noGames,
    rosterSource: 'ESPN 2026-27 NBA team rosters',
    rosterSourceUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    ratingBasis: RATING_BASIS,
    rookieRatingBasis: '2026 NBA draft pick curve (no NBA sample yet)',
    leagueBaseline: {
      pointsPerGame: 115.6,
      pace: 99.4,
      offensiveRating: 115.7,
      threePointPct: 0.360,
      effectiveFgPct: 0.546,
    },
    sources: [
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
      'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/draft?season=2026',
      'https://www.basketball-reference.com/leagues/NBA_2026_per_game.html',
      'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html',
      'https://www.basketball-reference.com/leagues/NBA_2026_shooting.html',
    ],
  };

  const report = {
    _meta: {
      season: SEASON,
      generatedAt: new Date().toISOString(),
      sources: meta.sources,
      counts: {
        players: allPlayers.length,
        teams: TEAM_ORDER.length,
        returning: built.reportMatched.length,
        newPlayers: built.reportNew.length,
        rookies,
        newVeterans,
        noGames,
        seasonMatches,
      },
    },
    teams: Object.fromEntries(TEAM_ORDER.map(team => {
      const list = built.teams[team];
      return [team, {
        players: list.length,
        returning: list.filter(player => !built.reportNew.some(entry => entry.team === team && entry.name === player.name)).length,
        newPlayers: list.filter(player => built.reportNew.some(entry => entry.team === team && entry.name === player.name)).length,
      }];
    })),
    newPlayers: built.reportNew,
    returningPlayers: built.reportMatched,
    droppedPlayers: (() => {
      const current = new Set(Object.values(built.teams).flat().map(player => normalizeName(player.name)));
      return csvPlayers(localRoster)
        .filter(player => !current.has(normalizeName(player.name)))
        .map(player => ({ team: player.team, name: player.name, cname: player.cname, ovr: player.ovr }))
        .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
    })(),
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  if (DRY_RUN) {
    console.log('Dry run complete.');
    console.log(JSON.stringify(meta, null, 2));
    console.log('Report:', path.relative(ROOT, REPORT_PATH));
    return;
  }

  fs.writeFileSync(ROSTER_PATH, serializeRoster(built.teams), 'utf8');
  fs.writeFileSync(RATINGS_PATH, serializeRatings(meta, built.ratingOutput, built.sampleOutput), 'utf8');
  console.log(JSON.stringify(meta, null, 2));
  console.log('Wrote:', path.relative(ROOT, ROSTER_PATH));
  console.log('Wrote:', path.relative(ROOT, RATINGS_PATH));
  console.log('Report:', path.relative(ROOT, REPORT_PATH));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
