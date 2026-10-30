/* ============================================================
 * Refresh the build-phase current-player pool to 2026-27.
 *
 * The 150 historical peak cards stay untouched. Only each team's
 * 12 current players are rebuilt from the generated NBA2K_DATA.
 *
 * Selection:
 *   - top two players at each of PG/SG/SF/PF/C
 *   - fill the remaining two slots with the best available players
 *   - sort the final 12 by OVR
 *
 * Usage:
 *   node tools/update_2026_27_build_pool.mjs
 *   node tools/update_2026_27_build_pool.mjs --dry-run
 * ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(TOOL_DIR);
const POOL_PATH = path.join(ROOT, 'assets/data/perfect-player-pool.json');
const ROSTER_PATH = path.join(ROOT, 'assets/js/hupu/script-01-2678-5hu3djrc-upload-1783494754597-12.js');
const IMAGES_PATH = path.join(ROOT, 'assets/data/nba-player-images.js');
const HTML_PATH = path.join(ROOT, 'nba-perfect-player.html');

const SEASON = '2026-27';
const DRY_RUN = process.argv.includes('--dry-run');

const TEAM_ID_TO_ABBR = {
  1: 'BOS', 2: 'BKN', 3: 'NYK', 4: 'PHI', 5: 'TOR',
  6: 'CHI', 7: 'CLE', 8: 'DET', 9: 'IND', 10: 'MIL',
  11: 'ATL', 12: 'CHA', 13: 'MIA', 14: 'ORL', 15: 'WAS',
  16: 'DEN', 17: 'MIN', 18: 'OKC', 19: 'POR', 20: 'UTA',
  21: 'GSW', 22: 'LAC', 23: 'LAL', 24: 'PHX', 25: 'SAC',
  26: 'DAL', 27: 'HOU', 28: 'MEM', 29: 'NOP', 30: 'SAS',
};

const POS_TO_NUM = { PG: 1, SG: 2, SF: 3, PF: 4, C: 5 };
const ATTRS = ['threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const num = (value, fallback = 50) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function reverseNameKey(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return parts.length < 2 ? '' : parts[parts.length - 1] + parts.slice(0, -1).join('');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function evalObject(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Marker not found: ' + marker);
  const objStart = source.indexOf('{', start);
  const objEnd = source.indexOf('};', objStart);
  if (objStart < 0 || objEnd < 0) throw new Error('Object end not found for: ' + marker);
  return new Function('return (' + source.slice(objStart, objEnd + 1) + ')')();
}

function loadRoster() {
  const source = fs.readFileSync(ROSTER_PATH, 'utf8');
  const start = source.indexOf('const NBA2K_DATA =');
  const end = source.indexOf('const NBA2K_TEAMS', start);
  if (start < 0 || end < 0) throw new Error('NBA2K_DATA not found');
  return new Function('return (' + source.slice(source.indexOf('{', start), end).replace(/;?\s*$/, '') + ')')();
}

function loadImages() {
  const source = fs.readFileSync(IMAGES_PATH, 'utf8').trim();
  const body = source.replace(/^var\s+NBA_PLAYER_IMAGES\s*=\s*/, '').replace(/;?\s*$/, '');
  return new Function('return (' + body + ')')();
}

function loadHeadshotIdFix() {
  return evalObject(fs.readFileSync(HTML_PATH, 'utf8'), 'var PERFECT_PLAYER_HEADSHOT_ID_FIX =');
}

function photoExists(relativePath) {
  return !!relativePath && !/^https?:\/\//.test(relativePath) && fs.existsSync(path.join(ROOT, relativePath));
}

function zeroHonors() {
  return {
    rings: 0, mvp: 0, fmvp: 0, dpoy: 0, roy: 0,
    allStar: 0, allStarMvp: 0, allNba1: 0, allNba2: 0, allNba3: 0,
    allDefensive: 0, scoring: 0, rebound: 0, assist: 0, block: 0,
    steal: 0, sixthMan: 0,
  };
}

