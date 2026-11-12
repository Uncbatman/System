import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const art = fs.readFileSync(new URL('../public/shadow-art.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../public/program-config.js', import.meta.url), 'utf8');
const systemProgression = fs.readFileSync(new URL('../public/system-progression.js', import.meta.url), 'utf8');
const systemTrials = fs.readFileSync(new URL('../public/system-trials.js', import.meta.url), 'utf8');
const systemDashboard = fs.readFileSync(new URL('../public/system-dashboard.js', import.meta.url), 'utf8');
const systemApp = fs.readFileSync(new URL('../public/system-app.js', import.meta.url), 'utf8');
const rules = JSON.parse(fs.readFileSync(new URL('./original-rules.json', import.meta.url), 'utf8'));
const persuasion = JSON.parse(fs.readFileSync(new URL('../public/persuasion-quests.json', import.meta.url), 'utf8'));

function createApp(date = '2026-11-05T10:00:00Z', saved = null) {
  const elements = new Map();
  const events = {};
  const storage = new Map(saved ? [['sys90', JSON.stringify(saved)]] : []);
  const createElement = () => ({ style: {}, dataset: {}, append() {}, remove() {}, textContent: '', innerHTML: '' });
  for (const id of ['app', 'systemLayer', 'pf', 'backupfile', 'programStart', 'f1', 'f2', 'f3', 'f4', 'siteNote']) elements.set(id, { ...createElement(), value: '' });
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [date])); }
    static now() { return new Date(date).getTime(); }
  }
  const context = vm.createContext({
    Date: FixedDate,
    Math: Object.assign(Object.create(Math), { random: () => 1 }),
    console,
    URL,
    document: {
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [],
      createElement,
      addEventListener: (name, handler) => { (events[name] ||= []).push(handler); },
      body: { append() {}, style: {} },
    },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    navigator: { onLine: true, storage: { persist: async () => true } },
    confirm: () => true,
    fetch: async () => ({ ok: true, json: async () => persuasion }),
    setTimeout: () => 1,
    clearTimeout() {},
    window: {},
    addEventListener() {},
    scrollTo() {},
    innerWidth: 480,
    screen: { width: 480 },
  });
  context.window = context;
  vm.runInContext(config, context);
  vm.runInContext(art, context);
  for (const source of [systemProgression, systemTrials, systemDashboard, systemApp]) vm.runInContext(source, context);
  // Keep all app functions; skip startup PDF inventory and network-facing initialization.
  vm.runInContext(app.slice(0, app.indexOf('refreshHave().then(')), context);
  vm.runInContext("V='q';INTRO_ACTIVE=false;", context);
  return { context, elements, storage, evaluate: source => vm.runInContext(source, context), click: dataset => { const button = { dataset, id: '', closest: () => button }; for (const handler of events.click || []) handler({ target: { closest: () => button } }); } };
}

const boundaries = {
  complete: ['function complete(', "document.addEventListener('click'"],
};

test('existing XP and completion formulas remain byte-identical', () => {
  for (const [name, [start, end]] of Object.entries(boundaries)) {
    assert.equal(app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start))), rules[name], name);
  }
  const formula = rules.scoring.slice(0, rules.scoring.indexOf('function stats()'));
  assert.equal(app.slice(app.indexOf('const xp='), app.indexOf('function stats()')), formula, 'XP formula');
  assert.match(app, /(?:function libView|const libView=)/);
  assert.ok(app.includes('async function draw()'));
  assert.ok(app.includes("localStorage.getItem(KEY)"));
});

test('Today view stays minimal, shows progress and saved state, and retains completed rows', () => {
  const app = createApp();
  app.evaluate('S.d={}; S.v={}; S.c={}; S.p={}; render()');
  let output = app.elements.get('app').innerHTML;
  assert.match(output, /TODAY/);
  assert.match(output, /0 of 3 complete/);
  assert.match(output, /SAVED ON DEVICE/);
  assert.match(output, /role="progressbar"/);
  assert.doesNotMatch(output, /The Daily Quest has arrived/);
  app.elements.get('f1').value = '5';
  app.elements.get('f2').value = 'A useful takeaway';
  app.evaluate("complete('r')");
  output = app.elements.get('app').innerHTML;
  assert.match(output, /1 of 3 complete/);
  assert.match(output, /class="t today-quest d"/);
  assert.match(output, /5 pages/);
});

