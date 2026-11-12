/* The only bridge between the legacy tracker state and the additive System modules. */
(function attachSystemApp(root) {
  function create(api) {
    const config = api.config.system || {};
    const P = root.SystemProgression, T = root.SystemTrials, UI = root.SystemDashboard;
    const STAT_NAMES = { strength: 'Strength', intellect: 'Intellect', influence: 'Influence', wealth: 'Wealth' };
    let initialized = false, formType = null, moments = [];
    const data = () => api.state();
    const system = () => data().system;
    const now = () => Number(api.now());
    const iso = value => new Date(value).toISOString();
    const uniqueId = prefix => `${prefix}:${now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;
    const normalize = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const priorToTrial = at => !system().trial || Date.parse(at) < Date.parse(system().trial.startedAt);
    const upsert = event => P.putEvent(system(), event);
    const eventAt = (value, fallback) => {
      const parsed = Date.parse(value || '');
      return Number.isFinite(parsed) ? { at: new Date(parsed).toISOString(), approximate: false } : { at: iso(fallback), approximate: true };
    };
    const actualQuestDay = day => {
      const keys = api.requiredKeys(day);
      return keys.length > 0 && keys.every(key => api.isDone(day, key));
    };
    const dayEnd = day => {
      const d = api.dayDate(day); d.setHours(23, 59, 59, 999); return d;
    };
    const legacyTime = day => {
      const boundary = dayEnd(day).getTime();
      const cutoff = Date.parse(system().startedAt) - 1;
      return iso(Math.min(boundary, cutoff));
    };
    const trialEligible = at => !priorToTrial(at);

    function changedUpsert(event) {
      const before = system().events.find(row => row.id === event.id);
      const old = before ? JSON.stringify(before) : '';
      const next = upsert(event);
      return !before || JSON.stringify(next) !== old;
    }

    function recordDailyOutcome(day, at, { approximate = false, eligible = trialEligible(at), replaceAt = false } = {}) {
      const values = data().v?.[day]?.o || {};
      const amount = Math.max(0, Number(values.$) || 0);
      const messages = Math.max(0, Number(values.m) || 0);
      let changed = false;
      const incomeId = `income:${day}:o`, messageId = `messages:${day}:o`;
      if (api.isDone(day, 'o') && amount > 0) {
        changed = changedUpsert({ id: incomeId, kind: 'income', day, amount, at, approximate, trialEligible: eligible, source: approximate ? 'day-log' : 'outreach-log', ...(replaceAt ? { replaceAt: true } : {}) }) || changed;
      } else changed = P.deactivateEvent(system(), incomeId) || changed;
      if (api.isDone(day, 'o') && messages > 0) {
        changed = changedUpsert({ id: messageId, kind: 'outreachMessages', day, count: messages, at, approximate, trialEligible: eligible, source: approximate ? 'day-log' : 'outreach-log', ...(replaceAt ? { replaceAt: true } : {}) }) || changed;
      } else changed = P.deactivateEvent(system(), messageId) || changed;
      return changed;
    }

    function recordQuest(key, day, at = now(), { approximate = false, eligible = trialEligible(at), source = 'quest', replaceAt = true } = {}) {
      const time = iso(at);
      const changed = changedUpsert({ id: `quest:${day}:${key}`, kind: 'quest', key, day, at: time, approximate, trialEligible: eligible, source, ...(replaceAt ? { replaceAt: true } : {}) });
      if (key === 'o') recordDailyOutcome(day, time, { approximate, eligible, replaceAt });
      return changed;
    }

    function syncWebsiteSite(site, legacy = false) {
      if (!site?.id) return false;
      const stage = Math.max(0, ['Built', 'Sent', 'Replied', 'Sold'].indexOf(site.status));
      let changed = false;
      const milestones = [
        { index: 1, field: 'sentAt', kind: 'siteSent', id: `site-sent:${site.id}` },
        { index: 2, field: 'repliedAt', kind: 'ownerReply', id: `reply:${normalize(site.name) || site.id}` },
        { index: 3, field: 'soldAt', kind: 'siteSold', id: `site-sale:${site.id}` },
      ];
      for (const item of milestones) {
        if (stage < item.index) { changed = P.deactivateEvent(system(), item.id) || changed; continue; }
        const fallback = site.updatedAt || site.createdAt || system().startedAt;
        const time = eventAt(site[item.field], fallback);
        const event = {
          id: item.id, kind: item.kind, siteId: site.id, siteName: site.name || '',
          ownerKey: normalize(site.name) || site.id, at: time.at,
          approximate: legacy || time.approximate,
          trialEligible: trialEligible(time.at),
          source: legacy || time.approximate ? 'saved-site-status' : 'website-status',
        };
        changed = changedUpsert(event) || changed;
        if (item.kind === 'siteSold' && (!system().firstSaleAt || Date.parse(time.at) < Date.parse(system().firstSaleAt))) system().firstSaleAt = time.at;
      }
      return changed;
    }

    function seedLegacy() {
      const s = data();
      let changed = false;
      for (let day = 1; day <= api.durationDays; day++) {
        for (const key of Object.keys(s.d?.[day] || {})) {
          if (api.isDone(day, key)) changed = recordQuest(key, day, legacyTime(day), { approximate: true, eligible: false, source: 'legacy', replaceAt: false }) || changed;
        }
        if ((s.v?.[day]?.o?.$ || 0) > 0 || (s.v?.[day]?.o?.m || 0) > 0) {
          changed = recordDailyOutcome(day, legacyTime(day), { approximate: true, eligible: false }) || changed;
        }
        for (const [bookId, pages] of Object.entries(s.rd?.[day] || {})) {
          const count = Array.isArray(pages) ? new Set(pages).size : 0;
          if (count) changed = changedUpsert({ id: `reading:${day}:${bookId}`, kind: 'readingSession', day, bookId, pages: count, at: legacyTime(day), approximate: true, trialEligible: false, source: 'legacy-library-log' }) || changed;
        }
      }
      for (const [bookId, book] of Object.entries(s.lib || {})) {
        if (book?.n > 0 && book.m >= book.n) {
          const key = normalize(book.t || bookId);
          changed = changedUpsert({ id: `book:${key}`, kind: 'bookFinished', bookKey: key, title: book.t || bookId, note: '', at: legacyTime(api.today()), approximate: true, trialEligible: false, source: 'legacy-library' }) || changed;
        }
      }
      for (const site of s.websites || []) changed = syncWebsiteSite(site, true) || changed;
      const sales = P.activeEvents(system()).filter(event => event.kind === 'siteSold').sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      if (sales.length && !system().firstSaleAt) system().firstSaleAt = sales[0].at;
      return changed;
    }

    function ensure() {
      const s = data(), first = !s.system || typeof s.system !== 'object';
      const preUpgradeRank = first ? api.rankFromLevel(api.levelFromXp(api.legacyXp())) : s.system.rank;
      const result = P.ensure(s, { config, now: now(), day: api.today(), initialRank: preUpgradeRank });
      let changed = !!result.migrated;
      if (!system().legacySeeded) {
        if (actualQuestDay(api.today())) system().momentumSuppressedDays[api.today()] = true;
        changed = seedLegacy() || changed;
        system().legacySeeded = true;
        changed = true;
      }
      if (!initialized) initialized = true;
      changed = advancePastMomentum() || changed;
      changed = expireGate() || changed;
      changed = recordPartTimes() || changed;
      if (changed) api.save();
      return system();
    }

    function recordLibraryPage(bookId, page) {
      ensure();
      const s = data(), rows = s.rd?.[api.today()]?.[bookId];
      const pages = Array.isArray(rows) ? new Set(rows).size : 0;
      if (!pages) return false;
      const at = iso(now()), changed = changedUpsert({ id: `reading:${api.today()}:${bookId}`, kind: 'readingSession', day: api.today(), bookId, pages, at, approximate: false, trialEligible: trialEligible(at), source: 'library' });
      const book = s.lib?.[bookId];
      if (book?.n > 0 && book.m >= book.n) {
        const key = normalize(book.t || bookId);
        changedUpsert({ id: `book:${key}`, kind: 'bookFinished', bookKey: key, title: book.t || bookId, note: '', at, approximate: false, trialEligible: trialEligible(at), source: 'library' });
      }
      if (changed) { recordPartTimes(); api.save(); }
      return changed;
    }

    function addMoment(kind, detail = {}) {
      const rank = { rank: 0, sale: 1, arise: 2, level: 3 }[kind] ?? 4;
      if (moments.some(item => item.kind === kind && item.key === detail.key)) return;
      moments.push({ kind, ...detail, key: detail.key || `${kind}:${now()}` });
      moments.sort((a, b) => ({ rank: 0, sale: 1, arise: 2, level: 3 }[a.kind] ?? 4) - ({ rank: 0, sale: 1, arise: 2, level: 3 }[b.kind] ?? 4));
      if (kind === 'level') api.milestoneEffects('level');
    }

    function level() { return api.levelFromXp(api.legacyXp() + (Number(system()?.bonusXp) || 0)); }
    function recordPartTimes() {
      const s = system();
      if (!s?.trial) return false;
      const calculation = T.calculate(s, config, api.trialContext());
      if (!calculation) return false;
      let changed = false;
      for (const part of [...calculation.parts, ...(calculation.extra ? [calculation.extra] : [])]) {
        if (!part.complete || !part.at) continue;
        const next = { at: part.at, approximate: !!part.approximate };
        if (JSON.stringify(s.trial.partTimes[part.key]) !== JSON.stringify(next)) {
          s.trial.partTimes[part.key] = next;
          changed = true;
        }
      }
      return changed;
    }

    function promoteIfReady() {
      const s = system(), calculation = T.calculate(s, config, api.trialContext());
      if (!calculation || !calculation.parts.length || !calculation.parts.every(part => part.complete) || calculation.extra && !calculation.extra.complete) return false;
      const nowIso = iso(now()), trial = s.trial;
      const timing = P.result(trial, nowIso, config.adaptation || {});
      const partTimes = Object.fromEntries(calculation.parts.map(part => [part.key, { at: part.at, approximate: !!part.approximate }]));
      if (calculation.extra) partTimes.extra = { at: calculation.extra.at, approximate: !!calculation.extra.approximate };
      const summary = {
        id: trial.id, from: trial.from, to: trial.to, title: trial.title,
        startedAt: trial.startedAt, completedAt: nowIso, partTimes,
        elapsedDays: timing.elapsedDays, fast: timing.fast, slow: timing.slow,
      };
      s.completedTrials.push(summary);
      s.rank = trial.to;
      s.trial.completedAt = nowIso;
      s.trial.partTimes = partTimes;
      if (timing.fast) {
        s.bonusXp += timing.bonusXp;
        s.fastClimber = true;
        s.nextAdjustment = timing.nextAdjustment;
      } else s.nextAdjustment = null;
      s.lighterWeek = null;
      P.ensure(data(), { config, now: now(), day: api.today(), initialRank: s.rank });
      addMoment('rank', { from: trial.from, to: trial.to, title: `Rank ${trial.to} earned`, message: `Every part of “${trial.title}” was recorded as complete.`, key: `rank:${trial.id}:${nowIso}` });
      return true;
    }

    function afterRealAction(levelBefore = level()) {
      ensure();
      advancePastMomentum();
      updateCurrentMomentum();
      recordPartTimes();
      const promoted = promoteIfReady();
      recordPartTimes();
      const nextLevel = level();
      if (nextLevel > levelBefore) addMoment('level', { level: nextLevel, title: `Level ${nextLevel}`, message: 'Experience from a completed action moved your level forward.', key: `level:${nextLevel}:${now()}` });
      api.save();
      api.render();
      return { promoted, level: nextLevel };
    }

    function onWebsiteAdded(site) {
      ensure();
      syncWebsiteSite(site, false);
      addMoment('arise', { title: 'ARISE', message: `${site.name} has joined your Website Shadow Army.`, shadowSvg: api.shadow(true, 2, 'army'), key: `arise:${site.id}` });
      api.save(); api.render();
    }

    function onWebsiteStatus(site, oldStatus, newStatus, levelBefore = level()) {
      ensure();
      syncWebsiteSite(site, false);
      const isFirstSale = newStatus === 'Sold' && oldStatus !== 'Sold' && !P.activeEvents(system()).some(event => event.kind === 'siteSold' && event.siteId !== site.id);
      if (isFirstSale) {
        const sale = system().events.find(event => event.kind === 'siteSold' && event.siteId === site.id && event.active !== false);
        system().firstSaleAt = sale?.at || iso(now());
        addMoment('sale', { title: 'First paid sale', message: 'A real Website was marked paid. This milestone is saved.', key: `sale:${site.id}` });
      }
      afterRealAction(levelBefore);
    }

    function currentWeekKey(day = api.today()) { return String(api.weekStartDay(day)); }
    function miniStepEvent() {
      const key = currentWeekKey();
      return P.activeEvents(system()).find(event => event.kind === 'outreachMessages' && event.source === 'slow-mini-step' && event.trialId === system().trial?.id && event.weekKey === key);
    }

    function updateCurrentMomentum() {
      const s = system(), day = api.today(), awards = s.momentumAwards;
      if (api.isRest(day) || !api.requiredKeys(day).length || s.momentumSuppressedDays[day]) return false;
      const hasAward = Object.prototype.hasOwnProperty.call(awards, day);
      if (actualQuestDay(day) && !hasAward) {
        const next = P.momentum(s.momentumStep, true, config.momentum || {});
        s.momentumStep = next.step;
        s.bonusXp += next.xp;
        awards[day] = next.xp;
        return true;
      }
      if (!actualQuestDay(day) && hasAward) {
        s.bonusXp = Math.max(0, s.bonusXp - Math.max(0, Number(awards[day]) || 0));
        s.momentumStep = Math.max(0, s.momentumStep - 1);
        delete awards[day];
        return true;
      }
      return false;
    }

    function advancePastMomentum() {
      const s = system(); let changed = false;
      while (s.momentumProcessedDay < api.today() - 1) {
        const day = ++s.momentumProcessedDay;
        if (day < s.momentumStartDay || api.isRest(day) || s.momentumSuppressedDays[day] || Object.prototype.hasOwnProperty.call(s.momentumAwards, day)) continue;
        s.momentumStep = P.momentum(s.momentumStep, false, config.momentum || {}).step;
        changed = true;
      }
      return changed;
    }

    function activePauseMs(trial, end = now()) {
      const begin = Date.parse(trial.startedAt);
      return (trial.lighterBlocks || []).reduce((sum, block) => {
        const a = Math.max(begin, Date.parse(block.startedAt));
        const b = Math.min(end, Date.parse(block.endsAt));
        return sum + Math.max(0, b - a);
      }, 0);
    }

    function expireGate() {
      const s = system(), gate = s.gate;
      if (!gate || gate.completedAt || now() <= Date.parse(gate.expiresAt)) return false;
      s.gateHistory.push({ stat: gate.stat, result: 'expired', createdAt: gate.createdAt, expiredAt: iso(now()) });
      s.gate = null;
      if (formType === 'gate') formType = null;
      return true;
    }

    function offerGate() {
      const s = system();
      if (s.gate || expireGate()) return false;
      const scores = P.scores(s, config), staleAfter = (Number(config.gates?.staleDays) || 5) * 86400000;
      const cooldown = (Number(config.gates?.repeatCooldownDays) || 7) * 86400000;
      const candidates = Object.keys(STAT_NAMES).map(stat => {
        const baseline = scores.lastMovedAt[stat] || s.startedAt;
        const lastOffer = Date.parse(s.lastGateOfferByStat[stat] || 0) || 0;
        return { stat, baseline: Date.parse(baseline), lastOffer };
      }).filter(item => Number.isFinite(item.baseline) && now() - item.baseline >= staleAfter && now() - item.lastOffer >= cooldown && !(item.stat === 'strength' && api.weekday(api.today()) === 6))
        .sort((a, b) => a.baseline - b.baseline);
      const chosen = candidates[0];
      if (!chosen) return false;
      const challenge = config.gates?.challenges?.[chosen.stat] || {};
      const labels = { strength: 'Complete one real workout session', intellect: 'Read three pages and note one thing learned', influence: 'Send five genuine owner messages', wealth: 'Quote a real price to one business owner' };
      const minimum = challenge.reps || challenge.pages || challenge.messages || challenge.quotes || 1;
      s.gate = { id: uniqueId('gate'), stat: chosen.stat, title: `${STAT_NAMES[chosen.stat]} · one-hour Gate`, description: labels[chosen.stat], targetText: labels[chosen.stat], minimum, createdAt: iso(now()), expiresAt: iso(now() + (Number(config.gates?.durationMinutes) || 60) * 60000), completedAt: null };
      s.lastGateOfferByStat[chosen.stat] = iso(now());
      return true;
    }

    function longestCleanStreak() {
      let run = 0, best = 0;
      for (let day = 1; day <= api.today(); day++) {
        const keys = api.requiredKeys(day);
        const clean = api.isRest(day) || keys.length > 0 && keys.every(key => api.isDone(day, key));
        run = clean ? run + 1 : 0;
        best = Math.max(best, run);
      }
      return best;
    }

    function weeklyReport() {
      if (api.weekday(api.today()) !== (Number(config.reportWeekday) || 6)) return null;
      const weekStart = api.weekStartDay(api.today());
      const first = Math.max(1, weekStart);
      const d = api.dayDate(first), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (system().reportDismissed === key) return null;
      const cleared = {}, missed = [];
      for (let day = first; day < api.today(); day++) {
        for (const task of api.requiredKeys(day)) {
          if (api.isDone(day, task)) cleared[task] = (cleared[task] || 0) + 1;
          else missed.push(`${api.taskName(task)} · ${api.dayDate(day).toLocaleDateString(undefined, { weekday: 'short' })}`);
        }
      }
      const clearedText = Object.keys(cleared).length ? Object.entries(cleared).map(([key, value]) => `${api.taskName(key)} ×${value}`).join(' · ') : 'No required quests cleared this week.';
      const missedText = missed.length ? `${missed.slice(0, 3).join(' · ')}${missed.length > 3 ? ` · +${missed.length - 3} more` : ''}` : 'None. No required quests were missed.';
      const totals = P.scores(system(), config).totals;
      const weakest = Object.keys(STAT_NAMES).sort((a, b) => totals[a] - totals[b])[0];
      const next = { strength: 'Complete the next scheduled workout.', intellect: 'Read five pages and apply one idea.', influence: 'Send five useful owner messages.', wealth: 'Quote one honest price to a business owner.' }[weakest];
      return { key, title: `${clearedText}`, cleared: clearedText, missed: missedText, next };
    }

    function gateView() {
      const gate = system().gate;
      if (!gate || Date.parse(gate.expiresAt) <= now()) return null;
      const challenge = config.gates?.challenges?.[gate.stat] || {};
      return { ...gate, rewardXp: Number(config.gates?.clearBonusXp) || 0, timeLeft: `${Math.max(1, Math.ceil((Date.parse(gate.expiresAt) - now()) / 60000))} min`, minimum: gate.minimum, challenge };
    }

    function niceTime(value) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function model(legacyHtml = '') {
      ensure();
      const s = system(), today = api.today();
      if (offerGate()) api.save();
      const score = P.scores(s, config), totals = score.totals, band = Math.max(1, Number(config.statPoints?.barBandPoints) || 100);
      const xp = api.legacyXp() + s.bonusXp, levelNow = api.levelFromXp(xp);
      const calculation = T.calculate(s, config, api.trialContext());
      let trial = null, lighterOffer = '', lighterStatus = '';
      if (calculation) {
        const timing = P.result(s.trial, iso(now()), config.adaptation || {});
        const deadline = Date.parse(s.trial.startedAt) + Number(s.trial.targetDays) * 86400000 + activePauseMs(s.trial);
        const trialNumber = s.completedTrials.length + 1;
        const windowEnd = new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        let slowStep = '';
        if (timing.slow) {
          const event = miniStepEvent(), required = Math.max(1, Number(config.adaptation?.slowOutreachMessagesPerWeek) || 10);
          slowStep = `Send ${required} real owner messages this week · ${Math.min(required, Number(event?.count) || 0)} / ${required}`;
        }
        trial = {
          from: s.trial.from, to: s.trial.to, title: s.trial.title,
          daysLabel: `DAY ${Math.max(1, Math.floor(timing.elapsedDays) + 1)} / ${s.trial.targetDays}`,
          targetLabel: `Window ends ${windowEnd} · ${timing.fast ? 'ahead of target' : timing.slow ? 'past target; keep the final goals' : 'on-time window'}`,
          parts: calculation.parts.map(part => ({ ...part, completedAt: s.trial.partTimes?.[part.key]?.at ? niceTime(s.trial.partTimes[part.key].at) : part.at ? niceTime(part.at) : '', approximate: s.trial.partTimes?.[part.key]?.approximate ?? !!part.approximate })),
          extra: calculation.extra ? { ...calculation.extra, completedAt: calculation.extra.at ? niceTime(calculation.extra.at) : '' } : null,
          slowStep,
        };
        const acceptedLastTrial = s.lastLighterTrialNo === trialNumber - 1;
        if (timing.slow && !s.lighterWeek && s.lastLighterOfferTrialNo !== trialNumber && !acceptedLastTrial) {
          lighterOffer = 'A voluntary seven-day pause in the deadline. Your final workout, reading, reply and sale targets do not change.';
        }
        const block = s.lighterWeek;
        if (block?.trialId === s.trial.id && Date.parse(block.endsAt) > now()) {
          const recent = P.activeEvents(s, block.startedAt).filter(item => Date.parse(item.at) <= now());
          const done = block.stat === 'strength' ? recent.filter(item => item.kind === 'extraWorkout' || item.kind === 'quest' && item.key === 'w').length : recent.filter(item => item.kind === 'ideaApplied' && item.outcome).length;
          const target = block.stat === 'strength' ? Number(config.lighterWeek?.strengthSessions) || 3 : Number(config.lighterWeek?.readingIdeas) || 1;
          lighterStatus = `${STAT_NAMES[block.stat]} lighter week · ${Math.min(done, target)} / ${target} real ${block.stat === 'strength' ? 'sessions' : 'idea applied'} · deadline paused until ${niceTime(block.endsAt)}`;
        }
      }
      const trialId = s.trial?.id;
      const actions = trialId === 'E-D' ? [
        { type: 'reply', label: 'Log owner reply' }, { type: 'workout', label: 'Log workout' }, { type: 'idea', label: 'Log applied reading idea' }, { type: 'quote', label: 'Log price quote' },
      ] : trialId === 'D-C' ? [
        { type: 'workout', label: 'Log workout' }, { type: 'book', label: 'Log book + closing note' }, { type: 'testimonial', label: 'Log client testimonial' },
      ] : trialId === 'C-B' ? [
        { type: 'workout', label: 'Log workout' }, { type: 'book', label: 'Log finished book + note' }, { type: 'idea', label: 'Log result of a reading idea' },
      ] : [];
      const soldSites = (data().websites || []).filter(site => site.status === 'Sold');
      const activeGate = gateView();
      const tasks = api.requiredKeys(today).map(key => ({ key, title: api.taskName(key), description: api.taskDescription(today, key), done: api.isDone(today, key) }));
      const voiceMissed = !!api.wasYesterdayMissed();
      const daysStreak = api.streak();
      const voice = voiceMissed ? `Missed: ${api.yesterdayMissedNames()}. Next: do today’s work.` : daysStreak ? `You kept the line. Streak: ${daysStreak} days.` : 'No streak today. Begin with one real action.';
      return {
        name: config.playerName || 'Adam', rank: s.rank, level: levelNow, xp,
        xpProgress: api.xpProgress(xp), xpToNext: api.xpToNext(xp), soundEnabled: !!s.soundEnabled,
        titles: P.titleList(s, data().websites || [], longestCleanStreak()),
        stats: Object.entries(STAT_NAMES).map(([key, name]) => {
          const pts = Number(totals[key]) || 0, remainder = pts % band;
          return { key, name, points: Math.round(pts * 10) / 10, progress: remainder / band * 100, toNext: band - remainder };
        }),
        tasks, taskCount: tasks.length ? `${tasks.filter(task => task.done).length} / ${tasks.length} complete` : 'REST DAY',
        trial, logActions: actions, formHtml: formType ? UI.evidenceForm(formType, soldSites, activeGate) : '',
        gate: activeGate, formType, momentumStep: s.momentumStep, momentumMax: config.momentum?.maxSteps || 7,
        report: weeklyReport(), lighterOffer, lighterStatus, voice, voiceMissed, voiceStreak: !voiceMissed && daysStreak > 0,
        siteCount: (data().websites || []).length, legacyHtml,
      };
    }

    function introModel() {
      ensure();
      const xp = api.legacyXp() + system().bonusXp;
      return { name: config.playerName || 'Adam', rank: system().rank, level: api.levelFromXp(xp), xp };
    }

    function setForm(type) { formType = type || null; api.render(); }
    function closeForm() { formType = null; api.render(); }
    function currentMoment() { return moments[0] || null; }
    function closeMoment() { moments.shift(); api.render(); }

    function chooseLighter(choice) {
      ensure();
      const s = system(), trial = s.trial, trialNumber = s.completedTrials.length + 1;
      s.lastLighterOfferTrialNo = trialNumber;
      if (choice === 'decline') { api.save(); api.render(); return; }
      if (!['strength', 'intellect'].includes(choice) || s.lighterWeek || s.lastLighterTrialNo === trialNumber - 1) { api.toast('A lighter week is not available in consecutive trials'); return; }
      const startedAt = iso(now()), endsAt = iso(now() + (Number(config.lighterWeek?.durationDays) || 7) * 86400000);
      const block = { trialId: trial.id, trialNumber, stat: choice, startedAt, endsAt };
      trial.lighterBlocks.push(block);
      s.lighterWeek = block;
      s.lastLighterTrialNo = trialNumber;
      formType = null; api.save(); api.render();
    }

    function dismissReport() {
      const report = weeklyReport();
      if (report) { system().reportDismissed = report.key; api.save(); api.render(); }
    }

    function ignoreGate() {
      ensure();
      const gate = system().gate;
      if (!gate) return;
      system().gateHistory.push({ stat: gate.stat, result: 'ignored', createdAt: gate.createdAt, ignoredAt: iso(now()) });
      system().gate = null; if (formType === 'gate') formType = null;
      api.save(); api.render();
    }

    function readField(key) { return String(document.getElementById(`system-${key}`)?.value || '').trim(); }
    function readNumber(key) { const n = Number(readField(key)); return Number.isFinite(n) ? n : 0; }
    function logGate() {
      const s = system(), gate = s.gate, current = now();
      if (!gate || current > Date.parse(gate.expiresAt)) { expireGate(); api.toast('That one-hour Gate has closed'); api.save(); api.render(); return false; }
      const beforeLevel = level(), at = iso(current), eventId = `gate-action:${gate.id}`;
      if (gate.stat === 'strength') {
        const reps = readNumber('gateReps'); if (reps < gate.minimum || api.weekday(api.today()) === 6) { api.toast('Log the required real workout outside Saturday'); return false; }
        upsert({ id: eventId, kind: 'extraWorkout', reps, day: api.today(), at, trialEligible: true, source: 'gate' });
      } else if (gate.stat === 'intellect') {
        const pages = readNumber('gatePages'), note = readField('gateIdea'); if (pages < gate.minimum || !note) { api.toast('Enter the pages you read and one thing learned'); return false; }
        upsert({ id: eventId, kind: 'readingSession', pages, note, day: api.today(), at, trialEligible: true, source: 'gate' });
      } else if (gate.stat === 'influence') {
        const count = readNumber('gateMessages'); if (count < gate.minimum) { api.toast('Enter the real number of owner messages sent'); return false; }
        upsert({ id: eventId, kind: 'outreachMessages', count, day: api.today(), at, trialEligible: true, source: 'gate' });
      } else {
        const owner = readField('gateQuoteOwner'), amount = readNumber('gateQuoteAmount'), ownerKey = normalize(owner);
        if (!ownerKey || amount < 1) { api.toast('Enter a real business owner and quoted price'); return false; }
        upsert({ id: `quote:${ownerKey}`, kind: 'quoteSent', ownerKey, ownerName: owner, amount, at, trialEligible: true, source: 'gate' });
      }
      upsert({ id: `gate-clear:${gate.id}`, kind: 'gateClear', stat: gate.stat, at, source: 'gate' });
      s.gateHistory.push({ stat: gate.stat, result: 'cleared', createdAt: gate.createdAt, completedAt: at });
      s.bonusXp += Number(config.gates?.clearBonusXp) || 0;
      s.gate = null; formType = null;
      afterRealAction(beforeLevel);
      api.toast(`Gate cleared · +${Number(config.gates?.clearBonusXp) || 0} XP`);
      return true;
    }

    function saveForm(type) {
      ensure();
      if (type === 'gate') return logGate();
      const s = system(), at = iso(now()), beforeLevel = level();
      if (type === 'workout') {
        const reps = readNumber('reps');
        if (reps < 1 || api.weekday(api.today()) === 6) { api.toast('Enter a real workout outside Saturday'); return false; }
        upsert({ id: uniqueId('extra-workout'), kind: 'extraWorkout', reps, note: readField('workoutNote'), day: api.today(), at, trialEligible: true, source: 'trial-log' });
      } else if (type === 'idea') {
        const idea = readField('idea'), summary = readField('outreachMessage'), outcome = readField('ideaOutcome'), ideaKey = `${s.trial?.id || 'system'}:${normalize(idea)}`;
        if (!idea || !summary || !outcome) { api.toast('Enter the idea, a summary of a real message sent, and its result'); return false; }
        upsert({ id: `idea:${ideaKey}`, kind: 'ideaApplied', ideaKey, idea, messageSummary: summary, outcome, at, trialEligible: true, source: 'trial-log' });
      } else if (type === 'quote') {
        const owner = readField('quoteOwner'), ownerKey = normalize(owner), amount = readNumber('quoteAmount');
        if (!ownerKey || amount < 1) { api.toast('Enter a real business owner and quoted price'); return false; }
        upsert({ id: `quote:${ownerKey}`, kind: 'quoteSent', ownerKey, ownerName: owner, amount, note: readField('quoteNote'), at, trialEligible: true, source: 'trial-log' });
      } else if (type === 'reply') {
        const owner = readField('replyOwner'), ownerKey = normalize(owner);
        if (!ownerKey) { api.toast('Enter the business / owner who actually replied'); return false; }
        upsert({ id: `reply:${ownerKey}`, kind: 'ownerReply', ownerKey, ownerName: owner, note: readField('replyNote'), at, trialEligible: true, source: 'trial-log' });
      } else if (type === 'book') {
        const title = readField('bookTitle'), note = readField('bookNote'), bookKey = normalize(title);
        if (!bookKey || !note) { api.toast('Enter a real finished book and what you learned'); return false; }
        upsert({ id: `book:${bookKey}`, kind: 'bookFinished', bookKey, title, note, at, trialEligible: true, source: 'trial-log' });
      } else if (type === 'testimonial') {
        const siteId = readField('testimonialSite'), site = (data().websites || []).find(item => item.id === siteId && item.status === 'Sold'), note = readField('testimonialText');
        if (!site || !note) { api.toast('Select a paid client and enter a real testimonial'); return false; }
        upsert({ id: `testimonial:${site.id}`, kind: 'testimonial', siteId: site.id, siteName: site.name, note, at, trialEligible: true, source: 'trial-log' });
      } else if (type === 'messages') {
        const count = readNumber('miniMessages'), trialId = s.trial?.id;
        if (count < 1 || !trialId) { api.toast('Enter the real owner messages sent this week'); return false; }
        const weekKey = currentWeekKey();
        upsert({ id: `mini-step:${trialId}:${weekKey}`, kind: 'outreachMessages', source: 'slow-mini-step', trialId, weekKey, count: Math.min(250, count), at, trialEligible: true, replaceAt: true });
      } else { return false; }
      formType = null;
      afterRealAction(beforeLevel);
      api.toast('Action saved');
      return true;
    }

    function reopenQuest(key, day) {
      ensure();
      const s = system();
      let changed = P.deactivateEvent(s, `quest:${day}:${key}`);
      if (key === 'o') {
        changed = P.deactivateEvent(s, `income:${day}:o`) || changed;
        changed = P.deactivateEvent(s, `messages:${day}:o`) || changed;
      }
      advancePastMomentum();
      updateCurrentMomentum();
      recordPartTimes();
      api.save();
      api.render();
      return changed;
    }

    function recordDailyValues(day, key) {
      ensure();
      if (key !== 'o') return false;
      const isToday = day === api.today();
      const at = isToday ? iso(now()) : legacyTime(day);
      return recordDailyOutcome(day, at, { approximate: !isToday, eligible: isToday ? trialEligible(at) : false, replaceAt: true });
    }

    function recordImportedQuest(day, key) {
      ensure();
      const at = day === api.today() ? iso(now()) : dayEnd(day).toISOString();
      recordQuest(key, day, at, { approximate: day !== api.today(), eligible: trialEligible(at), source: 'confirmed-import', replaceAt: false });
      if (key === 'o') recordDailyOutcome(day, at, { approximate: day !== api.today(), eligible: trialEligible(at) });
    }

    function reconcileRestoredState() {
      ensure();
      const s = data();
      for (let day = 1; day <= api.durationDays; day++) {
        for (const key of Object.keys(s.d?.[day] || {})) {
          if (api.isDone(day, key) && !system().events.some(event => event.id === `quest:${day}:${key}`)) {
            recordQuest(key, day, legacyTime(day), { approximate: true, eligible: false, source: 'restored-backup', replaceAt: false });
          }
        }
      }
      system().momentumSuppressedDays[api.today()] = true;
      recordPartTimes();
    }

    function mergeIncoming(remote, local) {
      const merged = { ...remote };
      const remoteSites = Array.isArray(remote?.websites) ? remote.websites : [];
      const localSites = Array.isArray(local?.websites) ? local.websites : [];
      const sites = new Map(remoteSites.filter(site => site?.id).map(site => [site.id, site]));
      for (const site of localSites) {
        if (!site?.id) continue;
        const previous = sites.get(site.id);
        if (!previous || Date.parse(site.updatedAt || site.createdAt || 0) > Date.parse(previous.updatedAt || previous.createdAt || 0)) sites.set(site.id, site);
      }
      merged.websites = [...sites.values()];
      if (!remote?.system && local?.system) merged.system = local.system;
      return merged;
    }

    function toggleSound() { ensure(); system().soundEnabled = !system().soundEnabled; api.save(); api.render(); }
    function clearForm() { formType = null; }

    return {
      ensure, model, introModel, level, recordQuest, recordDailyValues,
      recordLibraryPage, onWebsiteAdded, onWebsiteStatus, afterRealAction, recordImportedQuest, reconcileRestoredState,
      mergeIncoming, setForm, closeForm, saveForm, chooseLighter, dismissReport, ignoreGate, reopenQuest,
      currentMoment, closeMoment, toggleSound, clearForm,
    };
  }

  root.SystemApp = { create };
})(window);
