/* Program settings and local state */
const CFG=window.DAILY_QUEST_CONFIG||{},DAYS=Math.max(1,+CFG.durationDays||90),KEY='sys90',ST={r:'Mind',l:'Intellect',w:'Strength',o:'Influence',a:'Bonus workout',b:'Gate'},TP=CFG.learningTopics||['Sales','Psychology','Wealth'];
const parseStart=value=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)};
let START;
let S;try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
S=S||{link:'',d:{1:{r:1,l:1,w:1},2:{r:1,l:1,w:1,o:1}},p:{2:1}};S.startDate=S.startDate||CFG.startDate||'2026-10-24';START=parseStart(S.startDate);
const fix=()=>{for(const k of['c','s','n','p','d','v','lib','rd'])S[k]=S[k]||{}};fix();
let U=null,SM='',tm,V='q',open=null,ed=null;
const n=new Date(),dd=d=>new Date(START.getFullYear(),START.getMonth(),START.getDate()+d-1),dow=d=>dd(d).getDay();
const currentDay=()=>Math.min(DAYS,Math.max(1,Math.floor((new Date(n.getFullYear(),n.getMonth(),n.getDate())-START)/864e5)+1));let today=currentDay(),sel=today;
const rest=d=>(CFG.restWeekdays||[6]).includes(dow(d)),wd=d=>(CFG.strengthWeekdays||[1,3,5]).includes(dow(d)),boss=d=>d%(CFG.bossEveryDays||15)==0;
const keys=d=>rest(d)?[]:['r','l'].concat(wd(d)?['w']:[],['o'],boss(d)?['b']:[]);
const done=(d,k)=>!!(S.d[d]&&S.d[d][k]),cnt=d=>keys(d).filter(k=>done(d,k)).length,full=d=>!!S.s[d]||cnt(d)==keys(d).length;
const pT=d=>d<=14?5:d<=28?10:d<=42?15:20,mT=d=>Math.min(15+Math.floor((d-1)/10)*5,45);
const wi=d=>{let c=0;for(let i=1;i<d;i++)if(wd(i))c++;return c%2?'B':'A'};
const BOSS=['Complete a 20 minute training session with no breaks','Finish a full chapter and write 3 lessons','Book a call with a new lead','Beat your best reps in every move','Teach someone what you learned','Beat your own record in every area'];
let PQ=null;const pDay=d=>PQ&&PQ.days?PQ.days.find(x=>x.day==d):null,pCard=d=>{const p=pDay(d);return p&&p.card&&PQ&&PQ.cards?PQ.cards.find(x=>x.id==p.card):null};
function txt(d,k){const rd=Math.min(3+Math.floor((d-1)/21),5);
 if(k=='r')return'Read '+pT(d)+' pages';if(k=='l'){const c=pCard(d);return c?'Read '+esc(c.title)+' for '+mT(d)+' minutes':'Learn '+TP[(d-1)%3]+' for '+mT(d)+' minutes'}
 if(k=='w')return wi(d)=='A'?'Workout A, '+rd+' rounds: push-ups, pull-ups, squats, hollow hold':'Workout B, '+rd+' rounds: archer push-ups, hanging rows, split squats, leg raises';
 if(k=='o'){const p=pDay(d);return p?esc(p.influence)+' [BASELINE] Message '+(CFG.outreachMessagesPerDay||5)+' owners.':(CFG.businessTaskText||'Business leads reach out.')}if(k=='a')return'Any strength session you choose. Log your total reps.';const tasks=CFG.bossTasks||BOSS;return'GATE BOSS: '+tasks[(d/(CFG.bossEveryDays||15)-1)%tasks.length]}
/* Existing progression and scoring rules */
const xp=(d,k)=>{if(!done(d,k))return 0;const v=(S.v[d]||{})[k];let x;
 if(k=='r')x=5+(v?v.p||0:5);else if(k=='l')x=5+Math.floor((v?v.m||0:15)/3);else if(k=='w')x=10+Math.floor((v?v.n||0:0)/4);
 else if(k=='o')x=v?5+3*(v.f||0)+5*(v.c||0)+Math.floor((v.$||0)/500):10;else if(k=='a')x=15+Math.floor((v?v.n||0:0)/4);else x=30;
 x=Math.min(x,120);return x+(S.c[d+k]?x:0)};
function stats(){const s={r:0,l:0,w:0,o:0},M={r:'r',l:'l',w:'w',o:'o',a:'w'};let t=0;
 for(let d=1;d<=DAYS;d++){for(const k of'rlwoab'){const x=xp(d,k);if(M[k])s[M[k]]+=x;t+=x}if(d>1&&d<=today&&full(d)&&!full(d-1))t+=20}
 for(let b=0;b<Math.ceil(DAYS/7);b++){let c=0;for(let d=b*7+1;d<=b*7+7&&d<=DAYS;d++){if(done(d,'w'))c++;if(done(d,'a'))c++}if(c>=3){const x=20+(c-3)*10;t+=x;s.w+=x}}
 return{s,t}}