test('business leads task uses exact requested wording in the task and form', () => {
  const app = createApp();
  assert.equal(app.evaluate("txt(today,'o')"), 'Business leads reach out.');
  assert.match(app.evaluate("qb('o')"), /Business leads reach out\./);
  assert.match(app.evaluate("form('o')"), /Business leads reach out\./);
});

test('persuasion drills and cards load by day and require five logged owner messages', async () => {
  const app = createApp('2026-11-10T10:00:00Z');
  await app.evaluate('PQ_READY');
  assert.equal(app.evaluate('today'), 18);
  assert.equal(persuasion.days.length, 14);
  assert.equal(persuasion.cards.length, 12);
  assert.match(app.evaluate("txt(today,'o')"), /Write the 5 feelings/);
  assert.match(app.evaluate("txt(today,'o')"), /Message 5 owners/);
  const learn = app.evaluate("form('l')");
  assert.match(learn, /You sell feelings, not things/);
  assert.match(learn, /Ask one owner which feeling matters most/);
  assert.equal(Boolean(app.evaluate('pDay(22)')), false);
  assert.equal(Boolean(app.evaluate('pDay(29)')), false);
  assert.equal(app.evaluate('pCard(32)'), null);

  app.elements.get('f1').value = '0';
  app.elements.get('f2').value = '0';
  app.elements.get('f3').value = '0';
  app.elements.get('f4').value = '4';
  app.evaluate("complete('o')");
  assert.equal(app.evaluate("done(today,'o')"), false);
  app.elements.get('f4').value = '5';
  app.evaluate("complete('o')");
  assert.equal(app.evaluate("done(today,'o')"), true);
  assert.equal(JSON.parse(app.storage.get('sys90')).v[18].o.m, 5);
});

test('program settings drive campaign dates, duration, rest days, workouts, and boss cadence', () => {
  const app = createApp();
  assert.equal(app.evaluate('DAYS'), 90);
  assert.equal(app.evaluate("[START.getFullYear(),START.getMonth()+1,START.getDate()].join('-')"), '2026-10-24');
  app.evaluate('CFG.restWeekdays=[0]; CFG.strengthWeekdays=[1]; CFG.bossEveryDays=10');
  assert.equal(app.evaluate('rest(2)'), true); // Sunday under the edited config.
  assert.equal(app.evaluate('wd(3)'), true); // Monday under the edited config.
  assert.equal(app.evaluate('boss(10)'), true);
});

test('backup envelope is versioned and plain-text logs preview common checklist and day formats', async () => {
  const app = createApp('2026-11-10T10:00:00Z');
  await app.evaluate('PQ_READY');
  const parsed = JSON.parse(app.evaluate(`JSON.stringify(parseTextActivities(${JSON.stringify('Day 18\n[x] Read 12 pages\nCompleted: Learn 20 minutes\nDay 18: Message 5 owners\nDay 19: workout 16 reps — done\nDay 20: [ ] Read 5 pages')}))`));
  assert.deepEqual(parsed.rows.map(x => [x.day, x.key]), [[18, 'r'], [18, 'l'], [18, 'o'], [19, 'w']]);
  assert.equal(parsed.rows[0].values.p, 12);
  assert.equal(parsed.rows[1].values.m, 20);
  assert.equal(parsed.rows[2].values.m, 5);
  const dated = JSON.parse(app.evaluate(`JSON.stringify(parseTextActivities('2026-11-10: Read 8 pages'))`));
  assert.equal(dated.rows[0].day, 18);
  const underTarget = JSON.parse(app.evaluate(`JSON.stringify(parseTextActivities(${JSON.stringify('Day 18: Message 4 owners')}))`));
  assert.equal(underTarget.rows.length, 0);
  assert.equal(underTarget.ignored, 1);
  assert.equal(JSON.parse(app.evaluate('JSON.stringify(backupPayload())')).format, 'system-daily-quest-backup');
  assert.equal(app.evaluate('saveSafetyCopy()'), true);
  assert.ok(app.storage.has('sys90_before_import'));
});

