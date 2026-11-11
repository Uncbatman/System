import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const art = fs.readFileSync(new URL('../public/shadow-art.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../public/program-config.js', import.meta.url), 'utf8');
const rules = JSON.parse(fs.readFileSync(new URL('./original-rules.json', import.meta.url), 'utf8'));
const persuasion = JSON.parse(fs.readFileSync(new URL('../public/persuasion-quests.json', import.meta.url), 'utf8'));

function createApp(date = '2026-11-05T10:00:00Z', saved = null) {
  const elements = new Map();
  const events = {};
  const storage = new Map(saved ? [['sys90', JSON.stringify(saved)]] : []);
  const createElement = () => ({ style: {}, dataset: {}, append() {}, remove() {}, textContent: '', innerHTML: '' });
  for (const id of ['app', 'pf', 'backupfile', 'programStart', 'f1', 'f2', 'f3', 'f4']) elements.set(id, { ...createElement(), value: '' });
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [date])); }
    static now() { return new Date(date).getTime(); }
  }
  const context = vm.createContext({
    Date: FixedDate,
    Math: Object.assign(Object.create(Math), { random: () => 1 }),
    console,
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
  vm.runInContext(config, context);
  vm.runInContext(art, context);
  // Keep all app functions; skip startup PDF inventory and network-facing initialization.
  vm.runInContext(app.slice(0, app.indexOf('refreshHave().then(')), context);
  return { context, elements, storage, evaluate: source => vm.runInContext(source, context) };
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

test('shadow bodies stay blue, silhouettes have no circles, and red intensity and size progress monotonically', () => {
  const app = createApp();
  let previous = { red: 0, width: 0 };
  for (const level of [1, 2, 4, 7, 10, 13, 16, 22, 50]) {
    const result = JSON.parse(app.evaluate(`JSON.stringify(shadowStyle(${level}))`));
    const red = Number(result.outline.match(/rgb\((\d+)/)[1]);
    assert.ok(result.width > previous.width);
    assert.ok(red >= previous.red);
    previous = { red, width: result.width };
    const svg = app.evaluate(`shadow(true,${level})`);
    assert.ok(!svg.includes('<circle'));
    assert.match(svg, /fill="#0c2c50"/);
    assert.ok(!svg.includes('#8a5cff'));
    assert.match(svg, new RegExp(`level ${level}`));
  }
  assert.equal(app.evaluate('shadowStyle(16).outline'), 'rgb(255,74,115)');
});

test('incomplete days show quests; final required completion reveals exactly one shadow without requiring bonus workout', () => {
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
  assert.match(result, /LEVEL UP/);
  assert.match(result, /A new shadow has arisen\./);
  assert.equal((result.match(/shadow-figure risen/g) || []).length, 1);
  assert.match(result, /View shadow army/);
  assert.equal(app.evaluate('fd()'), 1);
  assert.equal(app.evaluate("done(today,'a')"), false);
  assert.equal(app.evaluate('stats().t'), 80);
  app.evaluate('render(); render()');
  assert.equal(app.evaluate('fd()'), 1);
  assert.equal(app.evaluate('stats().t'), 80);
  const saved = JSON.parse(app.storage.get('sys90'));
  assert.equal(saved.d[13].o, 1);
  assert.ok(!Object.hasOwn(saved, 'shadow'));
});

test('boss-day reveal waits for boss completion; rest days do not raise shadows', () => {
  const boss = createApp('2026-11-22T10:00:00Z'); // Day 30, Sunday: boss task required.
  boss.evaluate('S.d={}; S.v={}; S.s={}; S.c={}; S.d[today]={r:1,l:1,o:1}; render()');
  assert.equal(boss.evaluate('today'), 30);
  assert.ok(!boss.elements.get('app').innerHTML.includes('A new shadow has arisen.'));
  boss.evaluate("complete('b')");
  assert.match(boss.elements.get('app').innerHTML, /A new shadow has arisen\./);
  const rest = createApp('2026-11-07T10:00:00Z');
  rest.evaluate('render()');
  assert.match(rest.elements.get('app').innerHTML, /REST DAY/);
  assert.ok(!rest.elements.get('app').innerHTML.includes('A new shadow has arisen.'));
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
  assert.match(output, /Higher levels grow larger with redder edges/);
});

test('PWA caches split app/config/auth assets; app starts without remote font or eager auth requests', () => {
  const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /shadow-art\.js/);
  assert.match(worker, /shadows\.css/);
  assert.match(worker, /persuasion-quests\.json/);
  assert.match(worker, /program-config\.js/);
  assert.match(worker, /app\.js/);
  assert.match(worker, /firebase-auth\.js/);
  assert.match(html, /<script src="program-config\.js"><\/script><script src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|<script type="module">/);
  assert.ok(app.includes("import('./firebase-auth.js')"));
  new vm.Script(app);
  new vm.Script(config);
  new vm.Script(art);
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../public/manus-routes.json', import.meta.url), 'utf8')).routes, [{ path: '/', title: 'System: 90 Day Quest' }]);
});