const lv=t=>1+Math.floor(Math.sqrt(t/40)),sl=x=>1+Math.floor(Math.sqrt(x/25)),pct=t=>{const l=lv(t),a=40*(l-1)**2,b=40*l*l;return(t-a)/(b-a)*100};
const RANKS=[['E',1],['D',4],['C',7],['B',10],['A',13],['S',16]],TITLES=[[1,'Awakened'],[7,'Consistent'],[21,'Relentless'],[45,'Gate Breaker'],[DAYS,'Shadow Monarch']];
const rk=L=>RANKS.filter(r=>L>=r[1]).pop()[0],esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fd=()=>[...Array(DAYS)].filter((_,i)=>i+1<=today&&!rest(i+1)&&full(i+1)).length;
function streak(){let s=0,d=full(today)?today:today-1;for(;d>=1&&full(d);d--)s++;return s}
const real=()=>{let c=0;for(let d=1;d<=today;d++)if(keys(d).length&&cnt(d)==keys(d).length)c++;return c};
const shields=()=>Math.floor(real()/7)-Object.keys(S.s).filter(k=>S.s[k]).length;
const bn=(m,ok)=>`<div class="pn bn${ok?' ok':''}">${m}</div>`,gh='background:none;color:var(--dm);border:1px solid var(--ln)';
const penNeed=d=>d>1&&d<=today&&!full(d-1)&&!rest(d-1);
const sm=(d,k)=>{const v=(S.v[d]||{})[k],nt=(S.n[d]||{})[k];if(!v)return'';
 return(k=='r'?v.p+' pages':k=='l'?v.m+' minutes':k=='o'?v.f+' leads, '+v.c+' calls'+(v.m?', '+v.m+' owner messages':'')+', KES '+v.$:v.n?v.n+' reps':'')+(nt?'. '+esc(nt):'')};
// Presentation only: reuse recorded task XP and the existing level curve.
function shadowLevel(day){let earned=0;
 for(let d=day;d<=today;d++)for(const k of'rlwoab')earned+=xp(d,k);
 return lv(earned)}
const ring=d=>{const K=keys(d).length,p=K?cnt(d)/K:1,f=full(d);return`<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="${f?'#4fc3ff22':'none'}" stroke="#0f2742" stroke-width="3"/><circle cx="18" cy="18" r="14" fill="none" stroke="#4fc3ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="${88*p} 88" transform="rotate(-90 18 18)"/></svg>`};
function toast(m,u){const e=document.createElement('div');e.className='pn msg';e.textContent=m;if(u){e.style.animationDuration='6s';const x=document.createElement('button');x.className='b';x.style.marginLeft='10px';x.textContent='Undo';x.dataset.u=u;e.append(x)}document.body.append(e);setTimeout(()=>e.remove(),u?6000:2600)}
const beep=()=>{try{navigator.vibrate&&navigator.vibrate(30);const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=660;g.gain.value=.05;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.12)}catch(e){}};
const save=()=>{S.t=Date.now();try{const prior=localStorage.getItem(KEY);if(prior)try{localStorage.setItem('sys90_autosave',prior)}catch(e){}localStorage.setItem(KEY,JSON.stringify(S))}catch(e){SM='Local storage is full; export a backup and remove unused data'}clearTimeout(tm);tm=setTimeout(async()=>{if(U&&window.fb&&navigator.onLine!==false)try{await fb.set(U,{j:JSON.stringify(S),t:S.t});SM='Synced '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch(e){SM='Sync failed: '+(e.code||'error')}else if(U&&navigator.onLine===false)SM='Offline; progress saved on this device and waiting to sync';if(V=='s')render()},1500)};
async function sync(){if(!U||!window.fb)return;if(navigator.onLine===false){SM='Offline; progress remains saved on this device';render();return}try{SM='Syncing';const c=await fb.get(U);if(c&&c.j&&c.t>(S.t||0)){try{localStorage.setItem('sys90_prev',localStorage.getItem(KEY)||'');saveSafetyCopy()}catch(e){}S=JSON.parse(c.j);fix();S.startDate=S.startDate||CFG.startDate;START=parseStart(S.startDate);today=currentDay();sel=today;localStorage.setItem(KEY,JSON.stringify(S));SM='Loaded from your account; previous local copy kept'}else{if(!S.t)S.t=Date.now();await fb.set(U,{j:JSON.stringify(S),t:S.t});SM='Saved to your account'}}catch(e){SM='Sync failed: '+(e.code||e.message)}render()}
window.onUser=async u=>{U=u;if(u)await sync();else SM='';render()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine!==false)sync()});addEventListener('online',()=>{if(U&&window.fb)sync()});
const hd=d=>`<div class="pn"><div class="row sp"><h1>[DAILY QUEST]</h1><span class="sub">Day ${d}/${DAYS}</span></div><div class="sub">${dd(d).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}${d==today?', '+cnt(d)+' of '+keys(d).length+' cleared':', view only'}</div></div>`;
function form(k){const d=today,i=(id,ph,val,ty)=>`<input id="${id}" ${ty?`type="text" maxlength="100"`:`type="number" inputmode="numeric" min="0"`} placeholder="${ph}" value="${val}">`;let f='';
 if(k=='r')f=(rdToday()?`<div class="sub">${rdToday()} pages counted from your Library today</div>`:'')+i('f1','Pages read',rdToday()||pT(d))+i('f2','Your one-line takeaway','',1)+(S.link?`<a class="lk" href="${esc(S.link)}" target="_blank" rel="noopener">Open your book</a>`:'');
 if(k=='l'){const c=pCard(d);f=(c?`<div class="sub"><strong>${esc(c.title)}</strong><br>${esc(c.idea)}<br><b>Try today:</b> ${esc(c.tryToday)}</div>`:'')+i('f1','Minutes spent',mT(d))+i('f2',c?'One-line takeaway after trying it':'Your one-line takeaway','',1)}
 if(k=='w'||k=='a')f=i('f1','Total reps (or seconds of holds)','');
 if(k=='o'){const p=pDay(d);f=i('f1','New leads found','')+i('f2','Calls made','')+i('f3','Money made (KES)','')+(p?i('f4',`Owner messages sent (${CFG.outreachMessagesPerDay||5} required)`,''):'')}
 return`<div class="pn"><h2>${ST[k]}</h2><div class="sub" style="margin-bottom:8px">${txt(d,k)}</div><div style="display:grid;gap:8px">${f}</div><div class="row" style="margin-top:10px"><button class="b" data-c="${k}">Complete</button><button class="b" style="${gh}" data-x="1">Cancel</button></div></div>`}