test('TXT import merges recognized activities after confirmation and keeps a recovery copy', async () => {
  const app = createApp('2026-11-10T10:00:00Z');
  app.context.activityFile = {
    name: 'activity-log.txt',
    size: 128,
    text: async () => 'Day 18\nRead 12 pages\nLearned 20 minutes\nSent 5 owner messages',
  };
  await app.evaluate('importProgressFile(activityFile)');
  assert.equal(app.evaluate("done(18,'r')"), true);
  assert.equal(app.evaluate("done(18,'l')"), true);
  assert.equal(app.evaluate("done(18,'o')"), true);
  const state = JSON.parse(app.storage.get('sys90'));
  assert.equal(state.v[18].r.p, 12);
  assert.equal(state.v[18].l.m, 20);
  assert.equal(state.v[18].o.m, 5);
  assert.ok(app.storage.has('sys90_before_import'));
});

test('ordinary local saves retain the prior state as a one-step recovery point', () => {
  const app = createApp('2026-11-10T10:00:00Z', { startDate: '2026-10-24', link: '', d: { 18: { r: 1 } } });
  app.evaluate('S.d[18].r=0; save()');
  assert.equal(JSON.parse(app.storage.get('sys90_autosave')).d[18].r, 1);
  assert.equal(JSON.parse(app.storage.get('sys90')).d[18].r, 0);
});

