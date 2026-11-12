/* Status and Website-army templates. app.js remains the only state owner. */
(function attachSystemDashboard(root) {
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  const count = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0';

  function intro(model) {
    return `<section class="system-intro" role="status" aria-label="Player rank and level"><div class="system-intro-frame"><div class="system-kicker">SYSTEM</div><div class="system-player">Player: ${esc(model.name)}</div><div class="system-intro-rank rank-${esc(model.rank)}">${esc(model.rank)} Rank · Level ${Number(model.level) || 1}</div><div class="system-intro-xp">${count(model.xp)} XP</div><button class="system-skip" data-skip-intro>Tap to skip</button></div></section>`;
  }

  function bar(value, label) {
    const progress = clamp(value);
    return `<div class="system-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div>`;
  }

  function part(item) {
    const saved = item.completedAt ? `<div class="trial-time">Recorded ${esc(item.completedAt)}${item.approximate ? ' · time-of-day not available in the earlier log' : ''}</div>` : '';
    return `<div class="trial-part ${item.complete ? 'complete' : ''}"><div class="row sp"><span class="trial-part-name">${esc(item.stat)} · ${esc(item.label)}</span><span class="trial-part-value">${esc(item.summary)}</span></div>${bar(item.progress, `${item.stat} trial progress`)}${saved}</div>`;
  }

  function evidenceForm(type, soldSites = [], gate = null) {
    const input = (key, label, { number = false, required = true, min = 0, max = 60000, maxlength = 240 } = {}) =>
      `<label class="system-field"><span>${esc(label)}${required ? ' <b>*</b>' : ' <small>optional</small>'}</span><input id="system-${esc(key)}" data-system-field="${esc(key)}" ${number ? `type="number" inputmode="numeric" min="${min}" max="${max}" step="1"` : 'type="text"'} maxlength="${maxlength}" ${required ? 'required' : ''}></label>`;
    const area = (key, label, placeholder, required = true) =>
      `<label class="system-field"><span>${esc(label)}${required ? ' <b>*</b>' : ' <small>optional</small>'}</span><textarea id="system-${esc(key)}" data-system-field="${esc(key)}" maxlength="400" placeholder="${esc(placeholder)}" ${required ? 'required' : ''}></textarea></label>`;
    const save = `<div class="row system-form-actions"><button class="system-button" data-system-log-save="${esc(type)}">Save log</button><button class="system-button quiet" data-system-log-cancel>Cancel</button></div>`;
    const wrap = (title, help, fields) => `<section class="system-evidence-form"><div class="system-kicker">REAL ACTION LOG</div><h3>${esc(title)}</h3><p class="system-muted">${esc(help)}</p>${fields}${save}</section>`;

    if (type === 'workout') return wrap('Log a workout', 'Enter a real session on a non-Saturday. It counts toward workout weeks.', input('reps', 'Reps or seconds completed', { number: true, min: 1 }) + input('workoutNote', 'Session note', { required: false }));
    if (type === 'idea') return wrap('Apply a reading idea', 'Log one idea, a short summary of the real outreach message, and what happened. Do not paste the full message.', input('idea', 'Idea from reading', { maxlength: 400 }) + area('outreachMessage', 'One-line message summary', 'A brief summary of what you really sent') + area('ideaOutcome', 'What happened', 'Reply, no reply yet, or another result'));
    if (type === 'quote') return wrap('Log a price quote', 'Record a price you genuinely quoted. Use the same business name to avoid duplicates.', input('quoteOwner', 'Business / owner name') + input('quoteAmount', 'Price quoted (Ksh)', { number: true, min: 1 }) + input('quoteNote', 'Context', { required: false }));
    if (type === 'reply') return wrap('Log an owner reply', 'Record a real response from a business owner. Use the Website business name where available.', input('replyOwner', 'Business / owner name') + area('replyNote', 'Reply context', 'A short private note about the response', false));
    if (type === 'book') return wrap('Log a finished book', 'Only enter a book you actually finished. For Trial 2, note what helped you close a deal.', input('bookTitle', 'Book title') + area('bookNote', 'What worked or what you applied', 'A short note about a result or closing insight'));
    if (type === 'testimonial' && soldSites.length) {
      const options = soldSites.map(site => `<option value="${esc(site.id)}">${esc(site.name)}</option>`).join('');
      return wrap('Record a client testimonial', 'Select the paid client and enter a short testimonial they actually gave.', `<label class="system-field"><span>Sold site <b>*</b></span><select id="system-testimonialSite" data-system-field="testimonialSite" required>${options}</select></label>${area('testimonialText', 'Client’s words', 'Short testimonial')}`);
    }
    if (type === 'messages') return wrap('Log owner messages this week', 'Enter the real total sent this week. This is a progress step, not a client outcome.', input('miniMessages', 'Owner messages sent', { number: true, min: 1, max: 250 }));
    if (type === 'gate' && gate) {
      let fields = '';
      if (gate.stat === 'strength') fields = input('gateReps', 'Workout reps or seconds completed', { number: true, min: Number(gate.minimum) || 1 });
      if (gate.stat === 'intellect') fields = input('gatePages', 'Pages actually read', { number: true, min: Number(gate.minimum) || 1 }) + area('gateIdea', 'One thing learned', 'A short learning note');
      if (gate.stat === 'influence') fields = input('gateMessages', 'Owner messages actually sent', { number: true, min: Number(gate.minimum) || 1 }) + area('gateMessageNote', 'Context', 'Short note (no full message text)', false);
      if (gate.stat === 'wealth') fields = input('gateQuoteOwner', 'Business / owner actually quoted') + input('gateQuoteAmount', 'Price quoted (Ksh)', { number: true, min: 1 });
      return `<section class="system-evidence-form"><div class="system-kicker">ONE-HOUR GATE</div><h3>${esc(gate.stat)} action</h3><p class="system-muted">Only claim work completed before the one-hour timer expires.</p>${fields}<div class="row system-form-actions"><button class="system-button" data-system-log-save="gate">Claim completed Gate</button><button class="system-button quiet" data-system-log-cancel>Cancel</button></div></section>`;
    }
    return '';
  }

  function status(model) {
    const rank = esc(model.rank);
    const titles = (model.titles || []).map(title => `<span class="system-title">${esc(title)}</span>`).join('');
    const stats = (model.stats || []).map(item => `<article class="system-stat"><div class="row sp"><h3>${esc(item.name)}</h3><strong>${count(item.points)}</strong></div>${bar(item.progress, `${item.name} points toward next band`)}<div class="system-stat-caption">${count(item.toNext)} to next band</div></article>`).join('');
    const quests = model.tasks?.length ? model.tasks.map(task => `<button class="system-quest ${task.done ? 'done' : ''}" data-system-quest="${esc(task.key)}" ${task.done ? 'disabled' : ''}><span class="system-quest-mark">${task.done ? '✓' : '·'}</span><span><strong>${esc(task.title)}</strong><small>${esc(task.description)}</small></span><span class="system-quest-state">${task.done ? 'DONE' : 'OPEN'}</span></button>`).join('') : `<div class="system-rest">Saturday. Full rest. No workout is scheduled or loggable today.</div>`;
    const trial = model.trial ? `<section class="system-panel system-trial"><div class="system-panel-head"><div><div class="system-kicker">RANK-UP TRIAL · ${esc(model.trial.from)} → ${esc(model.trial.to)}</div><h2>${esc(model.trial.title)}</h2></div><span class="trial-clock">${esc(model.trial.daysLabel)}</span></div><div class="system-muted">${esc(model.trial.targetLabel)}</div><div class="trial-parts">${(model.trial.parts || []).map(part).join('')}</div>${model.trial.extra ? `<div class="trial-extra ${model.trial.extra.complete ? 'complete' : ''}"><div class="row sp"><span>${esc(model.trial.extra.label)}</span><span>${esc(model.trial.extra.summary)}</span></div>${bar(model.trial.extra.progress, 'Additional trial condition')}${model.trial.extra.completedAt ? `<div class="trial-time">Recorded ${esc(model.trial.extra.completedAt)}</div>` : ''}</div>` : ''}${model.trial.slowStep ? `<div class="system-mini-step"><strong>Small step this week</strong><br>${esc(model.trial.slowStep)}<button class="system-button quiet" data-system-form="messages">Log this week’s actual total</button></div>` : ''}${model.lighterOffer ? `<div class="system-lighter"><strong>Choose a lighter week?</strong><p>${esc(model.lighterOffer)}</p><div class="row"><button class="system-button" data-lighter-week="strength">Strength</button><button class="system-button" data-lighter-week="intellect">Intellect</button><button class="system-button quiet" data-lighter-week="decline">No</button></div></div>` : ''}${model.lighterStatus ? `<div class="system-lighter-status">${esc(model.lighterStatus)}</div>` : ''}<details class="system-log-details"><summary>Log real trial evidence</summary><div class="system-log-actions">${(model.logActions || []).map(action => `<button class="system-button quiet" data-system-form="${esc(action.type)}">${esc(action.label)}</button>`).join('')}</div></details>${model.formHtml || ''}</section>` : `<section class="system-panel system-trial"><div class="system-kicker">RANK TRIALS</div><h2>Rank ${rank} reached</h2><p class="system-muted">Trials above Rank B are intentionally left unconfigured.</p></section>`;
    const gate = model.gate ? `<section class="system-panel system-gate"><div class="system-kicker">OPTIONAL · ${esc(model.gate.stat.toUpperCase())} GATE</div><h2>${esc(model.gate.title)}</h2><p>${esc(model.gate.description)}</p><div class="system-muted">${esc(model.gate.timeLeft)} remaining · Complete for +${Number(model.gate.rewardXp) || 0} XP. Ignore it with no penalty.</div><div class="row system-gate-actions"><button class="system-button" data-system-form="gate">Log completed challenge</button><button class="system-button quiet" data-gate-ignore>Ignore</button></div>${model.formType === 'gate' ? evidenceForm('gate', [], model.gate) : ''}</section>` : '';
    const momentum = `<section class="system-momentum"><div class="row sp"><span>MOMENTUM</span><span>${Number(model.momentumStep) || 0} / ${Number(model.momentumMax) || 7}</span></div><div class="system-momentum-steps">${Array.from({ length: Number(model.momentumMax) || 7 }, (_, index) => `<i class="${index < (Number(model.momentumStep) || 0) ? 'filled' : ''}"></i>`).join('')}</div><span class="system-muted">Complete today’s required quests to fill a step.</span></section>`;
    const report = model.report ? `<section class="system-panel system-report"><div class="system-kicker">WEEKLY REPORT · SATURDAY</div><div class="row sp"><h2>${esc(model.report.title)}</h2><button class="system-close" aria-label="Dismiss weekly report" data-report-dismiss>×</button></div><div class="report-label">CLEARED</div><p>${esc(model.report.cleared)}</p><div class="report-label">MISSED</div><p>${esc(model.report.missed)}</p><div class="report-next">Next week · ${esc(model.report.next)}</div></section>` : '';
    const mood = model.voiceMissed ? 'missed' : model.voiceStreak ? 'streak' : 'neutral';
    return `<div class="system-home"><header class="system-player-card"><div class="row sp system-player-row"><div><div class="system-kicker">PLAYER · ${esc(model.name)}</div><div class="system-level-line">LEVEL ${Number(model.level) || 1} <span>${count(model.xp)} XP</span></div></div><span class="system-rank-badge rank-${rank}">${rank}</span></div>${bar(model.xpProgress, 'Experience to next level')}<div class="row sp system-xp-caption"><span>${count(model.xpToNext)} XP to Level ${(Number(model.level) || 1) + 1}</span><button class="system-sound-toggle" aria-pressed="${!!model.soundEnabled}" data-system-sound>${model.soundEnabled ? 'Sound on' : 'Sound off'}</button></div><div class="system-titles">${titles || '<span class="system-muted">No titles yet</span>'}</div><div class="system-voice ${mood}">${esc(model.voice)}</div></header>
      <section class="system-stat-section"><div class="system-section-heading"><span>ATTRIBUTES</span><span>POINTS</span></div><div class="system-stat-grid">${stats}</div></section>
      <section class="system-quests"><div class="system-section-heading"><span>TODAY’S QUESTS</span><span>${esc(model.taskCount)}</span></div>${quests}</section>
      ${trial}${gate}${momentum}${report}
      <button class="system-army-link" data-site-army><span class="army-link-mark" aria-hidden="true">◈</span><span>Website Shadow Army</span><strong>${Number(model.siteCount) || 0}</strong><span class="army-link-arrow">›</span></button>
      <details class="system-legacy"><summary>Progress, account & settings</summary>${model.legacyHtml || ''}</details>
    </div>`;
  }

  function moment(model) {
    const kind = esc(model.kind);
    const subtitle = model.kind === 'rank' ? `${esc(model.from)} → ${esc(model.to)} RANK` : model.kind === 'level' ? `LEVEL ${Number(model.level) || 1}` : model.kind === 'sale' ? 'FIRST PAID SALE' : 'WEBSITE SHADOW';
    return `<div class="system-moment system-moment-${kind}" role="dialog" aria-modal="true" aria-labelledby="system-moment-title"><div class="system-moment-window"><div class="system-kicker">${subtitle}</div><h1 id="system-moment-title">${esc(model.title)}</h1><p>${esc(model.message)}</p>${model.kind === 'arise' ? `<div class="arise-mark" aria-hidden="true">${model.shadowSvg || ''}</div>` : ''}<button class="system-button system-moment-close" data-moment-close>Continue</button></div></div>`;
  }

  function soldier(site, shadowSvg) {
    const stage = { Built: 1, Sent: 2, Replied: 3, Sold: 4 }[site.status] || 1;
    const peak = Math.max(stage, Number(site.peakStage) || 0);
    const cls = ['built', 'sent', 'replied', 'sold'][peak - 1] || 'built';
    return `<button class="site-soldier stage-${cls}" data-site="${esc(site.id)}" aria-label="${esc(site.name)}, ${esc(site.status)}. Open website."><span class="site-soldier-figure">${shadowSvg}<img src="${esc(site.image)}" alt="Screenshot card for ${esc(site.name)}"><span class="site-soldier-smoke" aria-hidden="true"></span>${site.status === 'Sold' ? '<span class="site-knight">KNIGHT</span>' : ''}</span><span class="site-soldier-name">${esc(site.name)}</span><span class="site-soldier-status">${esc(site.status)}</span></button>`;
  }

  function army(sites, shadowRenderer) {
    const sorted = [...(sites || [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return `<section class="system-panel website-army-panel"><div class="row sp"><div><div class="system-kicker">WEBSITE SHADOW ARMY</div><h2>${sorted.length} soldier${sorted.length === 1 ? '' : 's'}</h2></div></div><div class="site-army-roster">${sorted.length ? sorted.map(site => soldier(site, shadowRenderer(true, Math.min(16, 2 + ({ Built: 0, Sent: 3, Replied: 6, Sold: 9 }[site.status] || 0)), 'army'))).join('') : '<div class="site-army-empty">No site soldiers yet. Add a website to begin.</div>'}</div><button class="system-button quiet" data-site-back>Back to Websites</button></section>`;
  }

  root.SystemDashboard = { intro, evidenceForm, status, moment, army };
})(window);