const qb=k=>`<button class="t" data-o="${k}"><span class="bx"></span><span class="tt"><span class="tg">${ST[k]}</span><br>${txt(today,k)}</span></button>`;
function lvScreen(s,t,L){const xt=keys(today).concat(['a']).reduce((a,k)=>a+xp(today,k),0),tt=TITLES.filter(x=>fd()>=x[0]).pop();
 const risenLevel=shadowLevel(today);
 let o=`<section class="pn arise-panel" aria-labelledby="arise-heading"><div class="arise-kicker">[QUEST COMPLETE]</div><h1>LEVEL UP</h1><div class="sub">Day ${today} cleared. +${xt} XP today.</div><div class="arise-stage">${shadow(true,risenLevel)}</div><h2 class="arise-message" id="arise-heading" role="status">A new shadow has arisen.</h2><div class="arise-subtitle">Shadow of Day ${today} · Lv ${risenLevel} · ${fd()} in your army</div><div class="row arise-stats"><div><div class="sub">Hunter level</div><div class="big">${L}</div></div><div><div class="sub">Rank</div><div class="rk">${rk(L)}</div></div></div><div class="sub" style="margin-top:12px">${tt?tt[1]+', ':''}streak ${streak()} days</div><button class="b arise-army-button" data-v="d">View shadow army</button></section><div class="pn"><h2>Stats</h2>`;
 for(const k of'rlwo')o+=`<div class="row sp"><span>${ST[k]}</span><span>Lv ${sl(s[k])}</span></div><div class="bar" style="margin:4px 0 10px"><i style="width:${(s[k]%25)*4}%"></i></div>`;
 return o+`</div><div class="sub" style="text-align:center;opacity:.8">${done(today,'a')?'':`<button style="background:none;border:0;color:var(--bl);font:inherit;padding:10px" data-o="a">Bonus workout (+XP)</button>`}<br>Reopen: ${keys(today).map(k=>`<button style="background:none;border:0;color:var(--bl);font:inherit;padding:10px" data-u="${k}">${ST[k]}</button>`).join('')}</div>`}
function rv(b){if(b<0)return'';const a=b*7+1,z=Math.min(b*7+7,today);if(a>today)return'';let f=0,K=0,p=0,m=0,w=0,ld=0,c=0,msg=0,$=0;
 for(let d=a;d<=z;d++){if(!rest(d)){K++;if(full(d))f++}const v=S.v[d]||{};if(v.r)p+=v.r.p||0;if(v.l)m+=v.l.m||0;if(done(d,'w'))w++;if(done(d,'a'))w++;if(v.o){ld+=v.o.f||0;c+=v.o.c||0;msg+=v.o.m||0;$+=v.o.$||0}}
 const R=(x,y)=>`<div class="row sp"><span>${x}</span><span>${y}</span></div>`;
 return`<div class="pn"><h2>${b==Math.floor((today-1)/7)?'This week':'Last week'} (days ${a} to ${z})</h2>${R('Days cleared',f+' of '+K)}${R('Pages read',p)}${R('Minutes learned',m)}${R('Workouts',w+' (3 earns a bonus)')}${R('Leads, calls',ld+', '+c)}${R('Owner messages',msg)}${R('Money made','KES '+$)}</div>`}
