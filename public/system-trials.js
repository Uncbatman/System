/* Rank-trial calculations. Evidence comes from saved actions or explicit self-report. */
(function attachSystemTrials(root) {
  const validRows = rows => rows.filter(row => Number.isFinite(Date.parse(row.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const uniqueBy = (rows, key) => [...new Map(rows.map(row => [key(row), row])).values()];
  const nth = (rows, count) => validRows(rows)[Math.max(0, count - 1)] || null;
  const effortTarget = (value, factor) => Math.max(1, Math.ceil((Number(value) || 1) * (Number(factor) || 1)));
  const identity = (row, key) => key ? row?.[key] || row?.id : row?.id;

  function makePart(key, stat, label, count, target, evidence, summary) {
    const required = Math.max(1, Number(target) || 1);
    const value = Math.max(0, Number(count) || 0);
    const done = value >= required;
    return {
      key, stat, label, count: value, target: required,
      progress: Math.min(100, value / required * 100),
      complete: done,
      at: done ? (typeof evidence === 'string' ? evidence : evidence?.at || null) : null,
      approximate: done && typeof evidence === 'object' ? !!evidence?.approximate : false,
      summary: summary || `${Math.min(value, required)} / ${required}`,
    };
  }

  function workoutWeeks(trial, spec, events, context, rule) {
    const rows = events.filter(event => event.kind === 'extraWorkout' || event.kind === 'quest' && ['w', 'a'].includes(event.key));
    const sessionsByDay = new Map();
    for (const event of rows) {
      const day = context.dayFromTimestamp(event.at);
      if (day < 1 || day > context.today) continue;
      if (!sessionsByDay.has(day)) sessionsByDay.set(day, []);
      sessionsByDay.get(day).push(event);
    }

    const requiredWeeks = effortTarget(rule.weeks, trial.effortFactor);
    const maxSessions = Math.max(1, Number(context.maxWorkoutsPerWeek) || 6);
    const requiredSessions = rule.mode === 'five'
      ? Math.min(maxSessions, effortTarget(rule.sessionsPerWeek, trial.effortFactor))
      : 0;
    let firstWeek = context.weekStartDay(1);
    while (firstWeek < 1) firstWeek += 7; // Ignore the partial campaign-start week.
    let run = 0, best = 0, completionAt = null;

    for (let first = firstWeek; first + 6 <= context.today; first += 7) {
      const end = first + 6;
      const weekEvents = [];
      for (let day = first; day <= end; day++) weekEvents.push(...(sessionsByDay.get(day) || []));
      const saturdayIsRest = (sessionsByDay.get(end) || []).length === 0;
      let qualified;
      if (rule.mode === 'five') {
        qualified = saturdayIsRest && weekEvents.length >= requiredSessions;
      } else {
        const scheduled = [];
        for (let day = first; day <= end; day++) {
          if (context.weekday(day) !== 6 && context.strengthDay(day)) scheduled.push(day);
        }
        qualified = saturdayIsRest && scheduled.length > 0 && scheduled.every(day => (sessionsByDay.get(day) || []).length > 0);
      }
      run = qualified ? run + 1 : 0;
      if (run > best) best = run;
      if (!completionAt && run >= requiredWeeks) completionAt = validRows(weekEvents).at(-1) || null;
    }

    const weekStart = context.weekStartDay(context.today);
    const sessionsThisWeek = [...sessionsByDay.entries()]
      .filter(([day]) => day >= weekStart && day <= context.today)
      .reduce((total, [, items]) => total + items.length, 0);
    return {
      consecutive: best,
      requiredWeeks,
      progress: Math.min(100, best / requiredWeeks * 100),
      complete: best >= requiredWeeks,
      at: best >= requiredWeeks ? completionAt : null,
      sessionsThisWeek,
      weeklyTarget: requiredSessions,
    };
  }

  function calculate(system, config, context) {
    const trial = system?.trial;
    if (!trial) return null;
    const spec = (config.rankTrials || []).find(item => item.id === trial.id);
    if (!spec) return null;
    const all = (system.events || []).filter(event => event.active !== false && Number.isFinite(Date.parse(event.at)));
    const began = Date.parse(trial.startedAt);
    const current = all.filter(event => event.trialEligible !== false && Date.parse(event.at) >= began);
    const goals = spec.goals || {};
    const effort = Number(trial.effortFactor) || 1;
    let parts = [], extra = null, stats = {};

    if (trial.id === 'E-D') {
      const replies = uniqueBy(current.filter(event => event.kind === 'ownerReply'), event => identity(event, 'ownerKey'));
      const ideas = uniqueBy(current.filter(event => event.kind === 'ideaApplied' && event.outcome), event => identity(event, 'ideaKey'));
      const quotes = uniqueBy(current.filter(event => event.kind === 'quoteSent'), event => identity(event, 'ownerKey'));
      const strength = workoutWeeks(trial, spec, all, context, { mode: 'five', sessionsPerWeek: goals.workoutsPerWeek, weeks: goals.workoutWeeks });
      const ideaTarget = effortTarget(goals.ideasApplied, effort);
      const quoteTarget = effortTarget(goals.priceQuotes, effort);
      parts = [
        makePart('reply', 'Influence', 'Owner reply', replies.length, goals.ownerReplies, nth(replies, goals.ownerReplies), `${Math.min(replies.length, goals.ownerReplies)} / ${goals.ownerReplies}`),
        makePart('strength', 'Strength', 'Workouts per week', strength.complete ? strength.requiredWeeks : strength.consecutive, strength.requiredWeeks, strength.at, `${Math.min(strength.consecutive, strength.requiredWeeks)} / ${strength.requiredWeeks} full weeks · this week ${strength.sessionsThisWeek} / ${strength.weeklyTarget}`),
        makePart('ideas', 'Intellect', 'Ideas used in outreach', ideas.length, ideaTarget, nth(ideas, ideaTarget), `${Math.min(ideas.length, ideaTarget)} / ${ideaTarget}`),
        makePart('quotes', 'Wealth', 'Unique owners quoted', quotes.length, quoteTarget, nth(quotes, quoteTarget), `${Math.min(quotes.length, quoteTarget)} / ${quoteTarget}`),
      ];
      stats = { workouts: strength };
    } else if (trial.id === 'D-C') {
      const sales = uniqueBy(all.filter(event => event.kind === 'siteSold'), event => identity(event, 'siteId'));
      const soldIds = new Set(sales.map(event => event.siteId).filter(Boolean));
      const testimonials = uniqueBy(current.filter(event => event.kind === 'testimonial' && soldIds.has(event.siteId)), event => event.siteId);
      const books = uniqueBy(current.filter(event => event.kind === 'bookFinished' && event.note), event => identity(event, 'bookKey'));
      const strength = workoutWeeks(trial, spec, all, context, { mode: 'full', weeks: goals.fullWorkoutWeeks });
      const bookTarget = effortTarget(goals.booksFinished, effort);
      parts = [
        makePart('sale', 'Wealth', 'First paid website', sales.length, goals.paidSites, nth(sales, goals.paidSites), `${Math.min(sales.length, goals.paidSites)} / ${goals.paidSites}`),
        makePart('testimonial', 'Influence', 'Client testimonial', testimonials.length, goals.clientTestimonials, nth(testimonials, goals.clientTestimonials), `${Math.min(testimonials.length, goals.clientTestimonials)} / ${goals.clientTestimonials}`),
        makePart('strength', 'Strength', 'Full workout weeks', strength.complete ? strength.requiredWeeks : strength.consecutive, strength.requiredWeeks, strength.at, `${Math.min(strength.consecutive, strength.requiredWeeks)} / ${strength.requiredWeeks} full weeks`),
        makePart('books', 'Intellect', 'Book + closing note', books.length, bookTarget, nth(books, bookTarget), `${Math.min(books.length, bookTarget)} / ${bookTarget}`),
      ];
      stats = { workouts: strength };
    } else if (trial.id === 'C-B') {
      const sales = uniqueBy(all.filter(event => event.kind === 'siteSold'), event => identity(event, 'siteId'));
      const income = validRows(all.filter(event => event.kind === 'income'));
      const wealthTarget = Math.max(1, Number(goals.totalKsh) || 1);
      let totalKsh = 0, wealthEvidence = null;
      for (const event of income) {
        totalKsh += Math.max(0, Number(event.amount) || 0);
        if (!wealthEvidence && totalKsh >= wealthTarget) wealthEvidence = event;
      }
      const strength = workoutWeeks(trial, spec, all, context, { mode: 'full', weeks: goals.fullWorkoutWeeks });
      const books = uniqueBy(current.filter(event => event.kind === 'bookFinished' && event.note), event => identity(event, 'bookKey'));
      const ideas = uniqueBy(current.filter(event => event.kind === 'ideaApplied' && event.outcome), event => identity(event, 'ideaKey'));
      const bookTarget = effortTarget(goals.booksFinished, effort);
      const ideaTarget = effortTarget(goals.ideaResults, effort);
      const bookEvidence = nth(books, bookTarget), ideaEvidence = nth(ideas, ideaTarget);
      const intellectComplete = books.length >= bookTarget && ideas.length >= ideaTarget;
      const intellectProgress = Math.round((Math.min(1, books.length / bookTarget) + Math.min(1, ideas.length / ideaTarget)) * 50);
      const intellectAt = bookEvidence && ideaEvidence
        ? (Date.parse(bookEvidence.at) >= Date.parse(ideaEvidence.at) ? bookEvidence : ideaEvidence)
        : null;
      parts = [
        makePart('clients', 'Influence', 'Paying clients', sales.length, goals.payingClients, nth(sales, goals.payingClients), `${Math.min(sales.length, goals.payingClients)} / ${goals.payingClients}`),
        makePart('wealth', 'Wealth', 'Lifetime Ksh earned', totalKsh, wealthTarget, wealthEvidence, `${Math.min(totalKsh, wealthTarget).toLocaleString()} / ${wealthTarget.toLocaleString()} Ksh`),
        makePart('strength', 'Strength', 'Full workout weeks', strength.complete ? strength.requiredWeeks : strength.consecutive, strength.requiredWeeks, strength.at, `${Math.min(strength.consecutive, strength.requiredWeeks)} / ${strength.requiredWeeks} full weeks`),
        { key: 'intellect', stat: 'Intellect', label: 'Books + idea results', count: intellectComplete ? 2 : Number(books.length >= bookTarget) + Number(ideas.length >= ideaTarget), target: 2, progress: intellectProgress, complete: intellectComplete, at: intellectAt?.at || null, approximate: !!intellectAt?.approximate, summary: `${Math.min(books.length, bookTarget)} / ${bookTarget} books · ${Math.min(ideas.length, ideaTarget)} / ${ideaTarget} ideas` },
      ];

      const startDay = Math.max(1, context.dayFromTimestamp(trial.startedAt) + 1);
      const needed = Math.max(1, Number(goals.unbrokenQuestDays) || 7);
      let run = 0, best = 0, streakAt = null;
      for (let day = startDay; day <= context.today; day++) {
        run = context.noMissedQuestDay(day) ? run + 1 : 0;
        if (run > best) best = run;
        if (!streakAt && run >= needed) streakAt = { at: context.dayEndAt(day), approximate: true };
      }
      extra = { label: 'Additional condition · unbroken days', count: best, target: needed, progress: Math.min(100, best / needed * 100), complete: best >= needed, at: best >= needed ? streakAt?.at : null, approximate: !!streakAt?.approximate, summary: `${Math.min(best, needed)} / ${needed} days` };
      stats = { workouts: strength, totalKsh, wealthAt: wealthEvidence?.at || null, unbrokenDays: best };
    }
    return { trial, spec, parts, extra, stats, allEvents: all, currentEvents: current };
  }

  root.SystemTrials = { calculate, workoutWeeks, effortTarget };
})(window);
