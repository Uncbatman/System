/* Additive progression support. The legacy quest XP curve remains in app.js. */
(function attachSystemProgression(root) {
  const VALID_RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
  const iso = value => new Date(value).toISOString();

  function startTrial(system, config, at, day) {
    const spec = (config.rankTrials || []).find(item => item.from === system.rank);
    if (!spec) {
      system.trial = null;
      system.nextAdjustment = null;
      return;
    }
    const adjustment = system.nextAdjustment || null;
    system.trial = {
      id: spec.id,
      from: spec.from,
      to: spec.to,
      title: spec.title,
      startedAt: iso(at),
      startedDay: Number(day) || 1,
      baseTargetDays: Number(spec.targetDays) || 1,
      targetDays: Math.max(1, Math.ceil((Number(spec.targetDays) || 1) * (Number(adjustment?.windowFactor) || 1))),
      effortFactor: Math.max(1, Number(adjustment?.effortFactor) || 1),
      partTimes: {},
      completedAt: null,
      lighterBlocks: [],
      miniWeeks: {},
    };
    system.nextAdjustment = null;
  }

  function ensure(state, { config = {}, now = Date.now(), day = 1, initialRank = 'E' } = {}) {
    let migrated = false;
    if (!state.system || typeof state.system !== 'object' || Array.isArray(state.system)) {
      state.system = {
        version: 1,
        startedAt: iso(now),
        startedDay: Number(day) || 1,
        rank: VALID_RANKS.includes(initialRank) ? initialRank : 'E',
        trial: null,
        completedTrials: [],
        events: [],
        bonusXp: 0,
        momentumStep: 0,
        momentumProcessedDay: (Number(day) || 1) - 1,
        momentumStartDay: Number(day) || 1,
        momentumAwards: {},
        momentumSuppressedDays: {},
        soundEnabled: !!config.soundDefault,
        firstSaleAt: null,
        reportDismissed: '',
        gate: null,
        gateHistory: [],
        lastGateOfferByStat: {},
        nextAdjustment: null,
        fastClimber: false,
        lighterWeek: null,
        lastLighterTrialNo: 0,
        lastLighterOfferTrialNo: 0,
        legacySeeded: false,
      };
      migrated = true;
    }
    const system = state.system;
    if (!VALID_RANKS.includes(system.rank)) {
      system.rank = VALID_RANKS.includes(initialRank) ? initialRank : 'E';
      migrated = true;
    }
    const defaults = {
      version: 1,
      startedAt: iso(now),
      startedDay: Number(day) || 1,
      trial: null,
      completedTrials: [],
      events: [],
      bonusXp: 0,
      momentumStep: 0,
      momentumProcessedDay: (Number(day) || 1) - 1,
      momentumStartDay: Number(day) || 1,
      momentumAwards: {},
      momentumSuppressedDays: {},
      soundEnabled: !!config.soundDefault,
      firstSaleAt: null,
      reportDismissed: '',
      gate: null,
      gateHistory: [],
      lastGateOfferByStat: {},
      nextAdjustment: null,
      fastClimber: false,
      lighterWeek: null,
      lastLighterTrialNo: 0,
      lastLighterOfferTrialNo: 0,
      legacySeeded: false,
    };
    for (const [key, fallback] of Object.entries(defaults)) {
      if (system[key] === undefined || (system[key] === null && !['trial', 'gate', 'nextAdjustment', 'lighterWeek'].includes(key))) {
        system[key] = fallback;
        migrated = true;
      }
    }
    for (const key of ['events', 'completedTrials', 'gateHistory']) {
      if (!Array.isArray(system[key])) { system[key] = []; migrated = true; }
    }
    for (const key of ['momentumAwards', 'momentumSuppressedDays', 'lastGateOfferByStat']) {
      if (!system[key] || typeof system[key] !== 'object' || Array.isArray(system[key])) {
        system[key] = {};
        migrated = true;
      }
    }
    system.bonusXp = Math.max(0, Number(system.bonusXp) || 0);
    system.momentumStep = Math.max(0, Number(system.momentumStep) || 0);
    const spec = (config.rankTrials || []).find(item => item.from === system.rank);
    if (system.trial?.id !== spec?.id) {
      startTrial(system, config, now, day);
      migrated = true;
    }
    if (system.trial) {
      if (!system.trial.partTimes || typeof system.trial.partTimes !== 'object' || Array.isArray(system.trial.partTimes)) { system.trial.partTimes = {}; migrated = true; }
      if (!Array.isArray(system.trial.lighterBlocks)) { system.trial.lighterBlocks = []; migrated = true; }
      if (!system.trial.miniWeeks || typeof system.trial.miniWeeks !== 'object' || Array.isArray(system.trial.miniWeeks)) { system.trial.miniWeeks = {}; migrated = true; }
    }
    return { migrated, system };
  }

  function putEvent(system, event) {
    if (!event || !event.id || !event.kind) return null;
    const existing = system.events.find(item => item.id === event.id);
    const next = { ...event, active: event.active !== false };
    if (existing) {
      const replaceAt = !!next.replaceAt;
      delete next.replaceAt;
      const originalAt = existing.at;
      Object.assign(existing, next);
      if (!replaceAt && originalAt) existing.at = originalAt;
      return existing;
    }
    delete next.replaceAt;
    if (!next.at) next.at = new Date().toISOString();
    system.events.push(next);
    return next;
  }

  function deactivateEvent(system, id) {
    const event = system.events.find(item => item.id === id);
    if (!event) return false;
    event.active = false;
    return true;
  }

  function activeEvents(system, after = -Infinity) {
    const floor = typeof after === 'number' ? after : Date.parse(after);
    return (system?.events || []).filter(event => event.active !== false && Number.isFinite(Date.parse(event.at)) && Date.parse(event.at) >= floor);
  }

  function scores(system, config = {}) {
    const points = config.statPoints || {};
    const totals = { strength: 0, intellect: 0, influence: 0, wealth: 0 };
    const lastMovedAt = { strength: null, intellect: null, influence: null, wealth: null };
    let totalKsh = 0, lastIncomeAt = null;
    const replyOwners = new Set();
    const award = (stat, value, at) => {
      if (!stat || !Number.isFinite(value) || value <= 0) return;
      totals[stat] += value;
      const time = Date.parse(at);
      if (!lastMovedAt[stat] || time > Date.parse(lastMovedAt[stat])) lastMovedAt[stat] = at;
    };
    for (const event of activeEvents(system)) {
      switch (event.kind) {
        case 'quest':
          if (event.key === 'r') award('intellect', points.readingQuest || 0, event.at);
          if (event.key === 'l') award('intellect', points.learningQuest || 0, event.at);
          if (event.key === 'w') award('strength', points.strengthWorkout || 0, event.at);
          if (event.key === 'a') award('strength', points.bonusWorkout || 0, event.at);
          if (event.key === 'o') award('influence', points.outreachQuest || 0, event.at);
          break;
        case 'extraWorkout': award('strength', points.strengthWorkout || 0, event.at); break;
        case 'siteSent': award('influence', points.siteSent || 0, event.at); break;
        case 'ownerReply': {
          const owner = String(event.ownerKey || event.id).trim().toLowerCase();
          if (!replyOwners.has(owner)) {
            replyOwners.add(owner);
            award('influence', points.ownerReply || 0, event.at);
          }
          break;
        }
        case 'gateClear':
          if (['strength', 'intellect', 'influence', 'wealth'].includes(event.stat)) award(event.stat, points.gateClear || 0, event.at);
          break;
        case 'testimonial': award('influence', points.testimonial || 0, event.at); break;
        case 'quoteSent': award('influence', points.priceQuote || 0, event.at); break;
        case 'bookFinished': award('intellect', points.bookFinished || 0, event.at); break;
        case 'siteSold': award('wealth', points.paidSite || 0, event.at); break;
        case 'readingSession': award('intellect', (points.readingSession || 0) * Math.max(0, Number(event.pages) || 0), event.at); break;
        case 'outreachMessages': award('influence', (points.outreachMessage || 0) * Math.max(0, Number(event.count) || 0), event.at); break;
        case 'ideaApplied':
          award('intellect', points.readingApplication || 0, event.at);
          award('influence', points.outreachMessage || 0, event.at);
          break;
        case 'income':
          totalKsh += Math.max(0, Number(event.amount) || 0);
          if (!lastIncomeAt || Date.parse(event.at) > Date.parse(lastIncomeAt)) lastIncomeAt = event.at;
          break;
        default: break;
      }
    }
    award('wealth', totalKsh / Math.max(1, points.kshPerWealthPoint || 100), lastIncomeAt);
    return { totals, totalKsh, lastMovedAt };
  }

  function titleList(system, websites = [], longestStreak = 0) {
    const events = activeEvents(system);
    const titles = [];
    if (events.some(event => event.kind === 'ownerReply')) titles.push('First Reply');
    if (events.some(event => event.kind === 'siteSold')) titles.push('First Sale');
    if (longestStreak >= 7) titles.push('7 Days Unbroken');
    if (websites.length >= 10) titles.push('10 Sites Built');
    if (system?.fastClimber) titles.push('Fast climber');
    return titles;
  }

  function momentum(beforeStep, completed, config = {}) {
    const max = Math.max(1, Number(config.maxSteps) || 7);
    const next = completed ? Math.min(max, Math.max(0, Number(beforeStep) || 0) + 1) : Math.max(0, (Number(beforeStep) || 0) - 1);
    return { step: next, xp: completed ? Math.max(0, Number((config.xpByStep || [])[next]) || 0) : 0 };
  }

  function result(trial, at, config = {}) {
    const end = Date.parse(at);
    const begin = Date.parse(trial.startedAt);
    const pauses = (trial.lighterBlocks || []).reduce((total, block) => {
      const start = Date.parse(block.startedAt);
      const finish = Math.min(end, Date.parse(block.endsAt));
      return total + Math.max(0, finish - Math.max(begin, start));
    }, 0);
    const elapsedDays = Math.max(0, (end - begin - pauses) / 86400000);
    const fast = elapsedDays < trial.targetDays;
    const slow = elapsedDays > trial.targetDays;
    const adaptation = config.adaptation || {};
    return {
      elapsedDays,
      fast,
      slow,
      bonusXp: fast ? Number(adaptation.fastBonusXp) || 0 : 0,
      nextAdjustment: fast ? {
        effortFactor: Number(adaptation.fastEffortFactor) || 1.25,
        windowFactor: Number(adaptation.fastWindowFactor) || 0.75,
      } : null,
    };
  }

  root.SystemProgression = { ensure, putEvent, deactivateEvent, activeEvents, scores, titleList, momentum, result };
})(window);