/* Quest, status, library and army rendering */
function render(){
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v==V));
 const A=document.getElementById('app'),{s,t}=stats(),L=lv(t),h=n.getHours();
 if(V=='q'){const d=sel;
  if(rest(d)){A.innerHTML=hd(d).replace(', view only','')+`<div class="pn" style="text-align:center;padding:34px 14px"><h1>[REST DAY]</h1><div class="sub" style="margin-top:8px">The System has paused. Recover. Your streak is safe.</div></div>`;return}
  if(d==today&&full(d)&&!open){A.innerHTML=lvScreen(s,t,L);return}
  let o=hd(d);
  if(d!=today){o+=bn('Past day. View only, it can no longer be edited.');
   if(!full(d)&&shields()>0)o+=`<button class="t" data-sh="${d}"><span class="tt"><span class="tg">STREAK SHIELD</span><br>Protect this day (${shields()} available)</span></button>`;
   keys(d).forEach(k=>{const dn=done(d,k);if(ed&&ed.d==d&&ed.k==k){o+=editForm(d,k);return}o+=`<div class="t ${dn?'d':''}"><span class="bx">${dn?'&#10003;':''}</span><span class="tt"><span class="tg">${ST[k]}</span><br>${dn?sm(d,k)||'Done':txt(d,k)}</span></div>`+(dn&&(S.v[d]||{})[k]?`<button style="background:none;border:0;color:var(--bl);font:inherit;padding:2px 12px 10px" data-e="${k}">Correct numbers</button>`:'')});A.innerHTML=o;return}
  const left=keys(d).length-cnt(d),sk=streak();
  if(!full(d)&&h>=19)o+=bn('[WARNING] Daily quest incomplete. The System is watching.');
  else if(boss(d)&&!done(d,'b'))o+=bn('[GATE OPENED] A boss awaits. Clear it for 30 bonus XP.',1);
  else if(left==1)o+=bn('1 quest from clearing today.',1);
  else o+=bn(sk>=7?'Hunter, your stats are rising. Keep the chain alive.':h<12?'[SYSTEM] The Daily Quest has arrived.':'Your quests are waiting.',1);
  if(penNeed(d)&&!S.p[d])o+=`<button class="t pen" data-p="${d}"><span class="bx"></span><span class="tt"><span class="tg">[PENALTY QUEST]</span><br>25 squats and 20 push-ups. Missed yesterday.</span></button>`;
  keys(d).forEach(k=>{if(!done(d,k))o+=open==k?form(k):qb(k)});
  if(open=='a')o+=form('a');else if(!done(d,'a')&&(!wd(d)||done(d,'w')))o+=`<button class="t" data-o="a" style="opacity:.75"><span class="bx"></span><span class="tt"><span class="tg">BONUS</span><br>Bonus workout (+XP, optional)</span></button>`;
  A.innerHTML=o}
 if(V=='s'){const dn=fd(),tt=TITLES.filter(x=>dn>=x[0]).pop();let q=0,l=0,w=0,ld=0,c=0,msg=0,$=0,pg=0;
  for(let d=1;d<=DAYS;d++){const v=S.v[d]||{};if(v.r)pg+=v.r.p||0;if(v.o){ld+=v.o.f||0;c+=v.o.c||0;msg+=v.o.m||0;$+=v.o.$||0}if(done(d,'w'))w++;if(done(d,'a'))w++}
  let o=`<div class="pn"><h1>[STATUS]</h1><div class="row sp" style="margin-top:10px"><div><div class="sub">Level</div><div class="big">${L}</div></div><div><div class="sub">Rank</div><div class="rk">${rk(L)}</div></div><div style="text-align:right"><div class="sub">Title</div><div>${tt?tt[1]:'Unawakened'}</div><div class="sub">Streak ${streak()} days</div></div></div><div class="bar" style="margin-top:10px"><i style="width:${pct(t)}%"></i></div><div class="sub">${t} XP</div></div><div class="pn"><h2>Stats</h2>`;
  for(const k of'rlwo')o+=`<div class="row sp"><span>${ST[k]}</span><span>Lv ${sl(s[k])}</span></div><div class="bar" style="margin:4px 0 10px"><i style="width:${(s[k]%25)*4}%"></i></div>`;
  o+=`</div><div class="pn"><h2>Totals</h2><div class="row sp"><span>Pages read</span><span>${pg}</span></div><div class="row sp"><span>Workouts</span><span>${w}</span></div><div class="row sp"><span>Leads found</span><span>${ld}</span></div><div class="row sp"><span>Calls made</span><span>${c}</span></div><div class="row sp"><span>Owner messages</span><span>${msg}</span></div><div class="row sp"><span>Money made</span><span>KES ${$}</span></div></div>`;
  const b=Math.floor((today-1)/7);o+=rv(b)+rv(b-1);
  o+=`<div class="pn"><h2>Program setup</h2><div class="sub" style="margin-bottom:8px">Change the cycle start date. Day-numbered logs stay intact but their calendar dates move.</div><div class="row"><input id="programStart" type="date" value="${esc(S.startDate||CFG.startDate)}"><button class="b" id="saveStart">Save date</button></div><div class="sub" style="margin-top:8px">Weekly schedule, duration, learning topics, and boss cadence are in <code>program-config.js</code>.</div></div><div class="pn"><h2>Progress backup</h2><div class="sub" style="margin-bottom:8px">Export or restore progress anytime. TXT imports add recognized completed activities. PDF files stay on this device and are not included in backups.</div><div class="row"><button class="b" id="exportBackup">Export JSON</button><button class="b" style="${gh}" id="importBackup">Import JSON/TXT</button></div><div class="row" style="margin-top:8px"><button class="b" style="${gh}" id="restoreSafety" ${localStorage.getItem('sys90_before_import')||localStorage.getItem('sys90_autosave')?'':'disabled'}>Restore last safety copy</button></div></div><div class="pn"><h2>Account</h2>${U?`<div class="sub">${esc(U.email)}</div><div class="sub" style="margin:4px 0 8px">${SM||'Signed in'}</div><div class="row"><button class="b" id="sv">Save progress</button><button class="b" id="so" style="${gh}">Sign out</button></div>`:`<div class="sub" style="margin-bottom:8px">Sign in online to sync. Activity tracking works offline and saves on this device.</div><button class="b" id="si">Sign in with Google</button><div class="sub" style="margin-top:6px">${SM}</div>`}</div><div class="pn"><h2>Book link</h2><div class="row"><input id="lk" type="url" placeholder="https://" value="${esc(S.link||'')}"><button class="b" id="sl">Save</button></div></div>`;
  A.innerHTML=o}
 if(V=='b'){A.innerHTML=libView()}
 if(V=='d'){let o=`<div class="pn"><h1>[SHADOW ARMY]</h1><div class="sub" style="margin-bottom:8px">${fd()} shadows raised</div><div class="army">`;
  for(let d=1;d<=DAYS;d++){const risen=d<=today&&!rest(d)&&full(d),level=risen?shadowLevel(d):1;
   o+=`<button class="army-unit${risen?'':' unrisen'}" data-n="${d}" ${d>today?'disabled':''} title="Day ${d}${risen?', shadow level '+level:rest(d)?', rest day':', not yet arisen'}" aria-label="Day ${d}${risen?', shadow level '+level:', no shadow'}">${shadow(risen,level)}${risen?`<span>Lv ${level}</span>`:''}</button>`}
  o+=`</div><div class="sub army-note">Every shadow stays blue. Higher levels grow larger with redder edges as your recorded quest XP rises.</div></div><div class="pn"><h2>Days</h2><div class="g">`;
  for(let d=1;d<=DAYS;d++)o+=`<button class="c ${d>today?'lock':''} ${d==sel?'sel':''}" data-n="${d}" ${d>today?'disabled':''} aria-label="Day ${d}">${ring(d)}<span>${boss(d)?'&#9760;':d}</span></button>`;
  A.innerHTML=o+`</div><div class="sub" style="margin-top:8px">Skull days are Gate Boss days. Tap a day to view it.</div></div>`}}
