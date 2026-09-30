/* ========================================================================
 * 完美球员 · 青训阶段 + 关键比赛逐回合模拟
 * ------------------------------------------------------------------------
 * 本文件包含两个模块：
 *
 *  1) 青训阶段（移植自 basketballCareerSimulator 的青训逻辑）
 *     - 球员进入 NBA 生涯前先经历一段青训营，通过若干次决策
 *       决定自己的属性成长，再进入选秀/球队流程。
 *
 *  2) 关键比赛逐回合模拟（移植自 NBA-Sim-Web 的单场模拟逻辑）
 *     - 以“逐回合”方式模拟单场比赛（暂停、发球、投篮、篮板、
 *       抢断、封盖、犯规、罚球），并生成分节比分与个人 Box Score。
 *     - 仅在季后赛/附加赛的关键场次（晋级轮、淘汰轮、抢七）使用：
 *       · 附加赛 7vs8 / 9vs10 / 败者组决赛（均为单场淘汰）
 *       · 季后赛任何一场“赛点/淘汰点”比赛（winsA===3 || winsB===3）
 *       · 季后赛 G7（gameNum === 6）
 * ======================================================================== */
(function () {
  'use strict';

  var hasShown = false;
  function logOnce(msg) {
    if (hasShown) return;
    hasShown = true;
    console.log('[PerfectPlayer] ' + msg);
  }

  /* ======================================================================
   * 模块 1 · 关键比赛逐回合模拟（NBA-Sim-Web 移植）
   * ====================================================================== */

  // ---------- 常量（移植自 NBA-Sim-Web Constants.ts） ----------
  var K = {
    PLAYER_STAR_LB: 90,
    DUNK_SUM_LB: 60, DUNK_SUM_UB: 160, DUNK_EXCEL_LB: 90,
    TIME_LEFT_CLUTCH: 420, CLOSE_GAME_DIFF: 15,
    MAJOR_SCORE_FACTOR: 0.55, MINOR_SCORE_FACTOR: 0.15, CLUTCH_PERCENT: 25, RATING_RANGE: 15, AST_SCALE: 2,
    REBOUND_POWER_SCALE: 0.8,
    SAME_POS: 60, OTHER_POS: 10,
    DEFENSE_MATCHUP_SAME_POS: 50,
    JUMP_BALL_PLAY: 60, TURNOVER: 4, STEAL_BASE: 1, STEAL_RATING_SCALE: 4, STEAL_DEFENSE_SCALE: 2,
    STEAL_BONUS_SCALE1: 1.15, STEAL_BONUS_SCALE2: 1.3, STEAL_BONUS_SCALE3: 1.4, STEAL_BONUS_SCALE4: 1.5,
    STEAL_BONUS_THLD1: 83, STEAL_BONUS_THLD2: 87, STEAL_BONUS_THLD3: 92, STEAL_BONUS_THLD4: 95,
    NON_FASTBREAK: 30,
    BLOCK_RATING_SCALE: 3,
    BLOCK_BONUS_SCALE1: 1.4, BLOCK_BONUS_SCALE2: 1.7, BLOCK_BONUS_SCALE3: 2.2, BLOCK_BONUS_SCALE4: 3, BLOCK_BONUS_SCALE5: 3.8,
    BLOCK_BONUS_THLD1: 70, BLOCK_BONUS_THLD2: 83, BLOCK_BONUS_THLD3: 88, BLOCK_BONUS_THLD4: 92, BLOCK_BONUS_THLD5: 95,
    BLOCK_OUT_OF_BOUND: 40,
    ORB_WITH_BONUS: 15, ORB_WITHOUT_BONUS: 10, REBOUND_RATING_BONUS: 90, REBOUND_RATING_BONUS_PERCENT: 10,
    OFF_FOUL: 2, DEF_FOUL: 2,
    MIN_CLOSE_SHOT: 1, MAX_CLOSE_SHOT: 12, MIN_MID_SHOT: 13, MID_MID_SHOT: 20, MAX_MID_SHOT: 22,
    MIN_THREE_SHOT: 23, MID_THREE_SHOT: 26, MAX_THREE_SHOT: 35, MIN_DIST_CURVE: 28, DIST_CURVE_PERCENT: 90, DIST_CURVE: 5,
    TYPE3_PERCENT: 30, TYPE4_CLOSE_SHOT: 40, TYPE4_MID_SHOT: 15, TYPE5_CLOSE_SHOT: 20, TYPE5_MID_SHOT: 20,
    INIT_CLOSE_SHOT_COFF: -0.15, INIT_CLOSE_SHOT_INTCP: 37, INIT_MID_SHOT_INTCP: 10, INIT_THREE_SHOT_COFF: 0, INIT_THREE_SHOT_INTCP: 41,
    DUNK_SCALE: 2.5, SHOT_COFF: 0.2, OFFENSE_BASE: 65,
    ELITE_PLAYMAKER_THRESHOLD: 86, ELITE_PLAYMAKER_SINGLE_BONUS: 1.0, ELITE_PLAYMAKER_DUAL_BONUS: 4.0,
    DEFENSE_COFF: 0.15, DEFENSE_BASE: 40,
    DEFENSE_EASY: 10, DEFENSE_HARD: 50, DEFENSE_BUFF: 12,
    PLAYOFF_DEFENSE_EASY: 5, PLAYOFF_DEFENSE_HARD: 55,
    ELITE_PERIMETER_DEF_THRESHOLD: 85, ELITE_PERIMETER_DEF_MIN_COUNT: 3, ELITE_PERIMETER_DEF_BONUS: 5.0,
    LOCKDOWN_STL_BLK_THRESHOLD: 90, LOCKDOWN_DEF_CONST_THRESHOLD: 90,
    LOCKDOWN_INTERIOR_DEF_THRESHOLD: 80, LOCKDOWN_PERIMETER_DEF_THRESHOLD: 80,
    LOCKDOWN_DIRECT_PENALTY: 6.0, LOCKDOWN_DETERRENCE_PENALTY: 2.0,
    TEAM_SPACING_BASE: 72, TEAM_SPACING_SCALE: 0.12, TEAM_SPACING_MAX_BONUS: 2.0,
    ELITE_ROTATION_MID_THRESHOLD: 80, ELITE_ROTATION_THREE_THRESHOLD: 75,
    ELITE_ROTATION_OFF_CONST_THRESHOLD: 90, ELITE_ROTATION_OFF_CONST_MIN_COUNT: 3, ELITE_ROTATION_AVG_THREE_THRESHOLD: 85, ELITE_ROTATION_BONUS: 3.0,
    INSIDE_OUT_ELITE_LAYUP: 90, INSIDE_OUT_BASE_LAYUP: 79, INSIDE_OUT_ELITE_COUNT: 2, INSIDE_OUT_SPACING_BONUS: 5.0,
    OFF_CONSISTENCY_COFF: 0.5, OFF_CONSISTENCY_MAX_BONUS: 2.5, DEF_CONSISTENCY_COFF: 0.4, DEF_CONSISTENCY_MAX_BONUS: 2, CONSISTENCY_BASE: 50,
    CLUTCH_SHOT_COFF: 0.6,
    HOME_COURT_BOOST: 0.75, AWAY_COURT_PENALTY: 0.75,
    HIGH_BOTH_RATING: 33, HIGH_BOTH_RATING_THLD: 89, HIGHEST_RATING_PERCENT: 10, STAR_PLAYER_AST: 75, NON_STAR_PLAYER_AST: 95,
    AND_ONE_CLOSE_BASE: 5, AND_ONE_MID_BASE: 2, AND_ONE_THREE_BASE: 1,
    NORMAL_CLOSE_BASE: 10, NORMAL_MID_BASE: 6, NORMAL_THREE_BASE: 2,
    FOUL_RATING_THLD1: 94, FOUL_RATING_THLD2: 85, FOUL_COFF1: 3.8, FOUL_COFF2: 3.3, FOUL_COFF3: 2.8, STAR_FOUL_SCALE: 1.1,
    FOULS_TO_FOUL_OUT: 6, BONUS_FOUL_THRESHOLD: 5, JUMP_BALL_FIFTY_FIFTY: 50,
    STAR_DEFENSE_FOCUS_PENALTY: 3.0,
    STAR_SELECTION_DECAY_POWER: 0.85,
    PLAYOFF_PACE_SLOWDOWN: 1.0,
    QUARTER_SECONDS: 720,
    ROTATION_START_SECONDS: 480 // 首发 0:00-8:00，替补 8:00-12:00
  };

  // 球员类型（与 NBA-Sim-Web 一致）
  var PT = { ALL_ROUNDED: 1, INSIDER: 2, MID_RANGE: 3, INSIDE_OUTSIDE: 4, OUTSIDER: 5 };

  function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v) || 0)); }
  function ppAttr(p, key, fallback) {
    var v = parseInt(p && p[key]);
    return !isNaN(v) ? v : (typeof fallback === 'number' ? fallback : 65);
  }
  function mainPos(pos) {
    var p = String(pos || 'SF').split('/')[0].trim().toUpperCase();
    return ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(p) >= 0 ? p : 'SF';
  }
  function isStarRating(ovr) { return ovr >= K.PLAYER_STAR_LB; }

  function derivePlayerType(threePT, MID, FIN, DNK) {
    var close = FIN * 0.7 + DNK * 0.3;
    if (threePT >= 82 && close >= 82) return PT.INSIDE_OUTSIDE;
    if (threePT >= 82) return PT.OUTSIDER;
    if (close >= 82) return PT.INSIDER;
    if (MID >= 80) return PT.MID_RANGE;
    return PT.ALL_ROUNDED;
  }

  /** 把 perfect-player 的球员对象转换为逐回合引擎所需的球员对象 */
  function buildKeyPlayer(p, teamAbbr) {
    var ovr = ppAttr(p, 'ovr', 72);
    var threePT = ppAttr(p, 'threePT', ovr);
    var MID = ppAttr(p, 'MID', ovr);
    var FIN = ppAttr(p, 'FIN', ovr);
    var DNK = ppAttr(p, 'DNK', ovr);
    var HAN = ppAttr(p, 'HAN', ovr);
    var PAS = ppAttr(p, 'PAS', ovr);
    var PDEF = ppAttr(p, 'PDEF', ovr);
    var IDEF = ppAttr(p, 'IDEF', ovr);
    var BLK = ppAttr(p, 'BLK', ovr);
    var REB = ppAttr(p, 'REB', ovr);
    var ATH = ppAttr(p, 'ATH', ovr);
    var STR = ppAttr(p, 'STR', ovr);
    var CLU = ppAttr(p, 'CLU', ovr);
    var pos = mainPos(p.pos || 'SF');
    var dunkSum = DNK + DNK;
    var dunker = dunkSum <= K.DUNK_SUM_LB ? 1 : (dunkSum >= K.DUNK_SUM_UB || DNK >= K.DUNK_EXCEL_LB) ? 3 : 2;
    var fp = clampInt(62 + CLU * 0.3 + MID * 0.08, 60, 95);
    return {
      name: (p.cname || p.name || '球员'),
      cname: (p.cname || p.name || '球员'),
      teamName: teamAbbr,
      position: pos,
      playerType: derivePlayerType(threePT, MID, FIN, DNK),
      dunkerType: dunker,
      rating: ovr,
      insideRating: clampInt(FIN * 0.7 + DNK * 0.3, 25, 99),
      midRating: clampInt(MID, 25, 99),
      threeRating: clampInt(threePT, 25, 99),
      freeThrowPercent: fp,
      interiorDefense: clampInt(IDEF, 25, 99),
      perimeterDefense: clampInt(PDEF, 25, 99),
      orbRating: clampInt(REB, 25, 99),
      drbRating: clampInt(REB, 25, 99),
      astRating: clampInt(PAS, 25, 99),
      stlRating: clampInt(HAN * 0.5 + PDEF * 0.5, 25, 99),
      blkRating: clampInt(BLK, 25, 99),
      layupRating: clampInt(FIN, 25, 99),
      standDunk: clampInt(DNK, 25, 99),
      drivingDunk: clampInt(DNK, 25, 99),
      athleticism: clampInt(ATH, 25, 99),
      durability: clampInt(STR * 0.5 + ATH * 0.3 + 30, 25, 99),
      offConst: clampInt(CLU, 25, 99),
      defConst: clampInt(IDEF * 0.5 + PDEF * 0.5, 25, 99),
      drawFoul: clampInt(STR * 0.3 + FIN * 0.4 + HAN * 0.3, 25, 99),
      isStar: isStarRating(ovr),
      rotationType: 1,
      _isUser: !!(p && p._isUser),
      // 比赛统计
      score: 0, rebound: 0, offensiveRebound: 0, defensiveRebound: 0,
      assist: 0, steal: 0, block: 0,
      shotMade: 0, shotAttempted: 0, threeMade: 0, threeAttempted: 0,
      freeThrowMade: 0, freeThrowAttempted: 0, turnover: 0, foul: 0, flagFoul: 0,
      secondsPlayed: 0, currentStintSeconds: 0, lastSubbedOutTime: 0,
      canOnCourt: true, hasBeenOnCourt: false, isOnCourt: false
    };
  }

  function resetKeyPlayerStats(player) {
    player.score = 0; player.rebound = 0; player.offensiveRebound = 0; player.defensiveRebound = 0;
    player.assist = 0; player.steal = 0; player.block = 0;
    player.shotMade = 0; player.shotAttempted = 0; player.threeMade = 0; player.threeAttempted = 0;
    player.freeThrowMade = 0; player.freeThrowAttempted = 0; player.turnover = 0; player.foul = 0; player.flagFoul = 0;
    player.secondsPlayed = 0; player.currentStintSeconds = 0; player.lastSubbedOutTime = 0;
    player.canOnCourt = true; player.hasBeenOnCourt = player.rotationType === 1; player.isOnCourt = false;
  }

  /** 从 perfect-player 球队缩写构建引擎球队对象（首发5 + 替补5） */
  function buildKeyTeam(teamAbbr, isUserTeam) {
    var lineup = null;
    try {
      if (typeof calcTeamLineup === 'function') lineup = calcTeamLineup(teamAbbr);
    } catch (e) { lineup = null; }
    var starters = [], bench = [];
    if (lineup && lineup.starters) {
      ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function (pos) {
        if (lineup.starters[pos]) starters.push(lineup.starters[pos]);
      });
    }
    if (lineup && lineup.bench) {
      bench = lineup.bench.slice(0, 5);
    }
    // 兜底：直接从原始名单取
    if (starters.length === 0 && typeof NBA2K_DATA !== 'undefined') {
      var raw = (NBA2K_DATA[teamAbbr] || []).slice().sort(function (a, b) { return (parseInt(b.ovr) || 0) - (parseInt(a.ovr) || 0); });
      var need = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 };
      raw.forEach(function (p) {
        var pos = mainPos(p.pos);
        if (need[pos]) { starters.push(p); need[pos] = 0; }
      });
      raw.forEach(function (p) { if (starters.indexOf(p) < 0) bench.push(p); });
    }
    if (starters.length < 5) {
      // 凑不满 5 人时用高 OVR 球员补齐（罕见情况）
      var filler = (lineup && lineup.allPlayers) || [];
      filler.forEach(function (p) { if (starters.indexOf(p) < 0 && starters.length < 5) starters.push(p); });
    }
    if (bench.length < 5) {
      var allP = (lineup && lineup.allPlayers) || [];
      allP.forEach(function (p) { if (starters.indexOf(p) < 0 && bench.indexOf(p) < 0 && bench.length < 5) bench.push(p); });
    }

    var startList = starters.slice(0, 5).map(function (p) { return buildKeyPlayer(p, teamAbbr); });
    var benchList = bench.slice(0, 5).map(function (p) { return buildKeyPlayer(p, teamAbbr); });
    var players = startList.concat(benchList);
    // 兜底：仍不足 10 人时，用最后一名球员补位（保持阵容完整）
    while (players.length < 10) {
      var last = players[players.length - 1] || buildKeyPlayer({ ovr: 65, pos: 'SF', cname: teamAbbr + '队员' }, teamAbbr);
      var dup = buildKeyPlayer({ ovr: last.rating, pos: last.position, cname: last.name, threePT: last.threeRating, MID: last.midRating, FIN: last.layupRating, DNK: last.standDunk, HAN: 65, PAS: last.astRating, PDEF: last.perimeterDefense, IDEF: last.interiorDefense, BLK: last.blkRating, REB: last.orbRating, ATH: last.athleticism, STR: 65, CLU: last.offConst }, teamAbbr);
      players.push(dup);
    }
    var team = {
      abbr: teamAbbr,
      isUserTeam: !!isUserTeam,
      players: players,
      starters: {},
      benchPlayers: {},
      totalScore: 0, totalShotMade: 0, totalShotAttempted: 0, total3Made: 0, total3Attempted: 0,
      totalScoreAllowed: 0, opponentShotMade: 0, opponentShotAttempted: 0, opponent3Made: 0, opponent3Attempted: 0,
      quarterFoul: 0, hasBall: false, canChallenge: true
    };
    for (var i = 0; i < 5; i++) {
      var st = startList[i];
      var pos = st.position;
      if (!team.starters[pos]) team.starters[pos] = st;
      st.rotationType = 1;
    }
    // 保证 5 个位置都有首发（多位置球员填坑）
    ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function (pos) {
      if (!team.starters[pos]) {
        var candidates = startList.slice().sort(function (a, b) { return b.rating - a.rating; });
        for (var c = 0; c < candidates.length; c++) {
          var already = Object.keys(team.starters).some(function (pp) { return team.starters[pp] === candidates[c]; });
          if (!already) { team.starters[pos] = candidates[c]; break; }
        }
        if (!team.starters[pos] && players.length) team.starters[pos] = players[0];
      }
    });
    for (var j = 0; j < 5; j++) {
      var bp = benchList[j];
      var bpos = bp.position;
      if (!team.benchPlayers[bpos]) team.benchPlayers[bpos] = bp;
      bp.rotationType = 2;
    }
    ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function (pos) {
      if (!team.benchPlayers[pos]) {
        var bc = benchList.slice().sort(function (a, b) { return b.rating - a.rating; });
        for (var cc = 0; cc < bc.length; cc++) {
          var taken = Object.keys(team.benchPlayers).some(function (pp) { return team.benchPlayers[pp] === bc[cc]; });
          if (!taken) { team.benchPlayers[pos] = bc[cc]; break; }
        }
      }
    });
    team.players.forEach(resetKeyPlayerStats);
    return team;
  }

  // ---------- RNG 工具 ----------
  function rint(min, max) {
    min = min == null ? 1 : Math.round(min);
    max = max == null ? 100 : Math.round(max);
    if (min === max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateRandomPlayTime(isPlayoff, isSecondChance, quarterTime) {
    var paceAdjustment = isPlayoff ? K.PLAYOFF_PACE_SLOWDOWN : 0;
    if (!isSecondChance) {
      if (quarterTime <= 24) return quarterTime;
      var roll = rint(1, 100);
      var baseTime;
      if (roll <= 10) return rint(4, 7);
      else if (roll <= 85) {
        var r1 = rint(8, 18), r2 = rint(8, 18);
        baseTime = Math.floor((r1 + r2) / 2);
      } else {
        return rint(19, 24);
      }
      return Math.min(baseTime + paceAdjustment, 24);
    }
    if (quarterTime <= 14) return quarterTime;
    var r2 = rint(1, 100);
    if (r2 <= 50) return rint(4, 6);
    else if (r2 <= 90) {
      var a = rint(7, 11), b = rint(7, 11);
      return Math.floor((a + b) / 2);
    }
    return rint(12, 14);
  }

  // ---------- 攻防球员选择 ----------
  function choosePlayerBasedOnRating(teamOnCourt, attr, currentQuarter, quarterTime, offenseTeam, defenseTeam, isAllStar) {
    var positions = ['C', 'PF', 'SF', 'SG', 'PG'];
    var major = K.MAJOR_SCORE_FACTOR, minor = K.MINOR_SCORE_FACTOR;
    var totalRating = 0;
    positions.forEach(function (pos) {
      var player = teamOnCourt[pos];
      if (!player) return;
      if (attr === 'rating') {
        totalRating += major * player.rating + minor * Math.max(player.insideRating, player.layupRating) +
          minor * Math.max(player.midRating, player.threeRating) + minor * player.offConst;
      } else if (attr === 'orb') totalRating += player.orbRating;
      else if (attr === 'drb') totalRating += player.drbRating;
      else totalRating += player.astRating;
    });
    var avgRating = totalRating / 5;

    if (attr === 'rating') {
      var highestRating = 0;
      positions.forEach(function (pos) { if (teamOnCourt[pos]) highestRating = Math.max(highestRating, teamOnCourt[pos].rating); });
      var list = [];
      positions.forEach(function (pos) {
        var p = teamOnCourt[pos];
        if (p && highestRating - p.rating <= K.RATING_RANGE) list.push(p);
      });
      list.sort(function (a, b) { return b.rating - a.rating; });
      var selected = null;
      if (list.length >= 1) {
        var totalStar = 0;
        list.forEach(function (p) { totalStar += p.rating; });
        var pick = rint(1, totalStar), sum = 0;
        for (var i = 0; i < list.length; i++) {
          sum += list[i].rating;
          if (pick <= sum) { selected = list[i]; break; }
        }
        if (currentQuarter >= 4 && quarterTime <= K.TIME_LEFT_CLUTCH && offenseTeam && defenseTeam &&
          Math.abs(offenseTeam.totalScore - defenseTeam.totalScore) <= K.CLOSE_GAME_DIFF && !isAllStar) {
          if (rint(1, 100) <= K.CLUTCH_PERCENT && selected) return selected;
        }
      }
      var poss = new Array(5).fill(0);
      var basePoss = 100 / 5;
      for (var pi = 0; pi < 5; pi++) {
        var cp = teamOnCourt[positions[pi]];
        if (!cp) { poss[pi] = 0; continue; }
        var effectiveRating = cp.rating;
        if (cp.rating >= K.PLAYER_STAR_LB) {
          effectiveRating = Math.pow(cp.rating, K.STAR_SELECTION_DECAY_POWER) * Math.pow(100, 1 - K.STAR_SELECTION_DECAY_POWER);
        }
        poss[pi] = 10 * (basePoss + major * effectiveRating +
          minor * Math.max(cp.insideRating, cp.layupRating) +
          minor * Math.max(cp.midRating, cp.threeRating) +
          minor * cp.offConst - avgRating);
      }
      return pickByPoss(poss, positions, teamOnCourt);
    }
    var poss2 = new Array(5).fill(0);
    for (var i2 = 0; i2 < 5; i2++) {
      var p2 = teamOnCourt[positions[i2]];
      if (!p2) { poss2[i2] = 0; continue; }
      if (attr === 'orb' || attr === 'drb') {
        var norm = Math.pow(Math.max(p2[attr === 'orb' ? 'orbRating' : 'drbRating'], 1), K.REBOUND_POWER_SCALE);
        poss2[i2] = norm * 100;
      } else {
        poss2[i2] = Math.max((1000 * (K.AST_SCALE * p2.astRating - avgRating)) / totalRating, 0);
      }
    }
    if (attr === 'orb' || attr === 'drb') {
      var tot = poss2.reduce(function (s, v) { return s + v; }, 0);
      if (tot > 0) poss2 = poss2.map(function (v) { return (v / tot) * 1000; });
    }
    return pickByPoss(poss2, positions, teamOnCourt);
  }

  function pickByPoss(poss, positions, teamOnCourt) {
    var pick = rint(1, 1000);
    var acc = 0;
    for (var i = 0; i < 5; i++) {
      acc += poss[i];
      if (pick <= acc && teamOnCourt[positions[i]]) return teamOnCourt[positions[i]];
    }
    for (var j = 0; j < 5; j++) if (teamOnCourt[positions[j]]) return teamOnCourt[positions[j]];
    return teamOnCourt.SF || teamOnCourt.PG || null;
  }

  function chooseDefensePlayer(offensePlayer, defenseOnCourt) {
    var positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    var offIdx = positions.indexOf(offensePlayer.position);
    var sameWeight = K.DEFENSE_MATCHUP_SAME_POS;
    var otherBudget = 100 - sameWeight;
    var inverseSum = 0;
    for (var i = 0; i < 5; i++) { if (i !== offIdx) inverseSum += 1 / Math.abs(i - offIdx); }
    var cumulative = [];
    var sum = 0;
    for (var j = 0; j < 5; j++) {
      if (j === offIdx) sum += sameWeight;
      else sum += (1 / Math.abs(j - offIdx) / inverseSum) * otherBudget;
      cumulative.push(sum);
    }
    var roll = rint(1, 100);
    for (var k = 0; k < 5; k++) {
      if (roll <= cumulative[k] && defenseOnCourt[positions[k]]) return defenseOnCourt[positions[k]];
    }
    return defenseOnCourt[offensePlayer.position] || defenseOnCourt.SF;
  }

  // ---------- 投篮距离 ----------
  function getShotDistance(offensePlayer) {
    var distance = 0;
    var shotChoice = rint(1, 100);
    switch (offensePlayer.playerType) {
      case PT.ALL_ROUNDED:
        distance = rint(K.MIN_CLOSE_SHOT, K.MAX_THREE_SHOT); break;
      case PT.INSIDER:
        distance = rint(K.MIN_CLOSE_SHOT, K.MAX_CLOSE_SHOT); break;
      case PT.MID_RANGE:
        distance = rint(K.MIN_CLOSE_SHOT, K.MID_THREE_SHOT);
        if (distance >= K.MIN_MID_SHOT && rint(1, 100) <= K.TYPE3_PERCENT) distance -= K.MIN_MID_SHOT - K.MIN_CLOSE_SHOT;
        break;
      case PT.INSIDE_OUTSIDE:
        if (shotChoice <= K.TYPE4_CLOSE_SHOT) distance = rint(K.MIN_CLOSE_SHOT, K.MAX_CLOSE_SHOT);
        else if (shotChoice <= K.TYPE4_CLOSE_SHOT + K.TYPE4_MID_SHOT) distance = K.MIN_MID_SHOT;
        else distance = rint(K.MIN_THREE_SHOT, K.MAX_THREE_SHOT);
        break;
      case PT.OUTSIDER:
        if (shotChoice <= K.TYPE5_CLOSE_SHOT) distance = rint(K.MIN_CLOSE_SHOT, K.MAX_CLOSE_SHOT);
        else if (shotChoice <= K.TYPE5_CLOSE_SHOT + K.TYPE5_MID_SHOT) distance = K.MIN_MID_SHOT;
        else distance = rint(K.MIN_THREE_SHOT, K.MAX_THREE_SHOT);
        break;
    }
    if (distance >= K.MIN_DIST_CURVE && rint(1, 100) <= K.DIST_CURVE_PERCENT) distance -= K.DIST_CURVE;
    return distance;
  }

  function getShotType(distance, offensePlayer) {
    if (distance <= K.MAX_CLOSE_SHOT) {
      var dunkScore;
      if (offensePlayer.dunkerType === 3) dunkScore = K.TYPE_3_DUNK || 30;
      else if (offensePlayer.dunkerType === 1) dunkScore = K.TYPE_1_DUNK || 10;
      else dunkScore = K.TYPE_2_DUNK || 20;
      return rint(1, 100) <= dunkScore ? 1 : 2; // 1=DUNK, 2=LAYUP
    }
    return 3; // JUMPER
  }
  K.TYPE_1_DUNK = 10; K.TYPE_2_DUNK = 20; K.TYPE_3_DUNK = 30;

  // ---------- 命中率计算（移植 calculatePercentage） ----------
  function calculateAthleticismImpact(athleticismDiff, distance) {
    var MAX_IMPACT = 4.0, SIGMOID_SCALE = 15.0;
    var sigmoidValue = 2.0 / (1.0 + Math.exp(-athleticismDiff / SIGMOID_SCALE)) - 1.0;
    var distanceWeight;
    if (distance <= K.MAX_CLOSE_SHOT) distanceWeight = 1.0;
    else if (distance <= K.MAX_MID_SHOT) distanceWeight = 0.6;
    else distanceWeight = 0.3;
    return MAX_IMPACT * sigmoidValue * distanceWeight;
  }

  function calculateTeamSpacingBonus(offenseOnCourt) {
    var totalThree = 0, count = 0;
    ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
      var p = offenseOnCourt[pos];
      if (p) { totalThree += p.threeRating; count++; }
    });
    var avgThree = count > 0 ? totalThree / count : K.TEAM_SPACING_BASE;
    var bonus = K.TEAM_SPACING_SCALE * (avgThree - K.TEAM_SPACING_BASE);
    return Math.max(-K.TEAM_SPACING_MAX_BONUS, Math.min(K.TEAM_SPACING_MAX_BONUS, bonus));
  }

  /**
   * 计算投篮命中率（%）。opts 提供主场/客场、加时、关键场次等上下文。
   */
  function calculatePercentage(state, distance, offensePlayer, defensePlayer, offenseOnCourt, shotType, homeTeamOnOffense) {
    var percentage;
    if (distance <= K.MID_MID_SHOT) {
      percentage = K.INIT_CLOSE_SHOT_COFF * distance + K.INIT_CLOSE_SHOT_INTCP;
    } else if (distance <= K.MAX_MID_SHOT) {
      percentage = distance + K.INIT_MID_SHOT_INTCP;
    } else {
      percentage = K.INIT_THREE_SHOT_COFF * (distance - K.MIN_THREE_SHOT) * (distance - K.MIN_THREE_SHOT) + K.INIT_THREE_SHOT_INTCP;
    }

    if (shotType === 1) {
      percentage *= K.DUNK_SCALE;
    } else if (shotType === 2) {
      percentage += K.SHOT_COFF * offensePlayer.layupRating;
    } else {
      if (distance <= K.MAX_CLOSE_SHOT) percentage += K.SHOT_COFF * (offensePlayer.insideRating - K.OFFENSE_BASE);
      else if (distance <= K.MAX_MID_SHOT) percentage += K.SHOT_COFF * (offensePlayer.midRating - K.OFFENSE_BASE);
      else percentage += K.SHOT_COFF * (offensePlayer.threeRating - K.OFFENSE_BASE);
    }

    if (distance <= K.MAX_CLOSE_SHOT) percentage -= K.DEFENSE_COFF * (defensePlayer.interiorDefense - K.DEFENSE_BASE);
    else percentage -= K.DEFENSE_COFF * (defensePlayer.perimeterDefense - K.DEFENSE_BASE);

    var defenseEasy = state.isPlayoff ? K.PLAYOFF_DEFENSE_EASY : K.DEFENSE_EASY;
    var defenseHard = state.isPlayoff ? K.PLAYOFF_DEFENSE_HARD : K.DEFENSE_HARD;
    var temp = rint(1, 100);
    if (temp <= defenseEasy) percentage += K.DEFENSE_BUFF;
    else if (temp <= defenseEasy + defenseHard) percentage -= K.DEFENSE_BUFF;

    // 精英外线防守（无限换防）
    var eliteDefCount = 0;
    var defenseOnCourt = state.defenseOnCourt;
    if (defenseOnCourt) {
      ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
        var p = defenseOnCourt[pos];
        if (p && p.perimeterDefense >= K.ELITE_PERIMETER_DEF_THRESHOLD) eliteDefCount++;
      });
      if (eliteDefCount >= K.ELITE_PERIMETER_DEF_MIN_COUNT) percentage -= K.ELITE_PERIMETER_DEF_BONUS;

      // 顶级双向防守者（锁防）
      function isLockdown(p) {
        return (p.stlRating >= K.LOCKDOWN_STL_BLK_THRESHOLD || p.blkRating >= K.LOCKDOWN_STL_BLK_THRESHOLD) &&
          p.defConst >= K.LOCKDOWN_DEF_CONST_THRESHOLD &&
          p.interiorDefense >= K.LOCKDOWN_INTERIOR_DEF_THRESHOLD &&
          p.perimeterDefense >= K.LOCKDOWN_PERIMETER_DEF_THRESHOLD;
      }
      if (isLockdown(defensePlayer)) {
        percentage -= K.LOCKDOWN_DIRECT_PENALTY;
      } else {
        for (var dd = 0; dd < 5; dd++) {
          var dp = defenseOnCourt[['C', 'PF', 'SF', 'SG', 'PG'][dd]];
          if (dp && dp.position !== defensePlayer.position && isLockdown(dp)) { percentage -= K.LOCKDOWN_DETERRENCE_PENALTY; break; }
        }
      }
    }

    // 稳定性
    var offConsistencyBonus = K.OFF_CONSISTENCY_COFF * (offensePlayer.offConst - K.CONSISTENCY_BASE);
    offConsistencyBonus = Math.max(-K.OFF_CONSISTENCY_MAX_BONUS, Math.min(K.OFF_CONSISTENCY_MAX_BONUS, offConsistencyBonus));
    percentage += offConsistencyBonus;

    var defConsistencyPenalty = K.DEF_CONSISTENCY_COFF * (defensePlayer.defConst - K.CONSISTENCY_BASE);
    defConsistencyPenalty = Math.max(-K.DEF_CONSISTENCY_MAX_BONUS, Math.min(K.DEF_CONSISTENCY_MAX_BONUS, defConsistencyPenalty));
    percentage -= defConsistencyPenalty;

    // 运动能力
    percentage += calculateAthleticismImpact(offensePlayer.athleticism - defensePlayer.athleticism, distance);

    // 关键球压力
    if (state.currentQuarter >= 4 && Math.abs(state.team1.totalScore - state.team2.totalScore) <= K.CLOSE_GAME_DIFF &&
      state.quarterTime <= K.TIME_LEFT_CLUTCH) {
      var clutchPenalty = K.CLUTCH_SHOT_COFF + ((1.0 - K.CLUTCH_SHOT_COFF) * (offensePlayer.offConst - 25)) / 74.0;
      percentage *= clutchPenalty;
    }

    // 精英组织者加成
    var elitePlaymakerCount = 0;
    ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
      var p = offenseOnCourt[pos];
      if (p && p.astRating >= K.ELITE_PLAYMAKER_THRESHOLD) elitePlaymakerCount++;
    });
    if (elitePlaymakerCount >= 2) percentage += K.ELITE_PLAYMAKER_DUAL_BONUS;
    else if (elitePlaymakerCount === 1) percentage += K.ELITE_PLAYMAKER_SINGLE_BONUS;

    // 球队空间
    percentage += calculateTeamSpacingBonus(offenseOnCourt);

    // 精英投射轮换
    var allElite = true, highOffConst = 0, threeSum = 0, pc = 0;
    ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
      var p = offenseOnCourt[pos];
      if (!p) return;
      pc++;
      if (p.midRating < K.ELITE_ROTATION_MID_THRESHOLD || p.threeRating < K.ELITE_ROTATION_THREE_THRESHOLD) allElite = false;
      if (p.offConst >= K.ELITE_ROTATION_OFF_CONST_THRESHOLD) highOffConst++;
      threeSum += p.threeRating;
    });
    var avgThree = pc > 0 ? threeSum / pc : 0;
    if ((allElite && highOffConst >= K.ELITE_ROTATION_OFF_CONST_MIN_COUNT) || avgThree >= K.ELITE_ROTATION_AVG_THREE_THRESHOLD) {
      percentage += K.ELITE_ROTATION_BONUS;
    }

    // 内外空间
    var eliteLayupCount = 0, allAbove = true;
    ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
      var p = offenseOnCourt[pos];
      if (!p) return;
      if (p.layupRating >= K.INSIDE_OUT_ELITE_LAYUP) eliteLayupCount++;
      if (p.layupRating < K.INSIDE_OUT_BASE_LAYUP) allAbove = false;
    });
    if (eliteLayupCount >= K.INSIDE_OUT_ELITE_COUNT && allAbove) percentage += K.INSIDE_OUT_SPACING_BONUS;

    // 球星被重点针对
    if (offensePlayer.rating >= K.PLAYER_STAR_LB) percentage -= K.STAR_DEFENSE_FOCUS_PENALTY;

    // 主场优势
    if (homeTeamOnOffense) percentage += K.HOME_COURT_BOOST;
    else percentage -= K.AWAY_COURT_PENALTY;

    // 现代进攻节奏校准：与 perfect-player 全联盟场均 ~115.6 分对齐
    percentage += 3.0;

    return percentage;
  }

  // ---------- 抢断 / 失误 ----------
  function judgeLoseBall(state, defenseTeam, defenseOnCourt, offensePlayer, defensePlayer) {
    var range = 60 * K.STEAL_BASE + K.STEAL_RATING_SCALE * defensePlayer.stlRating +
      K.STEAL_DEFENSE_SCALE * Math.max(defensePlayer.interiorDefense, defensePlayer.perimeterDefense) +
      defensePlayer.athleticism;
    if (defensePlayer.stlRating >= K.STEAL_BONUS_THLD1 && defensePlayer.stlRating < K.STEAL_BONUS_THLD2) range *= K.STEAL_BONUS_SCALE1;
    else if (defensePlayer.stlRating >= K.STEAL_BONUS_THLD2 && defensePlayer.stlRating < K.STEAL_BONUS_THLD3) range *= K.STEAL_BONUS_SCALE2;
    else if (defensePlayer.stlRating >= K.STEAL_BONUS_THLD3 && defensePlayer.stlRating < K.STEAL_BONUS_THLD4) range *= K.STEAL_BONUS_SCALE3;
    else if (defensePlayer.stlRating >= K.STEAL_BONUS_THLD4) range *= K.STEAL_BONUS_SCALE4;

    var poss = rint(1, 100);
    if (poss <= 1) {
      if (rint(1, 100) <= K.JUMP_BALL_PLAY) {
        var winTeam1 = rint(1, 100) <= 50;
        if (winTeam1) return { result: 3 }; // JUMP_BALL_WIN
        return { result: 1 }; // LOSE_BALL_NO_SCORE
      }
    } else if (poss <= 1 + K.TURNOVER) {
      offensePlayer.turnover++;
      return { result: 1 };
    } else if (60 * poss <= 60 * (1 + K.TURNOVER) + range) {
      offensePlayer.turnover++;
      defensePlayer.steal++;
      if (rint(1, 100) <= K.NON_FASTBREAK) return { result: 1, isSteal: true };
      // 快攻得分
      var defTeam = defenseTeam;
      defTeam.totalScore += 2;
      var positions = ['C', 'PF', 'SF', 'SG', 'PG'];
      var finisher = defensePlayer;
      if (rint(1, 100) > K.SAME_POS) {
        var others = [];
        for (var i = 0; i < 5; i++) {
          if (positions[i] !== defensePlayer.position && defenseOnCourt[positions[i]]) others.push(defenseOnCourt[positions[i]]);
        }
        if (others.length) finisher = others[Math.floor(Math.random() * others.length)];
      }
      finisher.score += 2;
      finisher.shotMade++;
      finisher.shotAttempted++;
      return { result: 2, isSteal: true }; // LOSE_BALL_AND_SCORE
    }
    return { result: 0 }; // NO_LOSE_BALL
  }

  // ---------- 篮板 ----------
  function judgeRebound(state, offenseOnCourt, defenseOnCourt) {
    var offenseReb = 0, defenseReb = 0;
    ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
      var op = offenseOnCourt[pos]; if (op) offenseReb += op.orbRating;
      var dp = defenseOnCourt[pos]; if (dp) defenseReb += dp.drbRating;
    });
    var offRebBonus = offenseReb > defenseReb;
    var orbORdrb = rint(1, 100);
    var rebAssign = rint(1, 100);
    var isOff = (offRebBonus && orbORdrb <= K.ORB_WITH_BONUS) || (!offRebBonus && orbORdrb <= K.ORB_WITHOUT_BONUS);
    var rebounder;
    if (isOff) {
      if (rebAssign <= K.REBOUND_RATING_BONUS_PERCENT) {
        rebounder = null;
        ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
          if (!rebounder && offenseOnCourt[pos] && offenseOnCourt[pos].orbRating >= K.REBOUND_RATING_BONUS) rebounder = offenseOnCourt[pos];
        });
        if (!rebounder) rebounder = choosePlayerBasedOnRating(offenseOnCourt, 'orb');
      } else {
        rebounder = choosePlayerBasedOnRating(offenseOnCourt, 'orb');
      }
      rebounder.rebound++;
      rebounder.offensiveRebound++;
      return { isOffensiveRebound: true, rebounder: rebounder };
    }
    if (rebAssign <= K.REBOUND_RATING_BONUS_PERCENT) {
      rebounder = null;
      ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
        if (!rebounder && defenseOnCourt[pos] && defenseOnCourt[pos].drbRating >= K.REBOUND_RATING_BONUS) rebounder = defenseOnCourt[pos];
      });
      if (!rebounder) rebounder = choosePlayerBasedOnRating(defenseOnCourt, 'drb');
    } else {
      rebounder = choosePlayerBasedOnRating(defenseOnCourt, 'drb');
    }
    rebounder.rebound++;
    rebounder.defensiveRebound++;
    return { isOffensiveRebound: false, rebounder: rebounder };
  }

  // ---------- 封盖 ----------
  function judgeBlock(state, distance, offenseOnCourt, defenseOnCourt, offensePlayer, defensePlayer) {
    var range = K.BLOCK_RATING_SCALE * defensePlayer.blkRating +
      Math.max(defensePlayer.interiorDefense, defensePlayer.perimeterDefense) +
      defensePlayer.athleticism;
    if (defensePlayer.blkRating >= K.BLOCK_BONUS_THLD1 && defensePlayer.blkRating < K.BLOCK_BONUS_THLD2) range *= K.BLOCK_BONUS_SCALE1;
    else if (defensePlayer.blkRating >= K.BLOCK_BONUS_THLD2 && defensePlayer.blkRating < K.BLOCK_BONUS_THLD3) range *= K.BLOCK_BONUS_SCALE2;
    else if (defensePlayer.blkRating >= K.BLOCK_BONUS_THLD3 && defensePlayer.blkRating < K.BLOCK_BONUS_THLD4) range *= K.BLOCK_BONUS_SCALE3;
    else if (defensePlayer.blkRating >= K.BLOCK_BONUS_THLD4 && defensePlayer.blkRating < K.BLOCK_BONUS_THLD5) range *= K.BLOCK_BONUS_SCALE4;
    else if (defensePlayer.blkRating >= K.BLOCK_BONUS_THLD5) range *= K.BLOCK_BONUS_SCALE5;

    var poss = rint(1, 100);
    if (60 * poss <= range) {
      offensePlayer.shotAttempted++;
      if (distance >= K.MIN_THREE_SHOT) offensePlayer.threeAttempted++;
      defensePlayer.block++;
      if (rint(1, 100) <= K.BLOCK_OUT_OF_BOUND) {
        return { result: 2 }; // BLOCK_OFFENSIVE_REBOUND
      }
      var reboundOutcome = judgeRebound(state, offenseOnCourt, defenseOnCourt);
      return {
        result: reboundOutcome.isOffensiveRebound ? 2 : 3, // 2=offensive, 3=defensive
        reboundOutcome: reboundOutcome
      };
    }
    return { result: 0 }; // NO_BLOCK
  }

  // ---------- 犯规 ----------
  function calculateFoulPercent(distance, offensePlayer, defensePlayer, isAndOne) {
    var basePercent;
    if (isAndOne) {
      basePercent = distance <= K.MAX_CLOSE_SHOT ? K.AND_ONE_CLOSE_BASE : distance <= K.MAX_MID_SHOT ? K.AND_ONE_MID_BASE : K.AND_ONE_THREE_BASE;
    } else {
      basePercent = distance <= K.MAX_CLOSE_SHOT ? K.NORMAL_CLOSE_BASE : distance <= K.MAX_MID_SHOT ? K.NORMAL_MID_BASE : K.NORMAL_THREE_BASE;
    }
    var drawFoulPercent;
    if (offensePlayer.drawFoul >= K.FOUL_RATING_THLD1) drawFoulPercent = basePercent * (100 + K.FOUL_COFF1 * offensePlayer.drawFoul);
    else if (offensePlayer.drawFoul >= K.FOUL_RATING_THLD2) drawFoulPercent = basePercent * (100 + K.FOUL_COFF2 * offensePlayer.drawFoul);
    else drawFoulPercent = basePercent * (100 + K.FOUL_COFF3 * offensePlayer.drawFoul);
    if (offensePlayer.isStar && !defensePlayer.isStar) drawFoulPercent *= K.STAR_FOUL_SCALE;
    return Math.floor(drawFoulPercent);
  }

  function findSubPlayer(previousPlayer, team) {
    var bench = team.benchPlayers[previousPlayer.position];
    if (bench && bench !== previousPlayer && bench.canOnCourt) return bench;
    for (var i = 0; i < team.players.length; i++) {
      var p = team.players[i];
      if (p !== previousPlayer && p.canOnCourt && !p.isOnCourt) return p;
    }
    return previousPlayer;
  }

  function judgeFoulOut(previousPlayer, team, teamOnCourt) {
    if (previousPlayer.foul >= K.FOULS_TO_FOUL_OUT) {
      previousPlayer.canOnCourt = false;
      previousPlayer.isOnCourt = false;
      var sub = findSubPlayer(previousPlayer, team);
      if (sub && sub !== previousPlayer) {
        sub.isOnCourt = true;
        sub.hasBeenOnCourt = true;
        sub.currentStintSeconds = 0;
        teamOnCourt[previousPlayer.position] = sub;
      }
    }
  }

  function makeFreeThrow(state, player, offenseTeam, offenseOnCourt, defenseOnCourt, times, isFlag) {
    var timesLeft = times;
    var reboundOutcome;
    while (timesLeft > 0) {
      timesLeft--;
      if (rint(1, 100) <= player.freeThrowPercent) {
        player.freeThrowAttempted++;
        player.freeThrowMade++;
        player.score++;
        offenseTeam.totalScore++;
        if (timesLeft === 0) return { result: isFlag ? 2 : 1 }; // 1=MADE_LAST, 2=OFFENSIVE_REBOUND(flagrant)
      } else {
        player.freeThrowAttempted++;
        if (timesLeft === 0) {
          if (isFlag) return { result: 2 };
          reboundOutcome = judgeRebound(state, offenseOnCourt, defenseOnCourt);
          return { result: reboundOutcome.isOffensiveRebound ? 2 : 3, reboundOutcome: reboundOutcome };
        }
      }
    }
    return { result: 1 };
  }

  function convertFreeThrowToShotOutcome(fr) {
    if (fr.result === 1) return { result: 2, fromFreeThrow: true }; // MADE_FREE_THROWS
    if (fr.result === 2) return { result: 4, reboundOutcome: fr.reboundOutcome, fromFreeThrow: true }; // OFFENSIVE_REBOUND
    return { result: 5, reboundOutcome: fr.reboundOutcome, fromFreeThrow: true }; // DEFENSIVE_REBOUND
  }

  function judgeMakeShot(state, distance, offensePlayer, defensePlayer, offenseTeam, defenseTeam, offenseOnCourt, defenseOnCourt, percentage, shotType) {
    var judgeShot = rint(1, 10000);
    if (judgeShot < Math.floor(100 * percentage)) {
      // 命中
      offensePlayer.shotMade++;
      offensePlayer.shotAttempted++;
      if (distance >= K.MIN_THREE_SHOT) {
        offensePlayer.threeAttempted++;
        offensePlayer.threeMade++;
        offensePlayer.score += 3;
        offenseTeam.totalScore += 3;
      } else {
        offensePlayer.score += 2;
        offenseTeam.totalScore += 2;
      }
      // 助攻
      var highestAst = 0, highestPlayer = null;
      ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
        var p = offenseOnCourt[pos];
        if (p && pos !== offensePlayer.position && p.astRating > highestAst) { highestAst = p.astRating; highestPlayer = p; }
      });
      var assistAssign = rint(1, 100);
      if (assistAssign <= K.HIGH_BOTH_RATING) {
        if (highestPlayer && ((highestPlayer.rating >= K.HIGH_BOTH_RATING_THLD && highestPlayer.astRating >= K.HIGH_BOTH_RATING_THLD) || assistAssign <= K.HIGHEST_RATING_PERCENT)) {
          highestPlayer.assist++;
        }
      } else {
        var astTemp = rint(1, 100);
        if ((offensePlayer.isStar && astTemp <= K.STAR_PLAYER_AST) || (!offensePlayer.isStar && astTemp <= K.NON_STAR_PLAYER_AST)) {
          var assister = choosePlayerBasedOnRating(offenseOnCourt, 'ast');
          if (assister && assister !== offensePlayer) assister.assist++;
        }
      }
      // 2+1
      var andOneTemp = rint(1, 10000);
      var drawFoulPercent = calculateFoulPercent(distance, offensePlayer, defensePlayer, true);
      if (andOneTemp <= drawFoulPercent) {
        defensePlayer.foul++;
        judgeFoulOut(defensePlayer, defenseTeam, defenseOnCourt);
        var andOneResult = makeFreeThrow(state, offensePlayer, offenseTeam, offenseOnCourt, defenseOnCourt, 1, false);
        return convertFreeThrowToShotOutcome(andOneResult);
      }
      return { result: 1 }; // MADE_SHOT
    }
    // 未命中 → 投篮犯规
    var foulTemp = rint(1, 10000);
    var drawFoulPercent2 = calculateFoulPercent(distance, offensePlayer, defensePlayer, false);
    if (foulTemp <= drawFoulPercent2) {
      defensePlayer.foul++;
      defenseTeam.quarterFoul++;
      judgeFoulOut(defensePlayer, defenseTeam, defenseOnCourt);
      if (distance <= K.MAX_MID_SHOT) {
        var fr2 = makeFreeThrow(state, offensePlayer, offenseTeam, offenseOnCourt, defenseOnCourt, 2, false);
        return convertFreeThrowToShotOutcome(fr2);
      }
      var fr3 = makeFreeThrow(state, offensePlayer, offenseTeam, offenseOnCourt, defenseOnCourt, 3, false);
      return convertFreeThrowToShotOutcome(fr3);
    }
    // 篮板
    var reboundOutcome = judgeRebound(state, offenseOnCourt, defenseOnCourt);
    if (reboundOutcome.isOffensiveRebound) return { result: 4, reboundOutcome: reboundOutcome }; // OFFENSIVE_REBOUND
    return { result: 5, reboundOutcome: reboundOutcome }; // DEFENSIVE_REBOUND
  }

  function judgeNormalFoul(state, offenseOnCourt, defenseOnCourt, offensePlayer, defensePlayer, offenseTeam, defenseTeam) {
    var poss = rint(1, 100);
    var foulTemp = rint(1, 100);
    var positions = ['C', 'PF', 'SF', 'SG', 'PG'];
    if (poss <= K.OFF_FOUL) {
      var fouler = offensePlayer;
      if (foulTemp > K.SAME_POS) {
        var others = [];
        for (var i = 0; i < 5; i++) { if (positions[i] !== offensePlayer.position && offenseOnCourt[positions[i]]) others.push(offenseOnCourt[positions[i]]); }
        if (others.length) fouler = others[Math.floor(Math.random() * others.length)];
      }
      fouler.turnover++;
      fouler.foul++;
      judgeFoulOut(fouler, offenseTeam, offenseOnCourt);
      return 1; // OFFENSIVE_FOUL
    } else if (poss <= K.OFF_FOUL + K.DEF_FOUL) {
      var fouler2 = defensePlayer;
      if (foulTemp > K.SAME_POS) {
        var others2 = [];
        for (var j = 0; j < 5; j++) { if (positions[j] !== defensePlayer.position && defenseOnCourt[positions[j]]) others2.push(defenseOnCourt[positions[j]]); }
        if (others2.length) fouler2 = others2[Math.floor(Math.random() * others2.length)];
      }
      fouler2.foul++;
      judgeFoulOut(fouler2, defenseTeam, defenseOnCourt);
      defenseTeam.quarterFoul++;
      if (defenseTeam.quarterFoul >= K.BONUS_FOUL_THRESHOLD) {
        makeFreeThrow(state, offensePlayer, offenseTeam, offenseOnCourt, defenseOnCourt, 2, false);
      }
      return 2; // DEFENSIVE_FOUL
    }
    return 0; // NO_FOUL
  }

  // ---------- 轮换 ----------
  function ensureOnCourt(team, teamOnCourt, isStarters) {
    var positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    positions.forEach(function (pos) {
      var cur = teamOnCourt[pos];
      var desired = (isStarters ? team.starters : team.benchPlayers)[pos];
      if (cur && cur.isOnCourt && cur.canOnCourt && ((isStarters && cur.rotationType === 1) || (!isStarters && cur.rotationType === 2))) return;
      // 需要轮换
      if (cur) { cur.isOnCourt = false; cur.currentStintSeconds = 0; }
      if (desired && desired.canOnCourt && !desired.isOnCourt) {
        desired.isOnCourt = true;
        desired.hasBeenOnCourt = true;
        desired.currentStintSeconds = 0;
        teamOnCourt[pos] = desired;
      } else if (desired && desired.canOnCourt) {
        // desired 已在场（如换防占位），保持现状
      } else {
        // desired 不可用（六犯离场），找替补
        var sub = findSubPlayer(desired || cur, team);
        if (sub && sub.canOnCourt) {
          sub.isOnCourt = true;
          sub.hasBeenOnCourt = true;
          sub.currentStintSeconds = 0;
          teamOnCourt[pos] = sub;
        }
      }
    });
  }

  // ---------- 逐回合 ----------

  /** 球队中文名（对外可读） */
  function teamCn(abbr) {
    try {
      if (typeof getTeamName === 'function') return getTeamName(abbr);
      if (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.TEAM_NAMES && SIM_CONFIG.TEAM_NAMES[abbr]) return SIM_CONFIG.TEAM_NAMES[abbr];
    } catch (e) {}
    return abbr;
  }

  /** 记录一条逐回合文字直播 */
  function pbpLog(state, text) {
    if (!state.playByPlayLog) return;
    var q = state.currentQuarter;
    var qLabel = q <= 4 ? ('Q' + q) : ('OT' + (q - 4));
    var min = Math.max(0, Math.floor(state.quarterTime / 60));
    var sec = Math.max(0, Math.floor(state.quarterTime % 60));
    var secStr = (sec < 10 ? '0' : '') + sec;
    state.playByPlayLog.push({
      q: qLabel,
      time: min + ':' + secStr,
      text: text,
      score: state.team1.totalScore + '-' + state.team2.totalScore
    });
  }

  function playPossession(state) {
    var team1 = state.team1, team2 = state.team2;
    var offenseTeam = team1.hasBall ? team1 : team2;
    var defenseTeam = !team1.hasBall ? team1 : team2;
    var offenseOnCourt = team1.hasBall ? state.team1OnCourt : state.team2OnCourt;
    var defenseOnCourt = !team1.hasBall ? state.team1OnCourt : state.team2OnCourt;
    state.defenseOnCourt = defenseOnCourt;

    var currentPlayTime = generateRandomPlayTime(state.isPlayoff, state.isSecondChance, state.quarterTime);
    if (!state.isSecondChance) {
      // 无
    } else {
      state.isSecondChance = false;
    }

    // 记录出场时间
    var positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    [state.team1OnCourt, state.team2OnCourt].forEach(function (oc) {
      positions.forEach(function (pos) {
        var p = oc[pos];
        if (p) { p.secondsPlayed += currentPlayTime; p.currentStintSeconds += currentPlayTime; }
      });
    });
    state.totalGameTime += currentPlayTime;

    var offensePlayer = choosePlayerBasedOnRating(offenseOnCourt, 'rating', state.currentQuarter, state.quarterTime, offenseTeam, defenseTeam, false);
    if (!offensePlayer) { state.quarterTime -= currentPlayTime; return; }
    var defensePlayer = chooseDefensePlayer(offensePlayer, defenseOnCourt);

    // 失误/抢断
    var loseBall = judgeLoseBall(state, defenseTeam, defenseOnCourt, offensePlayer, defensePlayer);
    if (loseBall.result === 1) {
      if (loseBall.isSteal) pbpLog(state, teamCn(defenseTeam.abbr) + ' ' + defensePlayer.name + ' 抢断成功！');
      else pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 出现失误');
      offenseTeam.hasBall = false;
      defenseTeam.hasBall = true;
      state.quarterTime -= currentPlayTime;
      return;
    } else if (loseBall.result === 2) {
      pbpLog(state, teamCn(defenseTeam.abbr) + ' ' + (loseBall.fastBreakScorer ? loseBall.fastBreakScorer.name : defensePlayer.name) + ' 抢断快攻得分！');
      // 抢断快攻得分：进攻方底线发球（球权不变）
      state.quarterTime -= currentPlayTime;
      return;
    } else if (loseBall.result === 3) {
      state.quarterTime -= currentPlayTime;
      return;
    }

    // 非投篮犯规
    var foulResult = judgeNormalFoul(state, offenseOnCourt, defenseOnCourt, offensePlayer, defensePlayer, offenseTeam, defenseTeam);
    if (foulResult === 1) {
      pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 进攻犯规，球权转换');
      offenseTeam.hasBall = false;
      defenseTeam.hasBall = true;
      state.quarterTime -= currentPlayTime;
      return;
    } else if (foulResult === 2) {
      pbpLog(state, teamCn(defenseTeam.abbr) + ' 防守犯规');
      // 防守犯规：若在 bonus 已罚球，球权交给进攻方重新组织（保持原进攻球权由防守方发球）
      // NBA 规则：罚球后进攻方发底线球；这里简化处理为防守方获得球权
      offenseTeam.hasBall = false;
      defenseTeam.hasBall = true;
      state.quarterTime -= currentPlayTime;
      return;
    }

    var distance = getShotDistance(offensePlayer);
    var shotType = getShotType(distance, offensePlayer);

    // 封盖
    var blockOutcome = judgeBlock(state, distance, offenseOnCourt, defenseOnCourt, offensePlayer, defensePlayer);
    if (blockOutcome.result === 2) {
      pbpLog(state, teamCn(defenseTeam.abbr) + ' ' + defensePlayer.name + ' 送出大帽！');
      if (blockOutcome.reboundOutcome) pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + blockOutcome.reboundOutcome.rebounder.name + ' 抢到进攻篮板');
      state.isSecondChance = true;
      state.quarterTime -= currentPlayTime;
      return;
    } else if (blockOutcome.result === 3) {
      pbpLog(state, teamCn(defenseTeam.abbr) + ' ' + defensePlayer.name + ' 送出大帽！');
      if (blockOutcome.reboundOutcome) pbpLog(state, teamCn(defenseTeam.abbr) + ' ' + blockOutcome.reboundOutcome.rebounder.name + ' 抢到防守篮板');
      offenseTeam.hasBall = false;
      defenseTeam.hasBall = true;
      state.quarterTime -= currentPlayTime;
      return;
    }

    // 命中率（含主场优势、种子加成）
    var homeTeamOnOffense = state.homeIsTeam1 ? (offenseTeam === team1) : (offenseTeam === team2);
    var percentage = calculatePercentage(state, distance, offensePlayer, defensePlayer, offenseOnCourt, shotType, homeTeamOnOffense);
    // 种子加成 / 带伤出战加成：直接作用到进攻方命中率
    if (offenseTeam === team1) percentage += state.team1Shift;
    else percentage += state.team2Shift;

    var shotOutcome = judgeMakeShot(state, distance, offensePlayer, defensePlayer, offenseTeam, defenseTeam, offenseOnCourt, defenseOnCourt, percentage, shotType);

    if (shotOutcome.result === 1 || shotOutcome.result === 2) {
      if (shotOutcome.result === 2) {
        pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 罚球命中！');
      } else if (distance >= K.MIN_THREE_SHOT) {
        pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 三分命中！');
      } else {
        pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 投篮命中！');
      }
      offenseTeam.hasBall = false;
      defenseTeam.hasBall = true;
      state.quarterTime -= currentPlayTime;
      return;
    } else if (shotOutcome.result === 4) {
      pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 投篮不中');
      if (shotOutcome.reboundOutcome) pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + shotOutcome.reboundOutcome.rebounder.name + ' 抢到进攻篮板');
      state.isSecondChance = true;
      state.quarterTime -= currentPlayTime;
      return;
    } else {
      pbpLog(state, teamCn(offenseTeam.abbr) + ' ' + offensePlayer.name + ' 投篮不中');
      if (shotOutcome.reboundOutcome) pbpLog(state, teamCn(defenseTeam.abbr) + ' ' + shotOutcome.reboundOutcome.rebounder.name + ' 抢到防守篮板');
      offenseTeam.hasBall = false;
      defenseTeam.hasBall = true;
      state.quarterTime -= currentPlayTime;
      return;
    }
  }

  function playQuarter(state) {
    var quarterStart = state.quarterTime;
    while (state.quarterTime > 0) {
      // 8 分钟整轮换：首发 ↔ 替补
      if (quarterStart - state.quarterTime >= K.ROTATION_START_SECONDS && !state._rotated) {
        state._rotated = true;
        ensureOnCourt(state.team1, state.team1OnCourt, false);
        ensureOnCourt(state.team2, state.team2OnCourt, false);
      } else if (quarterStart - state.quarterTime < K.ROTATION_START_SECONDS && state._rotated) {
        // 不可能往回走，忽略
      }
      playPossession(state);
    }
  }

  function ensureStartersAtQuarterStart(team, teamOnCourt) {
    ensureOnCourt(team, teamOnCourt, true);
  }

  /** 主入口：逐回合模拟一场比赛。返回兼容 perfect-player 的 gameResult。 */
  function hostKeyGame(teamA, teamB, options) {
    options = options || {};
    var homeIsTeam1 = options.teamAHome !== false;

    var t1 = buildKeyTeam(teamA, true);
    var t2 = buildKeyTeam(teamB, false);
    t1.players.forEach(resetKeyPlayerStats);
    t2.players.forEach(resetKeyPlayerStats);

    // 种子加成 / 带伤出战的命中率偏移
    var seedPts = (Number(options.seedBonus) || 0) * 0.8;
    var probShift = options.probMultiplier == null ? 0 : (Number(options.probMultiplier) - 1) * 22;
    // team1 是 perfect-player 语境下的“我的球队/主队”
    var team1Shift = clampInt(seedPts + probShift, -12, 12);
    var team2Shift = 0;

    var team1OnCourt = {}, team2OnCourt = {};
    ['PG', 'SG', 'SF', 'PF', 'C'].forEach(function (pos) {
      team1OnCourt[pos] = t1.starters[pos];
      if (t1.starters[pos]) { t1.starters[pos].isOnCourt = true; t1.starters[pos].hasBeenOnCourt = true; }
      team2OnCourt[pos] = t2.starters[pos];
      if (t2.starters[pos]) { t2.starters[pos].isOnCourt = true; t2.starters[pos].hasBeenOnCourt = true; }
    });

    var state = {
      team1: t1, team2: t2,
      team1OnCourt: team1OnCourt, team2OnCourt: team2OnCourt,
      defenseOnCourt: team2OnCourt,
      quarterTime: K.QUARTER_SECONDS,
      currentQuarter: 1,
      isSecondChance: false,
      team1Scores: [], team2Scores: [],   // 每节结束时的累计总分
      totalGameTime: 0,
      isPlayoff: options.isPlayoff !== false,
      homeIsTeam1: homeIsTeam1,
      team1Shift: team1Shift, team2Shift: team2Shift,
      _rotated: false,
      playByPlayLog: []
    };

    // 跳球
    if (rint(1, 100) <= 50) t1.hasBall = true;
    else t2.hasBall = true;

    for (var q = 1; q <= 4; q++) {
      state.currentQuarter = q;
      state.quarterTime = K.QUARTER_SECONDS;
      state.team1.quarterFoul = 0;
      state.team2.quarterFoul = 0;
      state._rotated = false;
      if (q === 3) {
        ensureStartersAtQuarterStart(t1, state.team1OnCourt);
        ensureStartersAtQuarterStart(t2, state.team2OnCourt);
      }
      playQuarter(state);
      state.team1Scores.push(t1.totalScore);
      state.team2Scores.push(t2.totalScore);
      pbpLog(state, '—— 第' + q + '节结束 ——');
    }

    // 加时
    var ot = 0;
    while (t1.totalScore === t2.totalScore && ot < 3) {
      ot++;
      state.currentQuarter = 4 + ot;
      state.quarterTime = 300;
      state.team1.quarterFoul = 0;
      state.team2.quarterFoul = 0;
      state._rotated = false;
      ensureStartersAtQuarterStart(t1, state.team1OnCourt);
      ensureStartersAtQuarterStart(t2, state.team2OnCourt);
      playQuarter(state);
      state.team1Scores.push(t1.totalScore);
      state.team2Scores.push(t2.totalScore);
      pbpLog(state, '—— 加时赛 结束 ——');
    }
    if (t1.totalScore === t2.totalScore) t1.totalScore++;

    // 每节得分（非累计）
    var perQ1 = [];
    var perQ2 = [];
    var prev1 = 0, prev2 = 0;
    for (var qi = 0; qi < state.team1Scores.length; qi++) {
      perQ1.push(state.team1Scores[qi] - prev1);
      perQ2.push(state.team2Scores[qi] - prev2);
      prev1 = state.team1Scores[qi];
      prev2 = state.team2Scores[qi];
    }

    var scoreA = t1.totalScore, scoreB = t2.totalScore;
    var won = scoreA > scoreB;
    var margin = Math.abs(scoreA - scoreB);

    // 关键事件描述
    var keyEvents = [];
    if (ot > 0) keyEvents.push('⏱ 加时赛 #' + ot);
    if (margin <= 3) keyEvents.push(won ? '⚡ 关键回合守住胜局' : '💔 最后回合惜败');

    // 爆冷判定：结合球队实力
    var powerA = (typeof calcTeamPowerWithPlayer === 'function') ? calcTeamPowerWithPlayer(teamA) : null;
    var powerB = (typeof calcTeamPowerWithPlayer === 'function') ? calcTeamPowerWithPlayer(teamB) : null;
    var ratingA = powerA ? (powerA.offense + powerA.defense + powerA.depth) / 3 : 70;
    var ratingB = powerB ? (powerB.offense + powerB.defense + powerB.depth) / 3 : 70;
    var expectedWinProb = 1 / (1 + Math.exp(-((ratingA - ratingB) * 0.08)));
    var favoriteA = ratingA >= ratingB;
    if (won !== favoriteA && Math.abs(expectedWinProb - 0.5) >= 0.12) keyEvents.push('💥 爆冷！');
    if (margin >= 20) keyEvents.push('📉 大比分碾压');

    // 生成兼容的 BoxScore
    var boxScore = {};
    boxScore[teamA] = buildBoxScoreRows(t1);
    boxScore[teamB] = buildBoxScoreRows(t2);
    // 把引擎生成的数据合入生成我的数据时的 boxScore（若用户队为 teamA）
    var pace = Math.round(state.totalGameTime > 0 ? (48 * 60 * 2 / Math.max(1, state.totalGameTime / Math.max(1, state.team1Scores.length))) / 1 : 99);
    var totalPoss = 0;
    t1.players.forEach(function (p) { totalPoss += p.shotAttempted; });
    t2.players.forEach(function (p) { totalPoss += p.shotAttempted; });
    pace = Math.max(88, Math.min(112, Math.round(totalPoss / 2)));

    return {
      won: won,
      scoreA: scoreA, scoreB: scoreB,
      qScoresA: perQ1.slice(0, 4), qScoresB: perQ2.slice(0, 4),
      keyEvents: keyEvents,
      ot: ot,
      highlight: ot > 0 || margin <= 3 || keyEvents.indexOf('💥 爆冷！') >= 0,
      pace: pace,
      possPerQ: Math.round(pace / 4),
      expectedWinProb: expectedWinProb,
      teamA: { power: powerA || { offense: 70, defense: 70, depth: 70 } },
      teamB: { power: powerB || { offense: 70, defense: 70, depth: 70 } },
      boxScore: boxScore,
      playByPlay: state.playByPlayLog,
      keyGame: true,
      _enginePlayers: { teamA: t1, teamB: t2 }
    };
  }

  function buildBoxScoreRows(team) {
    var rows = [];
    team.players.forEach(function (p) {
      rows.push({
        name: p.name,
        pos: p.position,
        pts: p.score, reb: p.rebound, ast: p.assist, stl: p.steal, blk: p.block, tov: p.turnover,
        fgm: p.shotMade, fga: p.shotAttempted, threeM: p.threeMade, threeA: p.threeAttempted,
        ftm: p.freeThrowMade, fta: p.freeThrowAttempted,
        mins: Math.round(p.secondsPlayed / 60),
        isUser: p._isUser || false
      });
    });
    return rows;
  }

  /** 是否关键场次：晋级轮/淘汰轮/抢七（附加赛单场或系列赛赛点、淘汰点） */
  function isKeyPlayoffGameContext(winsA, winsB, gameNum) {
    if (winsA === 3 || winsB === 3) return true; // 赛点：一方再赢一场即晋级（另一方淘汰）
    if (gameNum >= 6) return true;                // G7：双方生死战
    return false;
  }

  /** 对外暴露：模拟一场关键比赛 */
  window.simulateKeyGameNew = function (teamA, teamB, options) {
    logOnce('关键比赛逐回合模拟已启用（移植自 NBA-Sim-Web）');
    try {
      return hostKeyGame(teamA, teamB, options || {});
    } catch (err) {
      console.error('[KeyGame] 逐回合模拟出错，回退到常规模拟：', err);
      return null;
    }
  };

  window.isKeyPlayoffGameContext = isKeyPlayoffGameContext;

  /**
   * 季后赛单场模拟入口：关键场次（晋级轮/淘汰轮/G7）使用逐回合引擎，
   * 其余场次沿用原有 simulateGameNew。
   */
  window.simulateKeyOrNormalGame = function (teamA, teamB, seedBonus, probMultiplier, winsA, winsB, gameNum) {
    var isKey = isKeyPlayoffGameContext(Number(winsA) || 0, Number(winsB) || 0, Number(gameNum) || 0);
    if (isKey && typeof window.simulateKeyGameNew === 'function') {
      var keyResult = window.simulateKeyGameNew(teamA, teamB, {
        teamAHome: (Number(gameNum) || 0) < 4,
        seedBonus: seedBonus || 0,
        probMultiplier: probMultiplier,
        isPlayoff: true,
        keyGame: true
      });
      if (keyResult) {
        keyResult._keyGame = true;
        return keyResult;
      }
    }
    if (typeof window.simulateGameNew === 'function') {
      return window.simulateGameNew(teamA, teamB, seedBonus, probMultiplier);
    }
    return null;
  };
  window.PERFECT_PLAYER_KEYGAME_REPORT = {
    engine: 'nba-sim-web-possession-port',
    isPlayoff: true,
    appliesTo: ['play-in', 'playoff-clincher', 'playoff-elimination', 'game7']
  };

  /* ======================================================================
   * 模块 2 · 青训阶段（移植自 basketballCareerSimulator 的青训决策逻辑）
   * ====================================================================== */

  // 青训事件：每个选项的 outcomes 记录概率、描述以及对应属性变化（perfect-player 13 属性）
  var YOUTH_EVENTS = [
    {
      key: 'youth_shooting',
      title: '青训营 · 投篮专项',
      emoji: '🎯',
      text: '青训营教练把你叫到一边，说你的投篮姿势很标准，但出手太慢。他给了你一套暑期计划。',
      options: [
        {
          id: 'a', label: '每天加练 500 球', hint: '出手练快了，能力上涨',
          outcomes: [
            { prob: 0.75, text: '三个月后，你的出手快得让教练点头。', attrs: { threePT: 3, MID: 2, CLU: 1 } },
            { prob: 0.25, text: '姿势改了又改，反而丢了手感。', attrs: { threePT: -1, MID: -1 } }
          ]
        },
        {
          id: 'b', label: '先不练投篮，练对抗', hint: '身体先跟上，投篮以后再说',
          outcomes: [
            { prob: 0.8, text: '对抗上来后，突破也顺了。', attrs: { FIN: 2, STR: 2, ATH: 1 } },
            { prob: 0.2, text: '增重太快，膝盖开始闹脾气。', attrs: { STR: 1, ATH: 1 } }
          ]
        },
        {
          id: 'c', label: '按部就班', hint: '不出彩，也不冒险',
          outcomes: [
            { prob: 1, text: '暑假结束，一切照旧。', attrs: {} }
          ]
        }
      ]
    },
    {
      key: 'youth_point_guard',
      title: '青训营 · 组织核心',
      emoji: '🏀',
      text: '队里最好的后卫伤退了，教练让你顶上组织位置。这场练习赛，全队都在看你。',
      options: [
        {
          id: 'a', label: '自己打，先得分', hint: '得分涨，组织能力暂时落后',
          outcomes: [
            { prob: 0.7, text: '你砍下高分，球探记下了你的名字。', attrs: { FIN: 2, threePT: 1, HAN: 1 } },
            { prob: 0.3, text: '你出手太多，队友站了一整场。', attrs: { threePT: -1, HAN: -1 } }
          ]
        },
        {
          id: 'b', label: '先传起来', hint: '组织涨，得分节奏要重新找',
          outcomes: [
            { prob: 0.7, text: '你的传球盘活了全队，教练笑了。', attrs: { PAS: 3, HAN: 2 } },
            { prob: 0.3, text: '传球太犹豫，被断了好几个。', attrs: { PAS: -1, HAN: -1 } }
          ]
        }
      ]
    },
    {
      key: 'youth_late_growth',
      title: '青训营 · 身体晚熟',
      emoji: '💪',
      text: '骨龄报告说你发育偏晚，未来两年是长身体的关键期。教练给了你两个方向。',
      options: [
        {
          id: 'a', label: '狠练力量', hint: '上限更高，有伤病风险',
          outcomes: [
            { prob: 0.55, text: '你像换了个人，对抗完全不一样了。', attrs: { STR: 3, ATH: 3, IDEF: 2, REB: 1 } },
            { prob: 0.45, text: '练得太猛，腰先撑不住了。', attrs: { STR: 1, ATH: 1 } }
          ]
        },
        {
          id: 'b', label: '慢慢来', hint: '稳妥发育',
          outcomes: [
            { prob: 1, text: '一年后你长高了 5 厘米，一切正常。', attrs: { ATH: 1, STR: 1, REB: 1 } }
          ]
        }
      ]
    },
    {
      key: 'assistant_coach',
      title: '青训营 · 助教的建议',
      emoji: '🧠',
      text: '助教偷偷给你看了一份球探报告，上面是你的优缺点分析。他建议你主攻一个方向。',
      options: [
        {
          id: 'a', label: '练短板', hint: '练成综合大涨，练废了信心受挫',
          outcomes: [
            { prob: 0.5, text: '短板补上了，你成了更完整的球员。', attrs: { MID: 2, PAS: 2, IDEF: 2, REB: 2 } },
            { prob: 0.5, text: '短板还是短板，还丢了长板的手感。', attrs: { threePT: -1, FIN: -1 } }
          ]
        },
        {
          id: 'b', label: '强化长板', hint: '把强项练到极致',
          outcomes: [
            { prob: 0.8, text: '你的招牌动作成了防守人的噩梦。', attrs: { CLU: 2, FIN: 2, threePT: 1 } },
            { prob: 0.2, text: '练太多，身体开始抗议。', attrs: { ATH: 1 } }
          ]
        }
      ]
    }
  ];

  var ATTR_CN_YOUTH = {
    threePT: '三分', MID: '中投', FIN: '终结', DNK: '扣篮', HAN: '护球', PAS: '传球',
    PDEF: '外防', IDEF: '内防', BLK: '盖帽', REB: '篮板', ATH: '运动', STR: '力量', CLU: '关键'
  };

  function getYouthArea() {
    return document.getElementById('youth-area');
  }

  function youthAttrLabel(key) {
    if (typeof attrCN === 'function') return attrCN(key) || key;
    return ATTR_CN_YOUTH[key] || key;
  }

  function renderYouthBase(innerHtml) {
    var area = getYouthArea();
    if (!area) return;
    area.innerHTML = innerHtml;
  }

  /** 青训入口：需要先经历青训再进入选秀/生涯 */
  function startYouthTraining() {
    logOnce('青训阶段已启用（移植自 basketballCareerSimulator）');
    var c = STATE.career || {};
    if (c.youthDone) {
      continueAfterYouth();
      return;
    }
    if (STATE._youth && STATE._youth.finished) {
      continueAfterYouth();
      return;
    }
    showScreen('screen-youth');
    STATE._youth = {
      idx: 0,
      events: YOUTH_EVENTS.slice(),
      history: [],
      attrDeltas: {},
      introShown: false
    };
    renderYouthIntro();
  }

  function renderYouthIntro() {
    var name = (typeof getHupuDisplayName === 'function') ? getHupuDisplayName() : '我';
    var pos = STATE.position ? (SIM_CONFIG.POSITIONS[STATE.position] || STATE.position) : '';
    var ovr = STATE.finalOVR || calcOVR(STATE.attrs, STATE.position);
    renderYouthBase(
      '<div style="padding:16px 12px;">' +
        '<div class="reveal-card" style="text-align:center;">' +
          '<div style="font-size:13px;color:var(--text-dim);letter-spacing:2px;">🏟️ 青年训练营</div>' +
          '<div style="font-size:24px;font-weight:800;margin:8px 0;font-family:var(--font-display);">' + name + '</div>' +
          '<div style="font-size:12px;color:var(--text-dim);">' + pos + ' · 当前 OVR ' + ovr + '</div>' +
          '<div style="margin:12px auto 4px;max-width:300px;font-size:13px;color:var(--text-dim);line-height:1.7;text-align:left;">' +
            '选秀前的夏天，你进入了一支 NBA 发展体系的青训营。教练组通过几项针对性训练观察你的潜力——你的每个选择，都会影响进入联盟前的最后成长。' +
          '</div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:12px;">' +
          '<button class="btn btn-primary" style="max-width:280px;margin:0 auto;" onclick="beginYouthTraining()">▶ 开始青训</button>' +
        '</div>' +
      '</div>'
    );
  }

  function beginYouthTraining() {
    STATE._youth.introShown = true;
    renderYouthEvent();
  }

  function renderYouthEvent() {
    var y = STATE._youth;
    var ev = y.events[y.idx];
    if (!ev) { finishYouthTraining(); return; }

    var pos = STATE.position ? (SIM_CONFIG.POSITIONS[STATE.position] || STATE.position) : '';
    var ovr = STATE.finalOVR || calcOVR(STATE.attrs, STATE.position);

    var optionsHtml = '';
    ev.options.forEach(function (opt) {
      optionsHtml +=
        '<div class="feature-card" style="margin-bottom:8px;padding:14px 14px;" onclick="resolveYouthChoice(\'' + ev.key + '\',\'' + opt.id + '\')">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
            '<span style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);">' + opt.label + '</span>' +
            '<span style="font-size:10px;color:var(--orange);font-weight:700;text-align:right;">' + (opt.hint || '') + '</span>' +
          '</div>' +
        '</div>';
    });

    var progressHtml = '';
    var total = y.events.length;
    for (var i = 0; i < total; i++) {
      progressHtml += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px;background:' + (i === y.idx ? 'var(--orange)' : 'var(--border)') + ';"></span>';
    }

    renderYouthBase(
      '<div style="padding:12px 12px;">' +
        '<div style="text-align:center;margin-bottom:10px;">' +
          '<div style="font-size:10px;color:var(--text-muted);letter-spacing:2px;">青训第 ' + (y.idx + 1) + ' / ' + total + ' 课</div>' +
          '<div style="margin-top:4px;">' + progressHtml + '</div>' +
        '</div>' +
        '<div class="reveal-card" style="margin:0 0 12px;">' +
          '<div style="font-size:34px;line-height:1;margin-bottom:6px;">' + ev.emoji + '</div>' +
          '<div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px;">' + ev.title + '</div>' +
          '<div style="font-size:13px;color:var(--text-dim);line-height:1.7;">' + ev.text + '</div>' +
          '<div style="margin-top:8px;font-size:11px;color:var(--text-muted);">' + pos + ' · 当前 OVR ' + ovr + '</div>' +
        '</div>' +
        '<div>' + optionsHtml + '</div>' +
      '</div>'
    );
  }

  function clampAttr(v) {
    var n = parseInt(v);
    if (isNaN(n)) return 50;
    return Math.max(25, Math.min(99, n));
  }

  function resolveYouthChoice(eventKey, optionId) {
    var y = STATE._youth;
    var ev = y.events[y.idx];
    if (!ev || ev.key !== eventKey) return;
    var opt = ev.options.filter(function (o) { return o.id === optionId; })[0];
    if (!opt) return;

    // 掷结果
    var roll = Math.random();
    var acc = 0, picked = opt.outcomes[0];
    for (var i = 0; i < opt.outcomes.length; i++) {
      acc += opt.outcomes[i].prob;
      if (roll < acc) { picked = opt.outcomes[i]; break; }
    }

    // 应用属性变化
    var deltaText = [];
    var totalDelta = 0;
    Object.keys(picked.attrs || {}).forEach(function (key) {
      var delta = picked.attrs[key];
      if (!delta) return;
      var old = clampAttr(STATE.attrs[key]);
      var next = clampAttr(old + delta);
      STATE.attrs[key] = next;
      var realDelta = next - old;
      totalDelta += realDelta;
      if (realDelta !== 0) {
        deltaText.push(
          '<span style="color:' + (realDelta > 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;">' +
            youthAttrLabel(key) + ' ' + (realDelta > 0 ? '+' : '') + realDelta + '</span>'
        );
      }
    });
    var oldOvr = STATE.finalOVR || calcOVR(STATE.attrs, STATE.position);
    STATE.finalOVR = calcOVR(STATE.attrs, STATE.position);
    var ovrDelta = STATE.finalOVR - oldOvr;
    y.attrDeltas[ev.key] = picked.attrs || {};
    y.history.push({
      eventKey: ev.key, title: ev.title, optionId: opt.id, optionLabel: opt.label,
      text: picked.text, attrs: picked.attrs || {}, ovrDelta: ovrDelta
    });

    renderYouthOutcome(ev, opt, picked, deltaText, ovrDelta);
  }

  function renderYouthOutcome(ev, opt, picked, deltaText, ovrDelta) {
    var y = STATE._youth;
    var isLast = y.idx >= y.events.length - 1;
    var btnLabel = isLast ? '🎓 结束青训，进入选秀' : '下一课 →';

    renderYouthBase(
      '<div style="padding:16px 12px;">' +
        '<div class="reveal-card" style="text-align:center;border-color:' + (ovrDelta > 0 ? 'var(--green)' : 'var(--border)') + ';">' +
          '<div style="font-size:40px;line-height:1;margin-bottom:8px;">' + (ovrDelta > 0 ? '📈' : (ovrDelta < 0 ? '📉' : '🤝')) + '</div>' +
          '<div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">' + ev.title + '</div>' +
          '<div style="font-size:14px;color:var(--text);line-height:1.7;margin-bottom:10px;">' + picked.text + '</div>' +
          (deltaText.length > 0
            ? '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:10px;">' + deltaText.join('') + '</div>'
            : '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">状态平稳，无明显变化。</div>') +
          (ovrDelta !== 0
            ? '<div style="font-size:13px;font-weight:700;color:var(--orange);">OVR ' + (STATE.finalOVR) + '（' + (ovrDelta > 0 ? '+' : '') + ovrDelta + '）</div>'
            : '<div style="font-size:13px;font-weight:700;color:var(--text-dim);">OVR ' + STATE.finalOVR + '</div>') +
        '</div>' +
        '<div style="text-align:center;margin-top:12px;">' +
          '<button class="btn btn-primary" style="max-width:280px;margin:0 auto;" onclick="advanceYouthTraining()">' + btnLabel + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function advanceYouthTraining() {
    var y = STATE._youth;
    y.idx++;
    if (y.idx >= y.events.length) {
      finishYouthTraining();
    } else {
      renderYouthEvent();
    }
  }

  function finishYouthTraining() {
    var y = STATE._youth;
    if (!y) return;
    y.finished = true;
    if (STATE.career) {
      STATE.career.youthDone = true;
      STATE.career.youthHistory = y.history;
    }

    // 青训总结
    var deltaRows = '';
    var totalOvr = 0;
    y.history.forEach(function (h) {
      var attrsText = [];
      Object.keys(h.attrs || {}).forEach(function (key) {
        var d = h.attrs[key];
        if (d) attrsText.push(youthAttrLabel(key) + ' ' + (d > 0 ? '+' : '') + d);
      });
      totalOvr += h.ovrDelta || 0;
      deltaRows +=
        '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:10px;margin-bottom:6px;">' +
          '<span style="font-size:16px;">' + (h.ovrDelta > 0 ? '📈' : (h.ovrDelta < 0 ? '📉' : '➡️')) + '</span>' +
          '<span style="flex:1;font-size:12px;color:var(--text);font-weight:600;">' + h.title + '</span>' +
          '<span style="font-size:10px;color:var(--text-dim);">' + (attrsText.length ? attrsText.join(' · ') : '平稳') + '</span>' +
        '</div>';
    });

    var pos = STATE.position ? (SIM_CONFIG.POSITIONS[STATE.position] || STATE.position) : '';
    renderYouthBase(
      '<div style="padding:16px 12px;">' +
        '<div class="reveal-card" style="text-align:center;">' +
          '<div style="font-size:40px;line-height:1;margin-bottom:6px;">🎓</div>' +
          '<div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:var(--text);">青训结束</div>' +
          '<div style="font-size:12px;color:var(--text-dim);margin:4px 0 12px;">带着这几项成长的成果，准备迎接选秀夜。</div>' +
          '<div style="font-family:var(--font-display);font-size:15px;color:var(--orange);font-weight:700;">' + pos + ' · OVR ' + STATE.finalOVR + '（' + (totalOvr > 0 ? '+' : '') + totalOvr + '）</div>' +
        '</div>' +
        '<div style="margin-top:10px;">' + deltaRows + '</div>' +
        '<div style="text-align:center;margin-top:14px;">' +
          '<button class="btn btn-primary" style="max-width:280px;margin:0 auto;" onclick="continueAfterYouth()">🏀 进入选秀 / 生涯</button>' +
        '</div>' +
      '</div>'
    );
  }

  /** 青训完成后，接回原来的生涯/选秀流程 */
  function continueAfterYouth() {
    var c = STATE.career || {};
    c.youthDone = true;
    if (typeof showScreen === 'function') showScreen('screen-career');
    // 清空阵容缓存，让新 OVR 生效
    if (typeof clearLineupCache === 'function') clearLineupCache();
    if (typeof shouldRunDraftStory === 'function' && shouldRunDraftStory()) {
      if (typeof showDraftStory === 'function') showDraftStory();
      else if (typeof renderCareerSpin === 'function') renderCareerSpin();
    } else if (typeof renderCareerSpin === 'function') {
      renderCareerSpin();
    }
  }

  window.startYouthTraining = startYouthTraining;
  window.beginYouthTraining = beginYouthTraining;
  window.resolveYouthChoice = resolveYouthChoice;
  window.advanceYouthTraining = advanceYouthTraining;
  window.continueAfterYouth = continueAfterYouth;
})();
