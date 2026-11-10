import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const art = fs.readFileSync(new URL('../public/shadow-art.js', import.meta.url), 'utf8');
const app = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const rules = JSON.parse(fs.readFileSync(new URL('./original-rules.json', import.meta.url), 'utf8'));
const persuasion = JSON.parse(fs.readFileSync(new URL('../public/persuasion-quests.json', import.meta.url), 'utf8'));

function createApp(date = '2026-11-05T10:00:00Z', saved = null) {
  const elements = new Map();
  const events = {};
  const storage = new Map(saved ? [['sys90', JSON.stringify(saved)]] : []);
  const createElement = () => ({ style: {}, dataset: {}, append() {}, remove() {}, textContent: '', innerHTML: '' });
  for (const id of ['app', 'pf', 'f1', 'f2', 'f3', 'f4']) elements.set(id, { ...createElement(), value: '' });
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
    navigator: {},
    fetch: async () => ({ ok: true, json: async () => persuasion }),
    setTimeout: () => 1,
    clearTimeout() {},
    window: {},
    addEventListener() {},
    scrollTo() {},
    innerWidth: 480,
    screen: { width: 480 },
  });
  vm.runInContext(art, context);
  // Keep all app functions; skip startup PDF inventory and network-facing initialization.
  vm.runInContext(app.slice(0, app.indexOf('refreshHave().then(')), context);
  return { context, elements, storage, evaluate: source => vm.runInContext(source, context) };
}

const boundaries = {
  schedule: ['const START=', 'let S;'],
  calendar: ['const rest=', 'const pT='],
  scoring: ['const xp=', 'const RANKS='],
  complete: ['function complete(', "document.addEventListener('click'"],
  sync: ['const save=', 'const hd='],
};

test('existing schedule, completion, XP/level formulas, local persistence, and Firebase sync remain byte-identical', () => {
  for (const [name, [start, end]] of Object.entries(boundaries)) {
    assert.equal(html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start))), rules[name], name);
  }
  assert.match(html, /(?:function libView|const libView=)/);
  assert.ok(html.includes('async function draw()'));
  assert.ok(html.includes("localStorage.getItem(KEY)"));
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

test('PWA cache includes both new assets and app script remains syntactically valid', () => {
  const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /shadow-art\.js/);
  assert.match(worker, /shadows\.css/);
  assert.match(worker, /persuasion-quests\.json/);
  new vm.Script(app);
  new vm.Script(art);
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../public/manus-routes.json', import.meta.url), 'utf8')).routes, [{ path: '/', title: 'System: 90 Day Quest' }]);
});