// Local-first safety: progress exports omit the PDF files stored separately in IndexedDB.
function backupPayload(){
 return{format:'system-daily-quest-backup',version:1,exportedAt:new Date().toISOString(),data:JSON.parse(JSON.stringify(S))}
}
function exportBackup(){
 try{
  const blob=new Blob([JSON.stringify(backupPayload(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`daily-quest-backup-${S.startDate||CFG.startDate}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup downloaded')
 }catch(e){toast('Could not export backup')}
}
function saveSafetyCopy(){
 try{localStorage.setItem('sys90_before_import',JSON.stringify(backupPayload()));return true}
 catch(e){return false}
}
function validState(data){
 if(!data||typeof data!=='object'||!data.d||typeof data.d!=='object'||Array.isArray(data.d))return false;
 for(const k of['c','s','n','p','d','v','lib','rd'])if(data[k]!=null&&(typeof data[k]!=='object'||Array.isArray(data[k])))return false;
 return true
}
function restoreSafetyCopy(){
 try{
  const raw=localStorage.getItem('sys90_before_import')||localStorage.getItem('sys90_autosave')||'null';
  const backup=JSON.parse(raw);
  if(!backup||!validState(backup.data)){toast('No valid safety copy is available');return}
  if(!confirm('Restore the last local safety copy? Current progress will be replaced.'))return;
  S=backup.data;fix();S.startDate=S.startDate||CFG.startDate||'2026-10-24';
  START=parseStart(S.startDate);today=currentDay();sel=today;save();render();toast('Safety copy restored')
 }catch(e){toast('Could not restore the safety copy')}
}
function parseTextActivities(text){
 let activeDay=today,ignoredCount=0;const rows=[],byKey=new Map(),ignored=[];
 const noteIgnored=line=>{ignoredCount++;if(ignored.length<3)ignored.push(line.slice(0,140))};
 const dateFromLine=line=>{
  const iso=line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if(iso){const parsed=new Date(+iso[1],+iso[2]-1,+iso[3]);return parsed.getFullYear()==+iso[1]&&parsed.getMonth()==+iso[2]-1&&parsed.getDate()==+iso[3]?parsed:null}
  const months='Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const first=line.match(new RegExp(`\\b(${months})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`,'i'));
  const second=line.match(new RegExp(`\\b(\\d{1,2})\\s+(${months})\\s+(20\\d{2})\\b`,'i'));
  const day=first?+first[2]:second?+second[1]:0,monthName=first?first[1]:second&&second[2],year=first?+first[3]:second?+second[3]:0;
  if(!monthName)return null;
  const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthName.slice(0,3).toLowerCase());
  const parsed=new Date(year,month,day);return month>=0&&parsed.getFullYear()==year&&parsed.getMonth()==month&&parsed.getDate()==day?parsed:null
 };
 const activityWords=/\b(read|reading|pages?|mind|learn(?:ed|ing)?|study|intellect|lesson|workout|strength|exercise|training|gym|fitness|reps?|push[- ]?ups?|squats?|influence|outreach|business|leads?|calls?|owner(?:[ -]?messages?)?|messages?\s+\d+\s+owners?|owners?\s+messaged?|prospects?|sales)\b/i;
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const dayMatch=line.match(/\bday\s*#?\s*(\d{1,3})\b/i)||line.match(/^#?\s*(\d{1,3})\s*(?:\/\s*\d+|[.):\-])\s*/);
  if(dayMatch)activeDay=+(dayMatch[1]||dayMatch[2]);
  const date=dateFromLine(line);
  if(date)activeDay=Math.floor((date-START)/864e5)+1;
  if((dayMatch||date)&&!activityWords.test(line))continue;
  if(/\[\s*\]|\b(?:missed|not done|incomplete|to-do|todo|planned|upcoming)\b/i.test(line)){noteIgnored(line);continue}
  let key=null;
  if(/\b(read|reading|pages?|mind)\b/i.test(line))key='r';
  else if(/\b(learn(?:ed|ing)?|study|intellect|lesson)\b/i.test(line))key='l';
  else if(/\b(workout|strength|exercise|training|gym|fitness|reps?|push[- ]?ups?|squats?)\b/i.test(line))key='w';
  else if(/\b(influence|outreach|business|leads?|calls?|owner(?:[ -]?messages?)?|messages?\s+\d+\s+owners?|owners?\s+messaged?|prospects?|sales)\b/i.test(line))key='o';
  if(!key||activeDay<1||activeDay>DAYS||!keys(activeDay).includes(key)){noteIgnored(line);continue}
  const values={},number=pattern=>{const match=line.match(pattern);return match?+(match[1]||match[2]).replace(/,/g,''):null};
  if(key=='r'){
   const pages=number(/\b(\d+)\s*(?:pages?|pgs?)\b/i);if(pages!==null)values.p=pages
  }else if(key=='l'){
   const minutes=number(/\b(\d+)\s*(?:minutes?|mins?)\b/i);if(minutes!==null)values.m=minutes
  }else if(key=='w'){
   const reps=number(/\b(\d+)\s*(?:reps?|seconds?|secs?)\b/i);if(reps!==null)values.n=reps
  }else{
   const leads=number(/\b(\d+)\s*leads?\b/i),calls=number(/\b(\d+)\s*calls?\b/i),money=number(/\bKES\s*([\d,]+)/i);
   const messages=line.match(/\b(\d+)\s*(?:owner\s+)?messages?\b/i)||line.match(/\b(\d+)\s*messages?\s*(?:to|for)\s*owners?\b/i)||line.match(/\b(?:message[ds]?|messaging)\s*(\d+)\s*owners?\b/i)||line.match(/\bowner(?:s)?\s*messages?\s*[:=-]?\s*(\d+)\b/i)||line.match(/\b(\d+)\s+owners?\s+messaged?\b/i);
   if(leads!==null)values.f=leads;if(calls!==null)values.c=calls;if(messages)values.m=+(messages[1]||messages[2]);if(money!==null)values.$=money
  }
  if(key=='o'&&pDay(activeDay)&&(values.m||0)<(CFG.outreachMessagesPerDay||5)){noteIgnored(line);continue}
  const id=activeDay+':'+key,prior=byKey.get(id);
  if(prior){Object.assign(prior.values,values);prior.line+='; '+line}
  else{const row={day:activeDay,key,line,values};byKey.set(id,row);rows.push(row)}
 }
 return{rows,ignored:ignoredCount,ignoredSamples:ignored}
}
async function importProgressFile(file){
 if(!file)return;
 if(file.size>2*1024*1024){toast('File is over the 2 MB safety limit');return}
 try{
  const text=await file.text(),isText=/\.txt$/i.test(file.name),looksJson=/\.json$/i.test(file.name)||(isText&&/^(?:\{|\[)/.test(text.trim()));
  if(!looksJson){
   await PQ_READY;
   const parsed=parseTextActivities(text);
   if(!parsed.rows.length){toast('No recognizable completed activities found. Use day numbers or dates with activity names.');return}
   const summary=parsed.rows.slice(0,10).map(row=>`Day ${row.day}: ${ST[row.key]} — ${row.line}`).join('\n');
   const skipped=parsed.ignored?`\n\n${parsed.ignored} line(s) were ignored${parsed.ignoredSamples.length?': '+parsed.ignoredSamples.join(' | '):'.'}`:'';
   const prompt=`Preview: ${parsed.rows.length} activity record(s) will be added to this device. Unmarked recognized activities count as completed; unchecked/planned, unrecognized, unscheduled, or persuasion rows without the required owner-message count are ignored.\n\n${summary}${parsed.rows.length>10?'\n…':''}${skipped}\n\nContinue?`;
   if(!confirm(prompt))return;
   if(!saveSafetyCopy()){toast('Could not save a safety copy; import cancelled');return}
   for(const row of parsed.rows){
    S.d[row.day]=S.d[row.day]||{};S.d[row.day][row.key]=1;
    if(Object.keys(row.values).length){S.v[row.day]=S.v[row.day]||{};S.v[row.day][row.key]={...(S.v[row.day][row.key]||{}),...row.values}}
   }
   save();render();toast(`Imported ${parsed.rows.length} activity record(s); previous data is recoverable`);return
  }
  const raw=JSON.parse(text),data=raw&&raw.data?raw.data:raw;
  if(raw&&raw.format&&raw.format!='system-daily-quest-backup')throw Error('Unsupported backup format');
  if(raw&&raw.version>1)throw Error('This backup was made by a newer app');
  if(!validState(data))throw Error('The file does not contain a Daily Quest progress backup');
  if(!confirm(`Restore this backup from ${raw.exportedAt||'an imported file'}? Current app progress will be replaced, but a local safety copy will be kept first. PDF files are not included.`))return;
  if(!saveSafetyCopy()){toast('Could not save a safety copy; restore cancelled');return}
  S=data;fix();S.startDate=S.startDate||CFG.startDate||'2026-10-24';
  START=parseStart(S.startDate);today=currentDay();sel=today;save();render();toast('Backup restored; previous data is recoverable')
 }catch(e){toast('Import failed: '+(e.message||'invalid file'))}
}

function complete(k){const d=today,g=i=>+(document.getElementById(i)||{}).value||0,tx=i=>((document.getElementById(i)||{}).value||'').trim(),v={};let bad=0;
 if(k=='r'){v.p=g('f1');bad=!v.p}else if(k=='l'){v.m=g('f1');bad=!v.m}else if(k=='w'||k=='a'){v.n=g('f1');bad=!v.n}else if(k=='o'){v.f=g('f1');v.c=g('f2');v.$=g('f3');bad=!(v.f||v.c||v.$)}
 if(bad){toast('Enter your numbers first');return}
 if((k=='r'||k=='l')&&!tx('f2')){toast('Write your one-line takeaway first');return}
 if(k=='r'||k=='l')(S.n[d]=S.n[d]||{})[k]=tx('f2');
 const l0=lv(stats().t);S.d[d]=S.d[d]||{};S.d[d][k]=1;(S.v[d]=S.v[d]||{})[k]=v;let crit=0;if(k!='b'&&Math.random()<.2){S.c[d+k]=1;crit=1}
 open=null;save();render();beep();const x=xp(d,k),l1=lv(stats().t);
 toast(l1>l0?'[LEVEL UP] You reached level '+l1+'.':crit?'[CRITICAL HIT] +'+x+' XP, double.':full(d)&&k!='a'?'[QUEST COMPLETE] Arise.':'+'+x+' XP '+ST[k],k)}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const D=b.dataset;
 if(D.v){V=D.v;open=null;ed=null;render();scrollTo(0,0);return}
 if(D.n){sel=+D.n;ed=null;V='q';render();scrollTo(0,0);return}
 if((D.o||D.c||D.p||D.u)&&sel!=today){toast('Past days are locked');return}
 if(D.o){open=D.o;if(D.o=='b'){complete('b');return}render();return}
 if(D.x){open=null;ed=null;render();return}
 if(D.e){ed={d:sel,k:D.e};render();return}
 if(D.sc){saveEdit(D.sc);return}
 if(D.ob){openBook(D.ob);return}
 if(D.at){attachId=D.at=='new'?null:D.at;document.getElementById('pf').click();return}
 if(D.rm){if(confirm('Remove this book from your Library?')){idbOp('del',D.rm).catch(()=>{});delete S.lib[D.rm];delete have[D.rm];save();render()}return}
 if(D.c){complete(D.c);return}
 if(D.u){const k=D.u,d=today;if(S.d[d]&&S.d[d][k]){delete S.d[d][k];delete (S.v[d]||{})[k];delete S.c[d+k];save();toast('Quest reopened');render()}const m=b.closest('.msg');if(m)m.remove();return}
 if(D.p){S.p[D.p]=S.p[D.p]?0:1;save();render();return}
 if(D.sh){S.s[D.sh]=1;save();toast('[SHIELD] Streak protected.');render();return}
 if(b.id=='si'){if(navigator.onLine===false){SM='Go online to sign in; your activity is still saved on this device.';render();return}SM='Loading Google sign-in';render();import('./firebase-auth.js').then(()=>fb.signIn()).catch(x=>{SM='Sign-in failed: '+(x.code||x.message);render()});return}
 if(b.id=='so'){fb.out();return}
 if(b.id=='sv'){SM='Saving';render();sync();return}
 if(b.id=='sl'){S.link=document.getElementById('lk').value.trim();save();toast('Book link saved');render();return}if(b.id=='saveStart'){const value=document.getElementById('programStart').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)){toast('Choose a valid start date');return}if(!confirm('Changing the start date relabels all day-numbered activity records. Export a backup first. Continue?'))return;S.startDate=value;START=parseStart(value);today=currentDay();sel=today;save();render();toast('Program start date updated');return}if(b.id=='exportBackup'){exportBackup();return}if(b.id=='importBackup'){document.getElementById('backupfile').click();return}if(b.id=='restoreSafety'){restoreSafetyCopy();return}});

const completeBase=complete;complete=function(k){if(k!='o'||!pDay(today))return completeBase(k);const d=today,g=i=>+(document.getElementById(i)||{}).value||0,v={f:g('f1'),c:g('f2'),$:g('f3'),m:g('f4')};if(v.m<(CFG.outreachMessagesPerDay||5)){toast(`Log at least ${CFG.outreachMessagesPerDay||5} owner messages to clear this drill`);return}const l0=lv(stats().t);S.d[d]=S.d[d]||{};S.d[d][k]=1;(S.v[d]=S.v[d]||{})[k]=v;let crit=0;if(Math.random()<.2){S.c[d+k]=1;crit=1}open=null;save();render();beep();const x=xp(d,k),l1=lv(stats().t);toast(l1>l0?'[LEVEL UP] You reached level '+l1+'.':crit?'[CRITICAL HIT] +'+x+' XP, double.':full(d)?'[QUEST COMPLETE] Arise.':'+'+x+' XP '+ST[k],k)};
/* Local PDF library (PDF data stays in IndexedDB on this device) */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('sysLib',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idbOp=async(m,k,v)=>{const db=await idb();return new Promise((res,rej)=>{const s=db.transaction('f',m=='get'?'readonly':'readwrite').objectStore('f'),q=m=='get'?s.get(k):m=='put'?s.put(v,k):s.delete(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})};
let have={},attachId=null,PDF=null,cur=1,zoom=1,bid=null,tmr=null,rt=null;
async function refreshHave(){try{const db=await idb();await new Promise(r=>{const q=db.transaction('f').objectStore('f').getAllKeys();q.onsuccess=()=>{have={};q.result.forEach(k=>have[k]=1);r()};q.onerror=()=>r()})}catch(e){}}
const rdToday=()=>Object.values(S.rd[today]||{}).reduce((a,x)=>a+x.length,0);
const libView=()=>{const ids=Object.keys(S.lib);let o=`<div class="pn"><div class="row sp"><h1>[LIBRARY]</h1><button class="b" data-at="new">Add PDF</button></div><div class="sub" style="margin-top:6px">${rdToday()} pages read today. They fill in your Mind quest.</div></div>`;
 if(!ids.length)o+=`<div class="pn"><div class="sub">No books yet. Tap Add PDF and choose a book from your phone. Books stay on this phone and work offline.</div></div>`;
 ids.forEach(id=>{const b=S.lib[id],pc=b.n?Math.round((b.m||0)/b.n*100):0;o+=`<div class="pn"><h2>${esc(b.t)}</h2><div class="sub">${b.n} pages. Furthest page ${b.m||0}.${have[id]?'':' Not on this phone yet.'}</div><div class="bar" style="margin:8px 0"><i style="width:${pc}%"></i></div><div class="row">${have[id]?`<button class="b" data-ob="${id}">${(b.m||0)>0?'Continue':'Start'}</button>`:`<button class="b" data-at="${id}">Add file</button>`}<button class="b" style="${gh}" data-rm="${id}">Remove</button></div></div>`});return o};
async function ensurePdfjs(){if(window.pdfjsLib)return;await new Promise((res,rej)=>{const s=document.createElement('script');s.src='pdf.min.js';s.onload=res;s.onerror=rej;document.head.append(s)});pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js'}
async function addFile(f){if(!f)return;if(!/\.pdf$/i.test(f.name)&&f.type!='application/pdf'){toast('Please choose a PDF file');return}
 try{toast('Adding book...');await ensurePdfjs();const buf=await f.arrayBuffer(),pd=await pdfjsLib.getDocument({data:buf.slice(0)}).promise,n=pd.numPages;pd.destroy();
  const id=attachId||('b'+Date.now());S.lib[id]=S.lib[id]||{t:f.name.replace(/\.pdf$/i,''),p:1,m:0};S.lib[id].n=n;
  await idbOp('put',id,buf);have[id]=1;try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
  attachId=null;save();render();toast('Book added')}catch(e){toast('Could not open that PDF')}}
async function openBook(id){try{await ensurePdfjs();const buf=await idbOp('get',id);if(!buf){have[id]=0;toast('File is not on this phone');render();return}PDF=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;bid=id;cur=Math.min(Math.max(S.lib[id].p||1,1),PDF.numPages);zoom=1;viewer()}catch(e){toast('Could not open this book')}}
function viewer(){const v=document.createElement('div');v.id='vw';v.style.cssText='position:fixed;inset:0;z-index:30;background:#05080f;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px)';
 v.innerHTML=`<div class="row sp" style="padding:10px 14px;border-bottom:1px solid var(--ln)"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.lib[bid].t)}</span><span id="vp" class="sub"></span><button class="b" id="vc">Close</button></div><div id="vs" style="flex:1;min-height:0;overflow:auto;padding:8px"><canvas id="vcv" style="display:block;margin:0 auto"></canvas></div><div class="row sp" style="padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--ln)"><button class="b" id="vb">Prev</button><button class="b" id="vzo" style="${gh}">-</button><input id="vj" type="number" min="1" style="width:72px;text-align:center"><button class="b" id="vzi" style="${gh}">+</button><button class="b" id="vn">Next</button></div>`;
 document.body.append(v);const q=id=>document.getElementById(id);
 q('vc').onclick=closeBook;q('vb').onclick=()=>go(cur-1);q('vn').onclick=()=>go(cur+1);
 q('vzi').onclick=()=>{zoom=Math.min(3,zoom+.25);draw()};q('vzo').onclick=()=>{zoom=Math.max(1,zoom-.25);draw()};q('vj').onchange=e=>go(+e.target.value||cur);
 let x0=0;const sc=q('vs');sc.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});sc.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-x0;if(zoom==1&&Math.abs(dx)>70)go(cur+(dx<0?1:-1))});
 draw()}
const go=p=>{if(!PDF||p<1||p>PDF.numPages)return;cur=p;draw()};
async function draw(){clearTimeout(tmr);const pg=await PDF.getPage(cur),sc=document.getElementById('vs'),cv=document.getElementById('vcv');if(!cv)return;
 const w=sc.clientWidth-16,b=pg.getViewport({scale:1}),vp=pg.getViewport({scale:w/b.width*zoom}),dpr=Math.min(devicePixelRatio||1,2);
 if(rt)try{rt.cancel()}catch(e){}
 cv.width=vp.width*dpr;cv.height=vp.height*dpr;cv.style.width=vp.width+'px';cv.style.height=vp.height+'px';
 rt=pg.render({canvasContext:cv.getContext('2d'),viewport:vp,transform:[dpr,0,0,dpr,0,0]});rt.promise.catch(()=>{});
 document.getElementById('vp').textContent=cur+' / '+PDF.numPages;document.getElementById('vj').value=cur;
 const L=S.lib[bid];L.p=cur;if(cur>(L.m||0))L.m=cur;save();
 tmr=setTimeout(()=>{const r=S.rd[today]=S.rd[today]||{},a=r[bid]=r[bid]||[];if(!a.includes(cur)){a.push(cur);save()}},4000)}
function closeBook(){clearTimeout(tmr);const v=document.getElementById('vw');if(v)v.remove();try{PDF.destroy()}catch(e){}PDF=null;render()}
const editForm=(d,k)=>{const v=(S.v[d]||{})[k]||{},nt=(S.n[d]||{})[k]||'',i=(id,ph,val,ty)=>`<input id="${id}" ${ty?`type="text" maxlength="100"`:`type="number" inputmode="numeric" min="0"`} placeholder="${ph}" value="${esc(val)}">`;let f='';
 if(k=='r')f=i('f1','Pages read',v.p??'')+i('f2','Your one-line takeaway',nt,1);
 if(k=='l')f=i('f1','Minutes spent',v.m??'')+i('f2','Your one-line takeaway',nt,1);
 if(k=='w'||k=='a')f=i('f1','Total reps',v.n??'');
 if(k=='o')f=i('f1','New leads found',v.f??'')+i('f2','Calls made',v.c??'')+i('f3','Money made (KES)',v.$??'')+(pDay(d)?i('f4','Owner messages sent',v.m??''):'');
 return`<div class="pn"><h2>Correct ${ST[k]}, day ${d}</h2><div class="sub" style="margin-bottom:8px">Fix a wrong number. This cannot complete a missed quest.</div><div style="display:grid;gap:8px">${f}</div><div class="row" style="margin-top:10px"><button class="b" data-sc="${k}">Save changes</button><button class="b" style="${gh}" data-x="1">Cancel</button></div></div>`};
function saveEdit(k){const d=ed.d,g=i=>+(document.getElementById(i)||{}).value||0,tx=i=>((document.getElementById(i)||{}).value||'').trim(),v={};
 if(k=='r')v.p=g('f1');else if(k=='l')v.m=g('f1');else if(k=='w'||k=='a')v.n=g('f1');else if(k=='o'){v.f=g('f1');v.c=g('f2');v.$=g('f3');if(pDay(d))v.m=g('f4')}
 (S.v[d]=S.v[d]||{})[k]=v;if(k=='r'||k=='l'){S.n[d]=S.n[d]||{};S.n[d][k]=tx('f2')}
 ed=null;save();render();toast('Numbers corrected')}
document.addEventListener('change',e=>{if(e.target.id=='pf'){addFile(e.target.files[0]);e.target.value=''}if(e.target.id=='backupfile'){importProgressFile(e.target.files[0]);e.target.value=''}});
const PQ_READY=fetch(CFG.persuasionDataFile||'persuasion-quests.json').then(r=>{if(!r.ok)throw Error('quests unavailable');return r.json()}).then(x=>{PQ=x;render()}).catch(()=>{});
refreshHave().then(()=>{if(V=='b')render()});
function fit(){const w=innerWidth;document.body.style.zoom=(screen.width<700&&w>screen.width*1.2)?Math.min(3,w/480):1}
fit();addEventListener('resize',fit);try{navigator.storage?.persist?.().catch(()=>{})}catch(e){}
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