test('daily shadows stay blue, grow with level, and reserve purple for Website soldiers', () => {
  const app = createApp();
  let width = 0;
  for (const level of [1, 2, 4, 7, 10, 13, 16, 22, 50]) {
    const result = JSON.parse(app.evaluate(`JSON.stringify(shadowStyle(${level}))`));
    assert.ok(result.width > width); width = result.width;
    assert.equal(result.outline, '#3FA9FF');
    const svg = app.evaluate(`shadow(true,${level})`);
    assert.ok(!svg.includes('<circle'));
    assert.match(svg, /fill="#0c2c50"/);
    assert.match(svg, new RegExp(`level ${level}`));
    assert.ok(!svg.includes('#E5384B'));
  }
  assert.match(app.evaluate("shadow(true,2,'army')"), /#7B3FE4/);
});

test('required quest completion stays factual and does not replay an ARISE or level moment on open', () => {
  const app = createApp();
  app.evaluate('S.d={}; S.v={}; S.c={}; S.p={}; S.s={}; render()');
  assert.ok(!app.elements.get('app').innerHTML.includes('A new shadow has arisen.'));
  for (const task of ['r', 'l']) {
    app.elements.get('f1').value = task === 'r' ? '5' : '20';
    app.elements.get('f2').value = 'One lesson learned';
    app.evaluate(`complete('${task}')`);
    assert.ok(!app.elements.get('app').innerHTML.includes('A new shadow has arisen.'));
  }
  app.elements.get('f1').value = '3';
  app.elements.get('f2').value = '1';
  app.elements.get('f3').value = '0';
  app.evaluate("complete('o')");
  const result = app.elements.get('app').innerHTML;
  assert.match(result, /DAY \d+ COMPLETE/);
  assert.doesNotMatch(result, /A new shadow has arisen|LEVEL UP/);
  assert.match(app.elements.get('systemLayer').innerHTML, /system-moment-level/);
  assert.doesNotMatch(app.elements.get('systemLayer').innerHTML, /system-moment-arise/);
  assert.equal(app.evaluate('fd()'), 1);
  assert.equal(app.evaluate("done(today,'a')"), false);
  assert.equal(app.evaluate('stats().t'), 80);
  app.evaluate('SYS.closeMoment();render();render()');
  assert.doesNotMatch(app.elements.get('systemLayer').innerHTML, /system-moment/);
  assert.equal(app.evaluate('fd()'), 1);
  assert.equal(app.evaluate('stats().t'), 80);
  const saved = JSON.parse(app.storage.get('sys90'));
  assert.equal(saved.d[13].o, 1);
  assert.ok(!Object.hasOwn(saved, 'shadow'));
});

test('boss completion is recorded without opening a cinematic; rest days stay a full rest', () => {
  const boss = createApp('2026-11-22T10:00:00Z'); // Day 30, Sunday: boss task required.
  boss.evaluate('S.d={}; S.v={}; S.s={}; S.c={}; S.d[today]={r:1,l:1,o:1}; render()');
  assert.equal(boss.evaluate('today'), 30);
  assert.doesNotMatch(boss.elements.get('app').innerHTML, /A new shadow has arisen/);
  boss.evaluate("complete('b')");
  assert.doesNotMatch(boss.elements.get('app').innerHTML, /A new shadow has arisen/);
  assert.doesNotMatch(boss.elements.get('systemLayer').innerHTML, /system-moment/);
  const rest = createApp('2026-11-07T10:00:00Z');
  rest.evaluate('render()');
  assert.match(rest.elements.get('app').innerHTML, /REST DAY/);
  assert.doesNotMatch(rest.elements.get('systemLayer').innerHTML, /system-moment/);
});

test('older shadows level up with subsequent recorded XP and keep 90 day slots', () => {
  const app = createApp();
  app.evaluate("S.d={2:{r:1,l:1,o:1},13:{r:1,l:1,o:1}}; S.v={}; S.c={}; S.s={};");
  assert.ok(app.evaluate('shadowLevel(2)') >= app.evaluate('shadowLevel(13)'));
  const before = app.evaluate('shadowLevel(2)');
  app.evaluate("S.d[10]={r:1,l:1,o:1}; S.v[10]={o:{f:30,c:12,$:0}};");
  assert.ok(app.evaluate('shadowLevel(2)') > before);
  app.evaluate("V='d'; render()");
  const output = app.elements.get('app').innerHTML;
  assert.equal((output.match(/class="army-unit/g) || []).length, 90);
  assert.match(output, /shadow level/);
  assert.match(output, /Daily shadows stay blue/);
});

test('PWA caches split app/config/auth assets; app starts without remote font or eager auth requests', () => {
  const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /shadow-art\.js/);
  assert.match(worker, /shadows\.css/);
  assert.match(worker, /persuasion-quests\.json/);
  assert.match(worker, /system\.css/);
  assert.match(worker, /system-progression\.js/);
  assert.match(worker, /system-trials\.js/);
  assert.match(worker, /system-dashboard\.js/);
  assert.match(worker, /system-app\.js/);
  assert.match(worker, /program-config\.js/);
  assert.match(worker, /app\.js/);
  assert.match(worker, /firebase-auth\.js/);
  assert.match(html, /<link rel="stylesheet" href="system\.css">/);
  assert.match(html, /<script src="program-config\.js"><\/script><script src="system-progression\.js"><\/script><script src="system-trials\.js"><\/script><script src="system-dashboard\.js"><\/script><script src="system-app\.js"><\/script><script src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|<script type="module">/);
  assert.ok(app.includes("import('./firebase-auth.js')"));
  new vm.Script(app);
  new vm.Script(config);
  new vm.Script(art);
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../public/manus-routes.json', import.meta.url), 'utf8')).routes, [{ path: '/', title: 'System: 90 Day Quest' }]);
});

test('Status is the first destination and includes rank, four stats, quests, trial and the separate legacy panel', () => {
  const app = createApp('2026-11-05T10:00:00Z');
  app.evaluate("V='s';render()");
  const output = app.elements.get('app').innerHTML;
  assert.match(output, /PLAYER · Adam/);
  assert.match(output, /RANK-UP TRIAL · E → D/);
  for (const stat of ['Strength', 'Intellect', 'Influence', 'Wealth']) assert.ok(output.includes(stat));
  assert.match(output, /TODAY’S QUESTS/);
  assert.match(output, /Website Shadow Army/);
  assert.match(output, /Progress, account & settings/);
  const intro = JSON.parse(app.evaluate('JSON.stringify(SystemDashboard.intro(SYS.introModel()))'));
  assert.match(intro, /Player: Adam/);
  assert.match(intro, /Tap to skip/);
  const weekend = createApp('2026-11-07T10:00:00Z');
  weekend.evaluate("V='s';render()");
  assert.match(weekend.elements.get('app').innerHTML, /WEEKLY REPORT · SATURDAY/);
  assert.match(weekend.elements.get('app').innerHTML, /Next week/);
});

test('quest actions add one stable stat event, and an older backup keeps system state and sites', async () => {
  const app = createApp('2026-11-05T10:00:00Z', { startDate: '2026-10-24', link: '', d: {}, websites: [{ id: 'keep', name: 'Keep', url: 'https://keep.example', image: 'data:image/jpeg;base64,a', createdAt: '2026-11-01T10:00:00Z', status: 'Built' }] });
  app.evaluate("V='s';render();S.system.rank='D';S.system.bonusXp=77;S.system.events=[];S.system.legacySeeded=true;S.system.trial=null;S.d={};const originalStartedAt=S.system.startedAt");
  const before = Number(app.evaluate("SystemProgression.scores(S.system,CFG.system).totals.intellect"));
  app.elements.get('f1').value = '5'; app.elements.get('f2').value = 'One lesson';
  app.evaluate("complete('r')");
  const once = Number(app.evaluate("SystemProgression.scores(S.system,CFG.system).totals.intellect"));
  assert.ok(once > before);
  assert.equal(app.evaluate("S.system.events.filter(e=>e.id==='quest:13:r').length"), 1);
  app.context.legacyBackup = { name: 'older.json', size: 100, text: async () => JSON.stringify({ format: 'system-daily-quest-backup', version: 1, data: { startDate: '2026-10-24', d: { 13: { l: 1 } } } }) };
  await app.evaluate('importProgressFile(legacyBackup)');
  const saved = JSON.parse(app.storage.get('sys90'));
  assert.equal(saved.system.rank, 'D');
  assert.equal(saved.system.bonusXp, 77);
  assert.equal(saved.system.startedAt, app.evaluate('originalStartedAt'));
  assert.equal(saved.websites[0].id, 'keep');
  assert.equal(saved.d[13].l, 1);
});

test('rank trial keeps real part timestamps, enforces Saturday rest, and does not promote from elapsed time alone', () => {
  const app = createApp('2026-11-22T12:00:00Z');
  app.evaluate("V='s';render();S.system.trial.startedAt='2026-11-08T00:00:00.000Z';S.system.trial.startedDay=16;S.system.trial.targetDays=14");
  assert.equal(app.evaluate('S.system.rank'), 'E');
  app.evaluate(`
    const events = S.system.events;
    const add = e => SystemProgression.putEvent(S.system, { trialEligible: true, ...e });
    add({id:'reply:1',kind:'ownerReply',ownerKey:'owner-1',at:'2026-11-08T09:00:00.000Z'});
    for (const [i,day] of ['2026-11-09','2026-11-10','2026-11-11'].entries()) add({id:'idea:'+i,kind:'ideaApplied',ideaKey:'idea-'+i,outcome:'Used in a message',at:day+'T12:00:00.000Z'});
    for (const [i,day] of ['2026-11-09','2026-11-10','2026-11-11'].entries()) add({id:'quote:'+i,kind:'quoteSent',ownerKey:'quote-owner-'+i,at:day+'T13:00:00.000Z'});
    for (const [i,day] of ['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'].entries()) add({id:'workout:'+i,kind:'extraWorkout',at:day+'T07:00:00.000Z'});
    add({id:'saturday-violation',kind:'extraWorkout',at:'2026-11-14T08:00:00.000Z'});
  `);
  assert.equal(app.evaluate("SYS.model().trial.parts.find(p=>p.key==='strength').complete"), false);
  app.evaluate("SystemProgression.deactivateEvent(S.system,'saturday-violation');SYS.afterRealAction(SYS.level())");
  assert.equal(app.evaluate('S.system.rank'), 'D');
  assert.equal(app.evaluate("SYS.currentMoment().kind"), 'rank');
  assert.equal(app.evaluate('S.system.completedTrials.length'), 1);
  assert.equal(app.evaluate("Object.values(S.system.completedTrials[0].partTimes).filter(p=>p.at).length"), 4);
  assert.equal(app.evaluate('S.system.trial.targetDays'), 21);
});

test('website rank evidence saves actual transition times and real moment types only', () => {
  const app = createApp('2026-11-05T10:00:00Z');
  app.evaluate("V='s';render();const site={id:'s1',name:'Local shop',url:'https://shop.example',image:'data:image/jpeg;base64,a',createdAt:new Date(Date.now()).toISOString(),status:'Built'};S.websites.push(site);SYS.onWebsiteAdded(site)");
  assert.equal(app.evaluate("SYS.currentMoment().kind"), 'arise');
  app.evaluate('SYS.closeMoment()');
  app.evaluate("const sold=S.websites[0],old=sold.status,at=new Date(Date.now()).toISOString();sold.status='Sold';sold.sentAt=at;sold.repliedAt=at;sold.soldAt=at;sold.updatedAt=at;SYS.onWebsiteStatus(sold,old,'Sold')");
  assert.equal(app.evaluate("SYS.currentMoment().kind"), 'sale');
  assert.ok(app.evaluate("S.system.events.some(e=>e.kind==='siteSold'&&e.siteId==='s1'&&e.active!==false)"));
  assert.ok(app.evaluate("SystemProgression.titleList(S.system,S.websites).includes('First Sale')"));
});

test('Websites summary counts reached statuses, reveals Sold only after a sale, and lists newest first', () => {
  const app = createApp('2026-11-05T10:00:00Z');
  app.evaluate(`S.websites=[
    {id:'older',name:'Older business',url:'https://older.example',image:'data:image/jpeg;base64,a',createdAt:'2026-11-01T10:00:00Z',status:'Built'},
    {id:'newer',name:'Newer business',url:'https://newer.example',image:'data:image/jpeg;base64,b',createdAt:'2026-11-04T10:00:00Z',status:'Replied'}
  ];V='w';render()`);
  let output = app.elements.get('app').innerHTML;
  assert.match(output, /BUILT/);
  assert.match(output, /SENT/);
  assert.match(output, /REPLIED/);
  assert.doesNotMatch(output, /SOLD/);
  assert.ok(output.indexOf('Newer business') < output.indexOf('Older business'));
  assert.match(output, />2<\/strong>/);
  app.evaluate("S.websites[1].status='Sold';render()");
  output = app.elements.get('app').innerHTML;
  assert.match(output, /SOLD/);
  assert.equal(app.evaluate('websiteSummary().sold'), 1);
});

test('Websites follow-up queue uses the real count and only includes Sent sites at least three calendar days old', () => {
  const app = createApp('2026-11-05T10:00:00Z');
  app.evaluate(`S.websites=[
    {id:'waiting',name:'Waiting business',url:'https://wait.example',image:'data:image/jpeg;base64,a',createdAt:'2026-11-01T10:00:00Z',status:'Sent',sentAt:'2026-11-02T10:00:00Z'},
    {id:'recent',name:'Recent business',url:'https://recent.example',image:'data:image/jpeg;base64,b',createdAt:'2026-11-04T10:00:00Z',status:'Sent',sentAt:'2026-11-04T10:00:00Z'},
    {id:'replied',name:'Replied business',url:'https://reply.example',image:'data:image/jpeg;base64,c',createdAt:'2026-11-03T10:00:00Z',status:'Replied',sentAt:'2026-11-01T10:00:00Z'}
  ];V='w';render()`);
  let output = app.elements.get('app').innerHTML;
  assert.match(output, /1 site waiting on follow-up/);
  app.evaluate("S.websites=[{id:'dst',status:'Sent',sentAt:'2026-03-06T08:00:00Z'}];assertion=websiteFollowups(Date.parse('2026-03-09T07:00:00Z')).length");
  assert.equal(app.evaluate('assertion'), 1);
  app.evaluate(`S.websites=[
    {id:'waiting',name:'Waiting business',url:'https://wait.example',image:'data:image/jpeg;base64,a',createdAt:'2026-11-01T10:00:00Z',status:'Sent',sentAt:'2026-11-02T10:00:00Z'},
    {id:'recent',name:'Recent business',url:'https://recent.example',image:'data:image/jpeg;base64,b',createdAt:'2026-11-04T10:00:00Z',status:'Sent',sentAt:'2026-11-04T10:00:00Z'},
    {id:'replied',name:'Replied business',url:'https://reply.example',image:'data:image/jpeg;base64,c',createdAt:'2026-11-03T10:00:00Z',status:'Replied',sentAt:'2026-11-01T10:00:00Z'}
  ];V='w';render()`);
  app.click({ siteFilter: '' });
  output = app.elements.get('app').innerHTML;
  assert.match(output, /Waiting business/);
  assert.doesNotMatch(output, /Recent business|Replied business/);
});

test('Website links require real HTTP(S) URLs and old progress backups keep existing website records', async () => {
  const app = createApp('2026-11-05T10:00:00Z', {
    startDate: '2026-10-24', link: '', d: { 13: { r: 1 } },
    websites: [{ id: 'keep', name: 'Keep me', url: 'https://keep.example', image: 'data:image/jpeg;base64,a', createdAt: '2026-11-01T10:00:00Z', status: 'Built' }],
  });
  assert.equal(app.evaluate("websiteUrl('https://business.example')?.hostname"), 'business.example');
  assert.equal(app.evaluate("websiteUrl('ftp://business.example')"), null);
  assert.equal(app.evaluate("websiteUrl('not a link')"), null);
  assert.equal(app.evaluate("websiteUrl('https://..')"), null);
  assert.equal(app.evaluate("websiteUrl('https://user:pass@business.example')"), null);
  app.evaluate("V='w';render()");
  app.click({ siteAdd: '' });
  assert.match(app.elements.get('app').innerHTML, /<h1>Add a site<\/h1>/);
  assert.match(app.elements.get('app').innerHTML, /data-site-save disabled/);
  assert.match(app.elements.get('app').innerHTML, /Take screenshot/);
  assert.match(app.elements.get('app').innerHTML, /Choose from gallery/);
  app.context.legacyFile = {
    name: 'old-backup.json',
    size: 120,
    text: async () => JSON.stringify({ format: 'system-daily-quest-backup', version: 1, data: { startDate: '2026-10-24', d: { 13: { r: 1 } } } }),
  };
  await app.evaluate('importProgressFile(legacyFile)');
  assert.equal(JSON.parse(app.storage.get('sys90')).websites[0].id, 'keep');
  assert.equal(JSON.parse(app.storage.get('sys90')).d[13].r, 1);
});

test('Website detail exposes the live link and ordered statuses; entering Sent records its date and notes save separately', () => {
  const app = createApp('2026-11-05T10:00:00Z', {
    startDate: '2026-10-24', d: {}, websites: [{ id: 'site1', name: 'Example business', url: 'https://example.com', image: 'data:image/jpeg;base64,abc', createdAt: '2026-11-01T10:00:00Z', status: 'Built', sentAt: null, note: '' }],
  });
  app.evaluate("V='w';W_SCREEN='detail';W_SELECTED='site1';render()");
  let output = app.elements.get('app').innerHTML;
  assert.match(output, /https:\/\/example\.com/);
  assert.match(output, /Built.*Sent.*Replied.*Sold/);
  app.click({ siteStatus: '1' });
  assert.equal(app.evaluate("S.websites[0].status"), 'Sent');
  assert.equal(app.evaluate("S.websites[0].sentAt"), '2026-11-05T10:00:00.000Z');
  app.elements.get('siteNote').value = 'Send proposal Friday';
  app.click({ siteNote: '' });
  assert.equal(app.evaluate("S.websites[0].note"), 'Send proposal Friday');
});