function selectCurrentRoster(roster) {
  const sorted = roster.filter(player => player && player.name).slice().sort((a, b) => num(b.ovr) - num(a.ovr));
  const picked = [];
  const used = new Set();
  for (const position of ['PG', 'SG', 'SF', 'PF', 'C']) {
    let count = 0;
    for (const player of sorted) {
      if (count >= 2) break;
      if (used.has(player.name)) continue;
      const primary = String(player.pos || '').split('/')[0].trim();
      if (primary !== position) continue;
      picked.push(player);
      used.add(player.name);
      count++;
    }
  }
  for (const player of sorted) {
    if (picked.length >= 12) break;
    if (used.has(player.name)) continue;
    picked.push(player);
    used.add(player.name);
  }
  return picked.slice(0, 12).sort((a, b) => num(b.ovr) - num(a.ovr));
}

function positionNumbers(pos) {
  const parts = String(pos || 'SF').split('/').map(part => part.trim()).filter(Boolean);
  const primary = POS_TO_NUM[parts[0]] || 3;
  const secondary = POS_TO_NUM[parts[1]] || primary;
  return { pos: primary, pos2: secondary };
}

function thirteenToTen(player) {
  const average = (a, b) => Math.round((num(a) + num(b)) / 2);
  return {
    pass: clamp(num(player.PAS, 55), 25, 99),
    shotInt: clamp(num(player.MID, 55), 25, 99),
    shotExt: clamp(num(player.threePT, 55), 25, 99),
    shotFree: clamp(average(average(player.threePT, player.MID), player.FIN), 25, 99),
    physique: clamp(average(player.ATH, player.STR), 25, 99),
    blk: clamp(num(player.BLK, 55), 25, 99),
    reb: clamp(num(player.REB, 55), 25, 99),
    stl: clamp(average(player.PDEF, player.CLU), 25, 99),
    speed: clamp(num(player.ATH, 55), 25, 99),
    strength: clamp(num(player.STR, 55), 25, 99),
  };
}

function main() {
  const pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8'));
  const league = loadRoster();
  const images = loadImages();
  const headshotFix = loadHeadshotIdFix();

  const imageIndex = new Map();
  for (const [name, id] of Object.entries(images)) {
    imageIndex.set(normalizeName(name), num(id, 0));
    const parts = name.split(/\s*,\s*/);
    if (parts.length === 2) {
      imageIndex.set(normalizeName(parts[1] + ' ' + parts[0]), num(id, 0));
      imageIndex.set(normalizeName(parts[1] + parts[0]), num(id, 0));
    }
  }

  const oldByName = new Map();
  let maxId = 0;
  for (const team of Object.values(pool.teams)) {
    for (const player of team.players.concat(team.historicalPlayers || [])) {
      maxId = Math.max(maxId, num(player.id, 0));
      if (player.nameEn) oldByName.set(normalizeName(player.nameEn), player);
    }
  }

  function resolveNbaId(player) {
    return num(player.nbaId, 0) ||
      num(images[player.name], 0) ||
      num(imageIndex.get(normalizeName(player.name)), 0) ||
      num(imageIndex.get(reverseNameKey(player.name)), 0) ||
      num(headshotFix[player.name], 0);
  }

  function resolvePhoto(player, nbaId, old) {
    if (old && photoExists(old.photoLocal)) {
      return { photoLocal: old.photoLocal, fallbackPhotoLocal: old.fallbackPhotoLocal || '', photoSource: old.photoSource || 'hupu-buildplayer-nba-cdn' };
    }
    if (photoExists(player.photoLocal)) {
      return { photoLocal: player.photoLocal, fallbackPhotoLocal: '', photoSource: player.photoSource || 'nba-official-headshot' };
    }
    const official = nbaId ? 'assets/images/Player/nba-official/' + nbaId + '.png' : '';
    if (photoExists(official)) {
      return { photoLocal: official, fallbackPhotoLocal: '', photoSource: 'nba-official-headshot' };
    }
    if (old && photoExists(old.fallbackPhotoLocal)) {
      return { photoLocal: old.fallbackPhotoLocal, fallbackPhotoLocal: '', photoSource: 'local-cache' };
    }
    return { photoLocal: '', fallbackPhotoLocal: '', photoSource: '' };
  }

  const warnings = [];
  const report = {
    season: SEASON,
    teams: 0,
    current: 0,
    rookies: 0,
    newEntrants: 0,
    dropped: 0,
  };
  const nextIds = new Map();

  for (const [teamIdText, team] of Object.entries(pool.teams)) {
    const teamId = num(teamIdText, 0);
    const abbr = TEAM_ID_TO_ABBR[teamId];
    const roster = league[abbr];
    if (!abbr || !Array.isArray(roster)) {
      warnings.push('Missing 2026-27 roster for team ' + teamId + ' (' + team.name + ')');
      continue;
    }

    const picked = selectCurrentRoster(roster);
    if (picked.length !== 12) warnings.push(abbr + ' selected ' + picked.length + ' players');

    const oldTeamNames = new Set((team.players || []).map(player => player.nameEn));
    const newTeamNames = new Set(picked.map(player => player.name));

    team.players = picked.map(player => {
      const old = oldByName.get(normalizeName(player.name));
      const nbaId = resolveNbaId(player);
      const photo = resolvePhoto(player, nbaId, old);
      if (!photo.photoLocal) warnings.push(abbr + ' ' + player.name + ' has no local headshot');
      const positions = positionNumbers(player.pos);
      const enterYear = num(player._enterYear, 2026);
      const rating = clamp(num(player.ovr, 70), 50, 99);
      if (old) {
        nextIds.set(player.name, old.id);
      } else if (!nextIds.has(player.name)) {
        nextIds.set(player.name, ++maxId);
      }
      const id = nextIds.get(player.name);
      const identity = (old && old.identity) || ('nba:' + slugify(player.name));
      const honors = (old && old.honors) || zeroHonors();
      return {
        id,
        uid: 'pp_1_' + teamId + '_' + identity,
        identity,
        name: player.cname || player.name,
        nameCn: player.cname || player.name,
        nameEn: player.name,
        altName: player.name,
        teamId,
        pos: positions.pos,
        pos2: positions.pos2,
        rating,
        age: num(player._age, num(player.age, 22)),
        yearsLeague: Math.max(0, 2026 - enterYear),
        draftYear: (old && num(old.draftYear, 0)) || enterYear,
        image: (old && num(old.image, 0)) || 0,
        photoLocal: photo.photoLocal,
        fallbackPhotoLocal: photo.fallbackPhotoLocal,
        photoUrl: nbaId ? 'https://cdn.nba.com/headshots/nba/latest/260x190/' + nbaId + '.png' : (player.photoUrl || ''),
        photoSource: photo.photoSource,
        nbaId: nbaId || undefined,
        attrs: thirteenToTen(player),
        honors,
        source: {
          kind: 'current',
          code: 1,
          year: 2026,
          label: SEASON,
          file: 'ESPN 2026-27 roster',
        },
        historicalTeams: (old && old.historicalTeams) || [teamId],
        starScore: (old && num(old.starScore, 0)) || Math.max(0, Math.round((rating - 50) * 2.2)),
        ratingBasis: player.ratingBasis || '2025-26-season',
      };
    });

    for (const player of team.players) {
      if (player.nbaId === undefined) delete player.nbaId;
      if (player.ratingBasis === '2026-27-rookie') report.rookies++;
      if (!oldByName.has(normalizeName(player.nameEn))) report.newEntrants++;
    }
    for (const name of oldTeamNames) {
      if (!newTeamNames.has(name)) report.dropped++;
    }
    report.teams++;
    report.current += team.players.length;
  }

  pool.version = 2;
  pool.generatedAt = new Date().toISOString();
  pool.rules.currentSeason = SEASON;
  pool.rules.currentSource = 'ESPN 2026-27 team rosters';
  pool.rules.currentTarget = 12;
  if (Array.isArray(pool.seasons) && pool.seasons[0]) {
    pool.seasons[0] = { code: 1, year: 2026, label: SEASON, file: 'ESPN 2026-27 roster', kind: 'current' };
  }
  pool.currentPoolReport = { ...report, generatedAt: pool.generatedAt };
  pool.warnings = (pool.warnings || []).filter(item => !/current|2025-26|roster/i.test(String(item))).concat(warnings);

  console.log(JSON.stringify({ ...report, warnings: warnings.length }, null, 2));
  if (warnings.length) warnings.slice(0, 20).forEach(warning => console.warn('WARN ' + warning));

  if (DRY_RUN) return;
  fs.writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2) + '\n', 'utf8');
  console.log('Wrote:', path.relative(ROOT, POOL_PATH));
}

main();
