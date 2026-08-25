/* =========================================================
   BIO-ARPG :: full game logic (vanilla JS)
   ========================================================= */

/* ---------- Game State ---------- */
function makeDefaultState(){
  return {
    hp:100, energy:100, mood:100, money:500, exp:0,
    passPoints:1,
    mutations:{ arms:0, back:0, chest:0, legs:0, core:0, mode:0, mind:0, skin:0, spirit:0 },
    profile:{ name:'', avatar:'fa-user-astronaut', color:'#00f3ff', class:'' },
    niche:'',
    stats:{ train:0, work:0, rest:0, loot:0 },
    daily:{ date:'', train:0, earn:0, loot:0, mut:0, claimed:false, slept:false, trainById:{} },
    streak:{ lastDate:'', count:0 },
    pet:{ level:1, exp:0 },
    history:{ exp:[0], weight:[61] },
    achievements:{},
    age:18, hunger:100, sleepDebt:0,
    attr:{ str:0, sta:0, cha:0 },
    channel:1, studio:0,
    sponsor:{ active:false, days:0, bonus:0 },
    glyphs:[],
    difficulty:'normal',
    endings:{},
    meta:{ level:0, points:0, up:{} },
    clan:'',
    story:{},
    miniGame:false,
    musicOn:false,
    tutorialDone:false,
    inventory:[],
    equipped:{ helmet:null, torso:null, gloves:null, boots:null, artifact:null },
    weekly:{ key:'', train:0, earn:0, loot:0, claimed:{} }
  };
}
let state = makeDefaultState();

/* escape user-controlled strings before inserting into innerHTML */
function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

/* item image with fa-icon fallback for old saves */
const IMG_BY_ICON = {};
for(const poolKey of Object.keys(ITEM_POOL))
  for(const e of ITEM_POOL[poolKey])
    if(e.img) IMG_BY_ICON[e.icon] = e.img;
/* legacy icon names from old saves (renamed Pro-only icons) */
IMG_BY_ICON['fa-boot'] = 'images/items/speed-boots.svg';
IMG_BY_ICON['fa-baseball-cap'] = 'images/items/cap.svg';
function itemImg(it, cls){
  const src = it.img || IMG_BY_ICON[it.icon];
  return src ? `<img class="item-img ${cls||''}" src="${esc(src)}" alt="">` : `<i class="fa-solid ${it.icon}"></i>`;
}

/* ---------- Transformation stages ----------
   photo  -> файл фотографии (имя = вес формы), например 61kg.png
   svg    -> авто-сгенерированный неоновый силуэт (фолбэк, если фото нет)
   min/max -> диапазон суммарного EXP формы
------------------------------------------------------------- */

function level(){ return Math.floor(state.exp/150)+1; }
function currentStage(){
  for(const s of STAGES){ if(state.exp>=s.min && state.exp<s.max) return s; }
  return STAGES[STAGES.length-1];
}
function nextStageThreshold(){
  const s = currentStage();
  return s.max===Infinity ? null : s.max;
}

/* tracks the last displayed form to fire the swap animation only on change */
let lastStageMin = STAGES[0].min;

/* ---------- Actions definitions ---------- */

/* ---------- Mutation tree config ----------
   Ветки располагаются радиально; угол считается автоматически
   по их количеству (360 / BRANCHES.length).
   ------------------------------------------------------------ */

/* ---------- Item pools for lootboxes ---------- */

/* =========================================================
   CORE MECHANICS
   ========================================================= */

function totalStrBonus(){
  let b = 0;
  for(const k in state.equipped){ const it=state.equipped[k]; if(it) b += (it.exp||0); }
  return b;
}
function expMult(){
  const m = state.mutations;
  return (1 + m.arms*0.05 + m.legs*0.04 + m.spirit*0.06) * classExpMult() * nicheExpMult() * metaMult() * diffExp() * ageFactor() * (1 + state.attr.str*0.01 + glyphBonus('exp')) * (state.hunger<30?0.7:1) * (1 + metaUp('m_exp')*0.04);
}
function trainCostMult(){
  let m = 1 - state.mutations.back*0.08;
  m *= diffDecay();
  m *= nicheStaMult();
  m *= (1 - Math.min(0.4, state.attr.sta*0.005));
  m *= (1 - state.studio*0.05);
  return Math.max(0.1, m);
}
function incomeMult(){ return (1 + state.mutations.chest*0.06) * classIncomeMult() * nicheIncMult() * metaMult() * clanMult() * petIncomeMult() * diffInc() * (1 + state.attr.cha*0.01 + glyphBonus('inc')) * (1 + state.sponsor.bonus + state.studio*0.05) * (1 + metaUp('m_income')*0.05); }
function restEnergyMult(){ return 1 - state.mutations.skin*0.07; }
function moodLossMult(){
  let red = state.mutations.core*0.10;
  if(state.equipped.helmet) red += state.equipped.helmet.moodReduce||0;
  red += (state.hunger<30?0.15:0) + (state.difficulty==='hard'?0.05:0) + (state.sleepDebt/200) + glyphBonus('mood');
  return Math.max(0, 1-red);
}
function hpLossMult(){
  let red = state.mutations.back*0.08;
  if(state.equipped.torso) red += state.equipped.torso.hpReduce||0;
  red += (state.sleepDebt>50?0.10:0);
  return Math.max(0, 1-red);
}
function energyCostMult(){
  let red = 0;
  if(state.equipped.boots) red += state.equipped.boots.energyReduce||0;
  return Math.max(0.1, 1-red);
}
function recoveryMult(){ return (1 + state.mutations.mode*0.10) * nicheRecMult() * petRecMult() * (state.sleepDebt>50?0.6:1); }
function artifactMoney(){ return state.equipped.artifact ? Math.round((state.equipped.artifact.money||0) * (1 + state.mutations.mind*0.05)) : 0; }

function clamp(v){ return Math.max(0, Math.min(100, v)); }

/* ---------------- Perform a training action ---------------- */
function doTrain(t, opt){
  opt = opt || {};
  if(gameOverActive){ toast('Забег окончен — начни заново','bad'); return; }
  const mult = opt.mult || 1;
  const lvl = level();
  if(lvl < t.lvl){ toast('Действие заблокировано: нужен '+t.lvl+' уровень','bad'); return; }
  const enCost = t.energy*energyCostMult();
  const hpCost = t.hp*hpLossMult();
  if(state.energy < enCost){ toast('Недостаточно Бодрости!','bad'); return; }
  if(state.hp < hpCost){ toast('Недостаточно Здоровья!','bad'); return; }
  if(state.money < t.money){ toast('Недостаточно ₽!','bad'); return; }
  state.energy = clamp(state.energy - enCost);
  state.hp = clamp(state.hp - hpCost);
  if(t.money>0) state.money -= t.money;
  // mental fatigue: harder trainings cost more mood (reduced by m_mood)
  state.mood = clamp(state.mood - (3 + Math.floor(t.energy/12))*(1 - 0.06*metaUp('m_mood')));
  // diminishing returns for spamming the same exercise
  state.daily.trainById = state.daily.trainById || {};
  state.daily.trainById[t.id] = (state.daily.trainById[t.id]||0) + 1;
  const rep = state.daily.trainById[t.id];
  const dim = Math.max(0.3, 1 - 0.12*(rep-1));
  const gain = Math.round((t.exp*dim*expMult()*streakMult()*mult) + totalStrBonus());
  state.exp += gain;
  state.stats.train++;
  state.daily.train++;
  state.weekly.train++;
  state.attr.str += 1;
  state.hunger = clamp(state.hunger - 2*(1 - 0.1*metaUp('m_hunger')));
  petExpGain(Math.round(gain/10*(1 + 0.15*metaUp('m_pet'))));
  toast('Тренировка: +'+gain+' EXP'+(rep>1?' (x'+dim.toFixed(2)+' повтор)':'')+(mult!==1?' (x'+mult.toFixed(2)+' мини-игра)':''),'good');
  sfx('buy');
  afterAction();
}

/* ---------------- Training timing minigame ---------------- */
let pendingTrain = null;
let miniTimer = null;
let miniPos = 0;
let miniDir = 1;
function startTrain(t){
  if(state.miniGame){ openMinigame(t); } else { doTrain(t); }
}
function openMinigame(t){
  pendingTrain = t;
  const track = document.getElementById('mini-track');
  const mark = document.getElementById('mini-marker');
  if(mark) mark.style.left = '0%';
  miniPos = 0; miniDir = 1;
  openModal('modal-minigame');
  if(miniTimer) clearInterval(miniTimer);
  miniTimer = setInterval(function(){
    miniPos += miniDir*3.2;
    if(miniPos>=100){ miniPos=100; miniDir=-1; }
    if(miniPos<=0){ miniPos=0; miniDir=1; }
    if(mark) mark.style.left = miniPos+'%';
  }, 16);
}
function stopMinigame(){
  if(miniTimer){ clearInterval(miniTimer); miniTimer=null; }
  const mark = document.getElementById('mini-marker');
  const pos = mark ? parseFloat(mark.style.left)||0 : 0;
  const center = 50;
  const dist = Math.abs(pos-center);
  let mult = 0.85;
  if(dist <= 8) mult = 1.6; else if(dist <= 20) mult = 1.25;
  closeModal('modal-minigame');
  const t = pendingTrain; pendingTrain=null;
  if(t) doTrain(t, { mult:mult, viaMini:true });
}

/* ---------------- Perform a work action ---------------- */
function doWork(w){
  if(gameOverActive){ toast('Забег окончен — начни заново','bad'); return; }
  const lvl = level();
  if(lvl < w.lvl){ toast('Действие заблокировано: нужен '+w.lvl+' уровень','bad'); return; }
  if(state.energy < w.energy){ toast('Недостаточно Бодрости!','bad'); return; }
  if(state.mood < w.mood){ toast('Недостаточно Настроения!','bad'); return; }
  state.energy = clamp(state.energy - w.energy);
  state.mood = clamp(state.mood - w.mood*moodLossMult()*(1 - 0.06*metaUp('m_mood')));
  const earn = Math.round(w.money*incomeMult()) + artifactMoney();
  state.money += earn;
  state.stats.work++;
  state.daily.earn += earn;
  state.weekly.earn += earn;
  state.attr.cha += 1;
  state.channel = Math.min(999, state.channel + Math.max(1, Math.round(earn/250)));
  maybeDonate();
  autoChat?.();
  toast('Работа: +'+earn+' ₽','good');
  sfx('buy');
  afterAction();
}

/* ---------------- Perform a rest action ---------------- */
function doRest(r){
  if(gameOverActive){ toast('Забег окончен — начни заново','bad'); return; }
  const lvl = level();
  if(lvl < r.lvl){ toast('Действие заблокировано: нужен '+r.lvl+' уровень','bad'); return; }
  if(r.id==='r1' && state.daily.slept){ toast('Ты уже спал сегодня. Восстанавливайся отдыхом или поработай.','bad'); sfx('error'); return; }
  const restEnCost = Math.round(r.energyCost * restEnergyMult());
  if(r.energyCost>0 && state.energy < restEnCost){ toast('Недостаточно Бодрости!','bad'); return; }
  if(r.money>0 && state.money < r.money){ toast('Недостаточно ₽!','bad'); return; }
  if(r.energyCost>0) state.energy = clamp(state.energy - restEnCost);
  if(r.money>0) state.money -= r.money;
  const m = recoveryMult();
  if(r.hp>0) state.hp = clamp(state.hp + r.hp*m);
  if(r.energy>0) state.energy = clamp(state.energy + r.energy*m);
  if(r.mood>0) state.mood = clamp(state.mood + r.mood*m);
  if(r.hunger) state.hunger = clamp(state.hunger + r.hunger);
  state.attr.sta += 1;
  if(r.id==='r1'){
    state.daily.slept = true;
    state.sleepDebt = clamp(state.sleepDebt - 50);
    const rent = 100 + level()*12;
    if(state.money >= rent){ state.money -= rent; toast('Аренда и питание оплачены: -'+rent+' ₽','good'); }
    else { const debt = rent - state.money; state.money = 0; state.mood = clamp(state.mood - 20); state.hp = clamp(state.hp - 10); toast('Не хватило на аренду! Долг '+debt+' ₽ — настроение и HP просели.','bad'); sfx('error'); }
  }
  state.stats.rest++;
  toast('Восстановление: +HP/Энергия/Настроение','good');
  sfx('buy');
  afterAction();
}

/* ---------------- Post-action checks ---------------- */
function afterAction(){
  const newLvl = level();
  // grant passive points on level up (start with 1, +1 per level above 1)
  const expectedPP = 1 + (newLvl - 1);
  if(expectedPP > state.passPoints){
    const gained = expectedPP - state.passPoints;
    state.passPoints = expectedPP;
    toast('Новый уровень '+newLvl+'! +'+gained+' очк. пассивок','good');
    sfx('level');
    if(window.burstCenter) burstCenter('var(--cyan)');
  }
  // check death
  if(state.hp<=0){ triggerGameOver('Здоровье (HP) достигло нуля — организм не выдержал нагрузки.'); return; }
  if(state.mood<=0){ triggerGameOver('Настроение (Mood) на нуле — наступил нервный срыв.'); return; }
  if(state.energy<=0){ triggerGameOver('Бодрость (Energy) иссякла — полное выгорание.'); return; }
  bumpStreak();
  ensureDaily();
  recordHistory();
  checkDaily();
  checkAchievements();
  checkStory();
  checkEndings();
  renderAll();
  saveGame();
}

/* =========================================================
   RENDERING
   ========================================================= */

/* ---- Form-change spectacle: flash + glow on the hero and stage name ---- */
function playFormChange(stage){
  const img = document.getElementById('arpg-hero-img');
  const nameEl = document.getElementById('stage-name');
  img.classList.remove('form-flash'); void img.offsetWidth; img.classList.add('form-flash');
  nameEl.classList.remove('form-flash-text'); void nameEl.offsetWidth; nameEl.classList.add('form-flash-text');
  toast('НОВАЯ ФОРМА: ' + stage.label, 'good');
}
function renderAll(){
  renderStatus();
  renderActions();
  renderHeroCard();
  renderTree();
  renderInventory();
  renderTreePoints();
  renderCallsign();
  renderVitals();
  updateViewers();
}

function renderStatus(){
  setNum('hp-val', Math.round(state.hp));
  setNum('en-val', Math.round(state.energy));
  setNum('mo-val', Math.round(state.mood));
  setNum('mn-val', Math.round(state.money), ' ₽');
  document.getElementById('hp-bar').style.width = state.hp+'%';
  document.getElementById('en-bar').style.width = state.energy+'%';
  document.getElementById('mo-bar').style.width = state.mood+'%';
  document.getElementById('mn-bar').style.width = Math.min(100, state.money/50)+'%';

  const s = currentStage();
  const lvl = level();
  document.getElementById('stage-name').textContent = s.label;
  document.getElementById('lvl-val').textContent = lvl;
  const sv = document.getElementById('streak-val');
  if(sv){
    sv.textContent = (state.streak.count||0)+' дн. · ×'+streakMult().toFixed(2);
  }
  document.getElementById('hero-form').textContent = s.label;
  const goal = nextStageThreshold();
  setNum('exp-cur', Math.floor(state.exp));
  if(goal===null){
    document.getElementById('exp-goal').textContent = 'MAX';
    document.getElementById('exp-pct').textContent = '100.00%';
    document.getElementById('exp-left').textContent = '0';
    document.getElementById('exp-bar').style.width = '100%';
  } else {
    const start = s.min;
    const pct = ((state.exp-start)/(goal-start))*100;
    document.getElementById('exp-goal').textContent = goal;
    document.getElementById('exp-pct').textContent = pct.toFixed(2)+'%';
    setNum('exp-left', Math.max(0, Math.floor(goal-state.exp)));
    document.getElementById('exp-bar').style.width = pct+'%';
  }
  const heroImg = document.getElementById('arpg-hero-img');
  heroImg.onerror = function(){ this.onerror = null; this.src = s.svg; };
  heroImg.src = s.photo;

  // form-change animation (only when the form actually changes)
  if(s.min !== lastStageMin){
    lastStageMin = s.min;
    playFormChange(s);
  }
}

function actionReason(a, kind){
  const lvl = level();
  if(lvl < a.lvl) return { type:'lvl', text:'Lvl '+a.lvl };
  if(kind==='train'){
    const enCost = a.energy*energyCostMult();
    if(state.energy < enCost) return { type:'en', text:'Нужна Энергия +'+Math.ceil(enCost-state.energy) };
    const hpCost = a.hp*hpLossMult();
    if(state.hp < hpCost) return { type:'hp', text:'Нужно HP +'+Math.ceil(hpCost-state.hp) };
    if(state.money < a.money) return { type:'money', text:'Нужно ₽ +'+(a.money-state.money) };
    return null;
  }
  if(kind==='work'){
    if(state.energy < a.energy) return { type:'en', text:'Нужна Энергия +'+(a.energy-state.energy) };
    if(state.mood < a.mood) return { type:'mood', text:'Нужно Настроение +'+(a.mood-state.mood) };
    return null;
  }
  if(kind==='rest'){
    const enCost = Math.round(a.energyCost*restEnergyMult());
    if(a.energyCost>0 && state.energy < enCost) return { type:'en', text:'Нужна Энергия +'+(enCost-state.energy) };
    if(a.money>0 && state.money < a.money) return { type:'money', text:'Нужно ₽ +'+(a.money-state.money) };
    if(a.id==='r1' && state.daily.slept) return { type:'sleep', text:'Уже спал · доступно завтра' };
    return null;
  }
  return null;
}
function actionCardHTML(a, kind){
  const lvl = level();
  const locked = lvl < a.lvl;
  const reason = locked ? null : actionReason(a, kind);
  let req = '';
  if(kind==='train') req = `<div class="text-[11px] text-cyan-300/60 mt-1">EXP +${a.exp} | Эн ${a.energy} | HP ${a.hp}${a.money?(' | ₽'+a.money):''}</div>`;
  if(kind==='work') req = `<div class="text-[11px] text-cyan-300/60 mt-1">₽ +${a.money} | Эн ${a.energy} | Настр ${a.mood}</div>`;
  if(kind==='rest') req = `<div class="text-[11px] text-cyan-300/60 mt-1">${a.hp?('HP +'+a.hp+' '):''}${a.energy?('Эн +'+a.energy+' '):''}${a.mood?('Настр +'+a.mood):''}${a.money?(' | ₽'+a.money):''}</div>`;
  const stateClass = (locked ? 'locked' : (reason ? 'blocked' : '')) + (a.emergency ? ' emergency' : '');
  const badge = locked
    ? `<div class="text-purple-300 text-xs badge-lock"><i class="fa-solid fa-lock"></i> Lvl ${a.lvl}</div>`
    : (reason ? `<div class="text-[11px] badge-blocked"><i class="fa-solid fa-ban"></i> ${reason.text}</div>` : '');
  const body = `
    <div class="glass rounded-xl p-3 action-card ${stateClass}">
      <div class="flex items-center gap-2">
        <div class="text-2xl text-cyan-300"><i class="fa-solid ${a.icon}"></i></div>
        <div class="flex-1">
          <div class="text-sm font-semibold leading-tight">${a.name}</div>
        </div>
        ${badge}
      </div>
      ${req}
      <div class="act-desc text-[11px] text-cyan-200/60 mt-1">${a.desc}</div>
    </div>`;
  if(locked || reason) return body;
  return `<div data-call="doAction" data-args="${kind},${a.id}">${body}</div>`;
}

/* delegated handler for action cards */
function doAction(kind, id){
  const pool = kind==='train' ? TRAININGS : (kind==='work' ? WORKS : RESTS);
  const a = pool.find(x=>x.id===id);
  if(!a) return;
  if(kind==='train') startTrain(a);
  else if(kind==='work') doWork(a);
  else doRest(a);
}

function renderActions(){
  document.getElementById('col-train').innerHTML = TRAININGS.map(a=>actionCardHTML(a,'train')).join('');
  document.getElementById('col-work').innerHTML = WORKS.map(a=>actionCardHTML(a,'work')).join('');
  document.getElementById('col-rest').innerHTML = RESTS.map(a=>actionCardHTML(a,'rest')).join('');
  // soft-lock guard: warn if every non-emergency action is blocked
  const anyNormal = TRAININGS.some(a=>!actionReason(a,'train'))
    || WORKS.some(a=>!actionReason(a,'work'))
    || RESTS.some(a=>!a.emergency && !actionReason(a,'rest'));
  const banner = document.getElementById('stuck-banner');
  if(banner) banner.style.display = anyNormal ? 'none' : 'flex';
}

function renderHeroCard(){
  document.getElementById('hero-pp').textContent = state.passPoints;
  document.getElementById('hero-str').textContent = '+'+totalStrBonus();
  const buffs = [];
  if(state.mutations.arms>0) buffs.push(`Руки ${state.mutations.arms}: +${(state.mutations.arms*5)}% EXP`);
  if(state.mutations.legs>0) buffs.push(`Ноги ${state.mutations.legs}: +${(state.mutations.legs*4)}% EXP`);
  if(state.mutations.back>0) buffs.push(`Спина ${state.mutations.back}: -${(state.mutations.back*8)}% затрат`);
  if(state.mutations.chest>0) buffs.push(`Грудь ${state.mutations.chest}: +${(state.mutations.chest*6)}% доход`);
  if(state.mutations.core>0) buffs.push(`Кор ${state.mutations.core}: -${(state.mutations.core*10)}% стресс`);
  if(state.mutations.mode>0) buffs.push(`Режим ${state.mutations.mode}: +${(state.mutations.mode*10)}% отдых`);
  document.getElementById('hero-buffs').innerHTML = buffs.length? buffs.map(b=>`<div>· ${b}</div>`).join('') : '—';
}

function renderVitals(){
  const g = function(id,v){ const e=document.getElementById(id); if(e) e.textContent = v; };
  g('v-age', state.age);
  g('v-hunger', Math.round(state.hunger));
  g('v-sleep', Math.round(state.sleepDebt));
  g('v-chan', Math.round(state.channel));
  g('v-str', state.attr.str);
  g('v-sta', state.attr.sta);
  g('v-cha', state.attr.cha);
  const sp = document.getElementById('v-sponsor');
  if(sp) sp.textContent = 'Спонсор: ' + (state.sponsor.active ? ('+'+Math.round(state.sponsor.bonus*100)+'% ('+state.sponsor.days+'д)') : 'нет');
  // studio + sponsor modal fields
  g('studio-lvl', state.studio);
  g('studio-cost', studioCost());
  const si = document.getElementById('sponsor-info');
  if(si) si.textContent = state.sponsor.active
    ? ('Активен: +'+Math.round(state.sponsor.bonus*100)+'% дохода, осталось '+state.sponsor.days+' дн.')
    : ('Нет активного контракта. Нужен канал ≥ 5 (сейчас '+Math.round(state.channel)+').');
}

function openStudio(){ renderVitals(); openModal('modal-studio'); }

/* ---- Consumables shop ---- */
function buyConsumable(id){
  const it = SHOP.find(function(s){ return s.id===id; });
  if(!it) return;
  if(state.money < it.cost){ toast('Нужно '+it.cost+' ₽','bad'); return; }
  state.money -= it.cost;
  it.apply();
  toast('Куплено: '+it.name,'good'); sfx('buy'); burstCenter('var(--cyan)');
  afterAction();
}
function openShop(){
  const wrap = document.getElementById('shop-list');
  if(wrap) wrap.innerHTML = SHOP.map(function(it){
    const can = state.money >= it.cost;
    return `<div class="glass rounded-xl p-3 flex items-center gap-3 ${can?'':'opacity-60'}">
      <div class="text-2xl text-cyan-300"><i class="fa-solid ${it.icon}"></i></div>
      <div class="flex-1">
        <div class="text-sm font-semibold">${it.name}</div>
        <div class="text-[11px] text-cyan-200/70">${it.desc}</div>
      </div>
      <button class="glass rounded-lg px-3 py-2 text-sm neon-text hover:bg-cyan-400/10" data-call="buyConsumable" data-args="${it.id}">${it.cost} ₽</button>
    </div>`;
  }).join('');
  openModal('modal-shop');
}

/* ---------------- Radial tree ---------------- */
function renderTree(){
  const svg = document.getElementById('tree-svg');
  const cx=500, cy=500;
  const N = BRANCHES.length;
  const TIER_BASE = 130, TIER_STEP = 80, NODE_R = 32, ROOT_R = 46;
  let html = '';
  // connector lines
  BRANCHES.forEach((br, idx)=>{
    const rad = idx*(2*Math.PI/N);
    const dirx = Math.cos(rad), diry = Math.sin(rad);
    MUT_TIERS.forEach((tier, i)=>{
      const r = TIER_BASE + i*TIER_STEP;
      const x = cx + dirx*r, y = cy + diry*r;
      const pr = (i===0)? 0 : TIER_BASE + (i-1)*TIER_STEP;
      const px = (i===0)? cx : cx + dirx*pr;
      const py = (i===0)? cy : cy + diry*pr;
      html += `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="${br.color}" stroke-width="4" opacity="0.45"/>`;
    });
  });
  // root
  html += `<circle cx="${cx}" cy="${cy}" r="${ROOT_R}" fill="rgba(0,243,255,0.15)" stroke="#00f3ff" stroke-width="4"/>`;
  html += `<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="#00f3ff" font-size="18" font-family="Orbitron" font-weight="700">CORE</text>`;
  html += `<text x="${cx}" y="${cy+18}" text-anchor="middle" fill="#bc13fe" font-size="14" font-family="Orbitron">LVL ${level()}</text>`;

  BRANCHES.forEach((br, idx)=>{
    const rad = idx*(2*Math.PI/N);
    const dirx = Math.cos(rad), diry = Math.sin(rad);
    MUT_TIERS.forEach((tier, i)=>{
      const r = TIER_BASE + i*TIER_STEP;
      const x = cx + dirx*r, y = cy + diry*r;
      const owned = state.mutations[br.key] > i;
      const fill = owned? br.color : 'rgba(13,20,40,0.85)';
      const stroke = owned? br.color : '#3a4a6a';
      html += `<g class="node ${owned?'owned':''}" data-branch="${br.key}" data-tier="${i}">`;
      html += `<circle cx="${x}" cy="${y}" r="${NODE_R}" fill="${fill}" stroke="${stroke}" stroke-width="4" opacity="${owned?0.95:1}"/>`;
      html += `<foreignObject x="${x-16}" y="${y-16}" width="32" height="32"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:22px;text-align:center;color:${owned?'#050914':'#9fd8ff'}"><i class="fa-solid ${br.icon}"></i></div></foreignObject>`;
      html += `</g>`;
    });
  });
  svg.innerHTML = html;

  // attach events
  svg.querySelectorAll('.node').forEach(node=>{
    node.addEventListener('mouseenter', e=>showTooltip(e, node));
    node.addEventListener('mousemove', e=>moveTooltip(e));
    node.addEventListener('mouseleave', hideTooltip);
    node.addEventListener('click', ()=>openMutationModal(node.dataset.branch, parseInt(node.dataset.tier)));
  });
}

function renderTreePoints(){
  const el = document.getElementById('tree-pp');
  if(el) el.textContent = state.passPoints;
}

function showTooltip(e, node){
  const br = BRANCHES.find(b=>b.key===node.dataset.branch);
  const tier = parseInt(node.dataset.tier);
  const owned = state.mutations[br.key] > tier;
  const isNext = state.mutations[br.key] === tier;
  const tt = document.getElementById('node-tooltip');
  tt.innerHTML = `<div class="font-display text-cyan-300 mb-1">${br.name} — Уровень ${tier+1}</div>
    <div class="text-cyan-200/80 mb-1">${br.effect}</div>
    <div class="text-xs text-cyan-300/60">Ветка: ${br.name}</div>
    <div class="text-xs">Стоимость: <span class="neon-purple">${MUT_TIERS[tier].cost}</span> очк.</div>
    <div class="text-xs mt-1">${owned?'<span class="text-green-400">Куплено</span>':(isNext?'<span class="text-yellow-300">Доступно к покупке</span>':'<span class="text-red-400">Заблокировано (купи предыдущее)</span>')}</div>`;
  tt.style.opacity = '1';
  moveTooltip(e);
}
function moveTooltip(e){
  const tt = document.getElementById('node-tooltip');
  tt.style.left = e.clientX+'px';
  tt.style.top = (e.clientY-14)+'px';
  tt.style.transform = 'translate(-50%,-100%)';
}
function hideTooltip(){ document.getElementById('node-tooltip').style.opacity='0'; }

let mutTarget = null;
function openMutationModal(branchKey, tier){
  const br = BRANCHES.find(b=>b.key===branchKey);
  const owned = state.mutations[branchKey] > tier;
  const isNext = state.mutations[branchKey] === tier;
  mutTarget = { branchKey, tier };
  document.getElementById('mut-icon').innerHTML = `<i class="fa-solid ${br.icon}"></i>`;
  document.getElementById('mut-name').textContent = br.name;
  document.getElementById('mut-tier').textContent = 'Уровень '+(tier+1)+' / '+MUT_TIERS.length;
  document.getElementById('mut-effect').textContent = br.effect;
  document.getElementById('mut-cost').textContent = MUT_TIERS[tier].cost;
  const btn = document.getElementById('mut-buy');
  if(owned){ btn.textContent='Уже куплено'; btn.disabled=true; btn.style.opacity=0.5; }
  else if(!isNext){ btn.textContent='Сначала купи предыдущий'; btn.disabled=true; btn.style.opacity=0.5; }
  else { btn.textContent='Купить ('+MUT_TIERS[tier].cost+' очк.)'; btn.disabled=false; btn.style.opacity=1; }
  openModal('modal-mutation');
}
function buyMutation(){
  if(!mutTarget) return;
  const { branchKey, tier } = mutTarget;
  if(state.mutations[branchKey] !== tier){ return; }
  if(state.passPoints < MUT_TIERS[tier].cost){ toast('Недостаточно очков пассивок!','bad'); return; }
  state.passPoints -= MUT_TIERS[tier].cost;
  state.mutations[branchKey] += 1;
  state.daily.mut++;
  toast('Мутация куплена: '+BRANCHES.find(b=>b.key===branchKey).name+' ур.'+(tier+1),'good');
  sfx('buy');
  if(window.burstCenter) burstCenter('var(--purple)');
  closeModal('modal-mutation');
  checkAchievements();
  renderAll();
  saveGame();
}

/* ---------------- Inventory ---------------- */
function renderInventory(){
  const wrap = document.getElementById('equip-slots');
  wrap.innerHTML = Object.keys(SLOT_META).map(slot=>{
    const it = state.equipped[slot];
    if(it){
      return `<div class="slot filled" title="${it.name}" data-call="unequip" data-args="${slot}">
        <div class="text-2xl text-cyan-300">${itemImg(it)}</div>
        <div class="text-[10px] mt-1 text-center leading-tight">${it.name}</div>
      </div>`;
    }
    return `<div class="slot" title="${SLOT_META[slot].name}">
      <div class="text-2xl text-cyan-300/40"><i class="fa-solid ${SLOT_META[slot].icon}"></i></div>
      <div class="text-[10px] mt-1 text-cyan-300/50">${SLOT_META[slot].name}</div>
    </div>`;
  }).join('');

  // bonus summary
  const bonuses = [];
  for(const k in state.equipped){
    const it = state.equipped[k];
    if(!it) continue;
    if(it.exp) bonuses.push(`${SLOT_META[k].name}: +${it.exp} EXP`);
    if(it.moodReduce) bonuses.push(`${SLOT_META[k].name}: -${Math.round(it.moodReduce*100)}% стресс`);
    if(it.hpReduce) bonuses.push(`${SLOT_META[k].name}: -${Math.round(it.hpReduce*100)}% HP урон`);
    if(it.energyReduce) bonuses.push(`${SLOT_META[k].name}: -${Math.round(it.energyReduce*100)}% Энергия`);
    if(it.money) bonuses.push(`${SLOT_META[k].name}: +${it.money} ₽`);
  }
  document.getElementById('equip-bonus').innerHTML = bonuses.length? bonuses.map(b=>`<div>· ${b}</div>`).join('') : '—';

  // bag
  const grid = document.getElementById('inv-grid');
  const empty = document.getElementById('inv-empty');
  if(state.inventory.length===0){ grid.innerHTML=''; empty.style.display='block'; }
  else {
    empty.style.display='none';
    grid.innerHTML = state.inventory.map((it,idx)=>{
      const equippedHere = Object.values(state.equipped).includes(it);
      return `<div class="inv-cell rarity-${it.rarity} ${equippedHere?'opacity-60':''}" data-call="equipItem" data-args="${idx}" title="${it.name}">
        <div class="text-xl">${itemImg(it)}</div>
        <div class="mt-1 leading-tight">${it.name}</div>
        <div class="text-[9px] text-cyan-300/60">${equippedHere?'надето':SLOT_META[it.slot].name}</div>
      </div>`;
    }).join('');
  }
}
function equipItem(idx){
  const it = state.inventory[idx];
  if(!it) return;
  if(state.equipped[it.slot]){
    // swap: put current back to bag
    state.inventory.push(state.equipped[it.slot]);
  }
  state.equipped[it.slot] = it;
  state.inventory.splice(idx,1);
  toast('Надето: '+it.name,'good');
  renderAll();
  saveGame();
}
function unequip(slot){
  const it = state.equipped[slot];
  if(!it) return;
  state.inventory.push(it);
  state.equipped[slot] = null;
  toast('Снято: '+it.name);
  renderAll();
  saveGame();
}

/* ---------------- Lootboxes ---------------- */
function rollItem(poolKey){
  const pool = ITEM_POOL[poolKey];
  const total = pool.reduce((s,i)=>s+i.w,0);
  let r = Math.random()*total;
  for(const it of pool){ r -= it.w; if(r<=0) return it; }
  return pool[pool.length-1];
}
function openLoot(box){
  const price = box==='simple'?300:(box==='elite'?1000:3500);
  if(state.money < price){ toast('Недостаточно ₽ для открытия!','bad'); return; }
  state.money -= price;
  state.stats.loot++;
  state.weekly.loot++;
  state.daily.loot++;
  const resultEl = document.getElementById('loot-result');
  const animEl = document.getElementById('loot-anim');
  resultEl.classList.remove('hidden');
  animEl.classList.add('shake');
  document.getElementById('loot-item').innerHTML = '<span class="text-cyan-300/50 text-lg">Открываем...</span>';
  document.getElementById('loot-item-desc').textContent = '';
  setTimeout(()=>{
    animEl.classList.remove('shake');
    const item = rollItem(box);
    const rarityName = {common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'}[item.rarity];
    document.getElementById('loot-item').innerHTML = `<span class="rarity-${item.rarity}">${itemImg(item,'big')} ${item.name}</span>`;
    document.getElementById('loot-item-desc').innerHTML = `${rarityName} · ${SLOT_META[item.slot].name}<br>${describeItem(item)}`;
    state.inventory.push(Object.assign({}, item));
    sfx('loot');
    if(window.burstCenter) burstCenter('var(--cyan)');
    if(item.rarity==='legendary') rollGlyphChance();
    renderAll();
    saveGame();
  }, 1000);
}
function describeItem(it){
  const parts=[];
  if(it.exp) parts.push('+'+it.exp+' EXP');
  if(it.moodReduce) parts.push('-'+Math.round(it.moodReduce*100)+'% стресс');
  if(it.hpReduce) parts.push('-'+Math.round(it.hpReduce*100)+'% HP урон');
  if(it.energyReduce) parts.push('-'+Math.round(it.energyReduce*100)+'% Энергия');
  if(it.money) parts.push('+'+it.money+' ₽');
  return parts.join(' · ');
}
function openLootContent(box){
  const titleMap = {simple:'Простой Сундук — 300 ₽', elite:'Элитный Сундук — 1000 ₽', legendary:'Легендарный Сундук — 3500 ₽'};
  const pool = ITEM_POOL[box];
  const total = pool.reduce((s,i)=>s+i.w,0);
  document.getElementById('lootcontent-title').textContent = titleMap[box];
  document.getElementById('lootcontent-list').innerHTML = pool.map(it=>{
    const chance = (it.w/total*100).toFixed(1);
    return `<div class="glass rounded-lg p-2 flex items-center gap-3">
      <div class="text-2xl rarity-${it.rarity}">${itemImg(it)}</div>
      <div class="flex-1">
        <div class="text-sm font-semibold rarity-${it.rarity}">${it.name}</div>
        <div class="text-[11px] text-cyan-300/60">${SLOT_META[it.slot].name} · ${describeItem(it)}</div>
      </div>
      <div class="text-sm neon-purple font-display">${chance}%</div>
    </div>`;
  }).join('');
  openModal('modal-lootcontent');
}

/* =========================================================
   GAME OVER / RESET
   ========================================================= */
let gameOverActive = false;
function triggerGameOver(reason){
  if(gameOverActive) return;
  gameOverActive = true;
  recordRun();
  document.getElementById('gameover-reason').textContent = reason;
  openModal('modal-gameover');
}
function resetGame(){
  const prof = state.profile;
  state = makeDefaultState();
  state.profile = prof;
  gameOverActive = false;
  lastStageMin = currentStage().min;
  closeModal('modal-gameover');
  switchTab('actions');
  renderAll();
  saveGame();
  toast('Новая жизнь началась. 61 кг, Level 1.','good');
}

/* =========================================================
   UI HELPERS
   ========================================================= */
let currentTab = 'actions';
function switchTab(tab){
  if(currentTab === tab) return; /* already active — no re-render, no flicker */
  currentTab = tab;
  sfx('click');
  document.querySelectorAll('main > section[id^="tab-"]').forEach(sec=>{
    sec.classList.add('hidden');
    sec.classList.remove('tab-in');
  });
  const target = document.getElementById('tab-'+tab);
  target.classList.remove('hidden');
  void target.offsetWidth;
  target.classList.add('tab-in');
  document.querySelectorAll('.side-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  if(tab==='tree') renderTree();
  if(tab==='inv') renderInventory();
}
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
/* wrappers for delegated compound actions */
function hideLootResult(){ const el = document.getElementById('loot-result'); if(el) el.classList.add('hidden'); }
function wipeFromCabinet(){ wipeProgress(); closeModal('modal-cabinet'); }
function closeModalSelf(id){ closeModal(id); }
function toast(msg, type){
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast '+(type||'');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 2600);
}

/* =========================================================
   SAVE / LOAD  (browser database = localStorage)
   Survives code edits & reloads; state structure is backward
   compatible, so new code keeps old progress.
   ========================================================= */
const SAVE_KEY = 'bioarpg_save_v1';

/* deep-merge a (possibly partial / outdated) save onto defaults.
   Arrays and primitives are taken from the patch when present. */
function deepMerge(base, patch){
  if(Array.isArray(base) || Array.isArray(patch)) return patch !== undefined ? patch : base;
  if(base !== null && typeof base === 'object' && patch !== null && typeof patch === 'object'){
    const out = Object.assign({}, base);
    for(const k of Object.keys(patch)) out[k] = deepMerge(base[k], patch[k]);
    return out;
  }
  return patch === undefined ? base : patch;
}
function saveGame(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v:1, state:state }));
    flashSave();
  }catch(e){ /* storage unavailable (private mode, etc.) */ }
}
function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || !data.state) return false;
    /* generic migration: start from defaults and deep-merge the save over
       them, so fields added in newer versions always exist */
    state = deepMerge(makeDefaultState(), data.state);
    weeklyInit();
    return true;
  }catch(e){ return false; }
}
function wipeProgress(){
  if(!confirm('Стереть ВЕСЬ прогресс и начать заново? Это действие необратимо.')) return;
  const prof = state.profile;
  state = makeDefaultState();
  state.profile = prof;
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  lastStageMin = currentStage().min;
  switchTab('actions');
  renderAll();
  saveGame();
  toast('Прогресс сброшен.','good');
}
function flashSave(){
  const el = document.getElementById('save-dot');
  if(!el) return;
  el.style.opacity = '1';
  clearTimeout(flashSave._t);
  flashSave._t = setTimeout(()=>{ el.style.opacity = '0'; }, 1100);
}

/* =========================================================
   PERSONAL CABINET (start screen + profile)
   ========================================================= */
let cabAvatar = 'fa-user-astronaut';
let cabColor = '#00f3ff';
let cabClass = 'body';
let cabNiche = '';

function buildStartPickers(){
  const ag = document.getElementById('avatar-grid');
  const cr = document.getElementById('color-row');
  const cg = document.getElementById('class-grid');
  const ng = document.getElementById('niche-grid');
  if(ag) ag.innerHTML = AVATARS.map(a=>`<div class="avatar-opt ${a===cabAvatar?'sel':''}" data-call="pickAvatar" data-args="${a}"><i class="fa-solid ${a}"></i></div>`).join('');
  if(cr) cr.innerHTML = CAB_COLORS.map(c=>`<div class="color-dot ${c===cabColor?'sel':''}" style="background:${c};color:${c}" data-call="pickColor" data-args="${c}"></div>`).join('');
  if(cg) cg.innerHTML = CLASSES.map(c=>`<div class="class-opt ${c.id===cabClass?'sel':''}" data-call="pickClass" data-args="${c.id}"><div class="text-2xl" style="color:${c.color}"><i class="fa-solid ${c.icon}"></i></div><div class="text-[11px] mt-1 leading-tight">${c.name}</div><div class="text-[10px] text-cyan-300/60">${c.desc}</div></div>`).join('');
  if(ng) ng.innerHTML = NICHES.map(c=>`<div class="class-opt ${c.id===cabNiche?'sel':''}" data-call="pickNiche" data-args="${c.id}"><div class="text-2xl" style="color:${c.color}"><i class="fa-solid ${c.icon}"></i></div><div class="text-[11px] mt-1 leading-tight">${c.name}</div><div class="text-[10px] text-cyan-300/60">${c.desc}</div></div>`).join('');
}
function pickAvatar(a){ cabAvatar=a; buildStartPickers(); }
function pickColor(c){ cabColor=c; buildStartPickers(); }
function pickClass(c){ cabClass=c; buildStartPickers(); }
function pickNiche(c){ cabNiche=c; buildStartPickers(); }

function showStartScreen(){
  const s = document.getElementById('screen-start');
  if(!s) return;
  const saved = state.profile || {};
  cabAvatar = saved.avatar || 'fa-user-astronaut';
  cabColor = saved.color || '#00f3ff';
  cabClass = saved.class || 'body';
  cabNiche = state.niche || '';
  const inp = document.getElementById('start-name');
  if(inp){ inp.value = saved.name || ''; inp.placeholder = 'например, IronStreamer'; }
  buildStartPickers();
  s.classList.remove('hidden');
}
function hideStartScreen(){ const s=document.getElementById('screen-start'); if(s) s.classList.add('hidden'); }

function submitProfile(){
  const inp = document.getElementById('start-name');
  const name = (inp && inp.value || '').trim();
  if(!name){ toast('Введите позывной!','bad'); if(inp) inp.focus(); return; }
  const diffEl = document.getElementById('start-difficulty');
  state.difficulty = (diffEl && diffEl.value) || 'normal';
  state.niche = cabNiche;
  state.profile = { name, avatar:cabAvatar, color:cabColor, class:cabClass };
  if(cabClass==='sci'){ state.passPoints += 2; }
  if(cabClass==='monk'){ state.mood = 100; }
  state.money += metaUp('m_capital')*1000;
  state.passPoints += metaUp('m_pp');
  if(metaUp('m_starter')){ state.inventory.push(rollItem('elite')); toast('Сундук новичка: редкий предмет в сумке!','good'); }
  hideStartScreen();
  renderAll();
  saveGame();
  toast('Добро пожаловать, '+name+'! Класс: '+(CLASSES.find(c=>c.id===cabClass)||{}).name,'good');
  if(!state.tutorialDone) showTutorial();
}

function renderCallsign(){
  const tag = document.getElementById('callsign-tag');
  if(tag) tag.textContent = '@' + (state.profile.name || 'стример');
  const av = document.getElementById('cab-avatar');
  if(av) av.style.color = state.profile.color;
}

function openCabinet(){ renderCabinet(); openModal('modal-cabinet'); }
function renderCabinet(){
  const p = state.profile;
  const av = document.getElementById('cab-avatar');
  if(av){ av.style.color = p.color; av.innerHTML = `<i class="fa-solid ${p.avatar}"></i>`; }
  const nm = document.getElementById('cab-name');
  if(nm) nm.textContent = '@'+(p.name||'стример');
  const fm = document.getElementById('cab-form');
  if(fm) fm.textContent = currentStage().label + ' · Уровень '+level();
  const inp = document.getElementById('cab-name-input');
  if(inp) inp.value = p.name || '';
  const st = document.getElementById('cab-stats');
  if(st){
    const rows = [
      ['Уровень', level()],
      ['Форма', currentStage().label],
      ['Всего EXP', Math.floor(state.exp)],
      ['Финансы', Math.floor(state.money)+' ₽'],
      ['Очки пассивок', state.passPoints],
      ['Мета-уровень', (state.meta?state.meta.level:0)+' (+'+((state.meta?state.meta.points:0)*2)+'% к EXP/₽)'],
      ['Клан', state.clan ? ('«'+state.clan+'» (+5% доход)') : 'нет'],
      ['Куплено мутаций', Object.values(state.mutations).reduce((a,b)=>a+b,0)]
    ];
     st.innerHTML = rows.map(r=>`<div class="cab-stat"><span>${r[0]}</span><span>${esc(r[1])}</span></div>`).join('');
  }
  const gl = document.getElementById('cab-glyphs');
  if(gl){
    gl.innerHTML = state.glyphs.length
      ? state.glyphs.map(g=>`<div class="cab-stat"><span>🔮 ${g.name}</span><span>${g.desc}</span></div>`).join('')
      : '<div class="text-cyan-300/60 text-sm">Глифов пока нет. Открывай легендарные сундуки.</div>';
  }
}
function saveCabinetName(){
  const inp = document.getElementById('cab-name-input');
  const name = (inp && inp.value || '').trim();
  if(!name){ toast('Введите позывной!','bad'); return; }
  state.profile.name = name;
  renderAll();
  saveGame();
  toast('Позывной обновлён.','good');
}

/* =========================================================
   MODERNIZATION: themes, sound, particles, achievements, events, tutorial
   ========================================================= */
let themeIdx = 0;
function applyTheme(i){
  themeIdx = ((i%THEMES.length)+THEMES.length)%THEMES.length;
  const t = THEMES[themeIdx];
  document.documentElement.style.setProperty('--cyan', t.cyan);
  document.documentElement.style.setProperty('--purple', t.purple);
  try{ localStorage.setItem('bioarpg_theme', String(themeIdx)); }catch(e){}
}
function cycleTheme(){
  applyTheme(themeIdx+1);
  /* soundtrack follows the visual theme (only if music is actually playing) */
  if(Music.isPlaying()){
    const name = Music.playIndex(themeIdx % MUSIC_TRACKS.length);
    toast('Тема: '+THEMES[themeIdx].name+' · Трек: '+name,'good');
  } else {
    toast('Тема: '+THEMES[themeIdx].name,'good');
  }
  sfx('click');
}

/* ---- Sound (WebAudio) ---- */
let soundOn = false;
let audioCtx = null;
let sfxGain = null;
let sfxVolume = parseFloat(localStorage.getItem('bioarpg_vol_sfx'));
if(isNaN(sfxVolume)) sfxVolume = 1;
function ensureAudio(){
  if(!audioCtx){
    try{
      audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = sfxVolume;
      sfxGain.connect(audioCtx.destination);
    }catch(e){}
  }
  return audioCtx;
}
function setSfxVolume(v){
  sfxVolume = v;
  try{ localStorage.setItem('bioarpg_vol_sfx', String(v)); }catch(e){}
  if(sfxGain) sfxGain.gain.value = v;
}
function sfx(type){
  if(!soundOn) return;
  const ctx = ensureAudio(); if(!ctx) return;
  const map = { click:[440,0.05], buy:[680,0.09], level:[880,0.20], loot:[520,0.12,'up'], error:[150,0.18],
                event:[590,0.16,'up'], duel_win:[660,0.22,'up'], duel_lose:[180,0.22], ach:[740,0.18,'up'], weekly:[830,0.20,'up'] };
  const cfg = map[type]||map.click;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = (type==='error')?'sawtooth':'triangle';
  o.frequency.value = cfg[0];
  if(cfg[2]==='up'){ o.frequency.exponentialRampToValueAtTime(cfg[0]*2, ctx.currentTime+0.12); }
  g.gain.value = 0.06;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+cfg[1]);
  o.connect(g); g.connect(sfxGain||ctx.destination);
  o.start(); o.stop(ctx.currentTime+cfg[1]);
}
function toggleSound(){
  soundOn = !soundOn;
  const btn = document.getElementById('sound-btn');
  if(btn){ btn.innerHTML = soundOn ? '<i class="fa-solid fa-volume-high"></i><span>Звук</span>' : '<i class="fa-solid fa-volume-xmark"></i><span>Звук</span>'; }
  try{ localStorage.setItem('bioarpg_sound', soundOn?'1':'0'); }catch(e){}
  if(soundOn){ ensureAudio(); sfx('buy'); }
}

/* ---- Particles ---- */
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function burst(x, y, color, n){
  if(REDUCED_MOTION) return;
  n = n||18;
  for(let i=0;i<n;i++){
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = x+'px'; p.style.top = y+'px';
    p.style.background = color || 'var(--cyan)';
    document.body.appendChild(p);
    const ang = Math.random()*Math.PI*2, dist = 40+Math.random()*90;
    const dx = Math.cos(ang)*dist, dy = Math.sin(ang)*dist;
    p.animate([
      { transform:'translate(0,0) scale(1)', opacity:1 },
      { transform:'translate('+dx+'px,'+dy+'px) scale(0)', opacity:0 }
    ], { duration:600+Math.random()*400, easing:'cubic-bezier(.2,.7,.3,1)' }).onfinish = function(){ p.remove(); };
  }
}
function burstAtEl(el, color){
  if(!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left+r.width/2, r.top+r.height/2, color);
}
function burstCenter(color){ burst(window.innerWidth/2, window.innerHeight/2, color, 26); }

/* ---- Live counting numbers ---- */
const _numPrev = {};
function setNum(id, val, suffix){
  const el = document.getElementById(id); if(!el) return;
  const from = (_numPrev[id]===undefined)? val : _numPrev[id];
  _numPrev[id] = val;
  const start = performance.now(), dur = 500;
  function step(t){
    const k = Math.min(1,(t-start)/dur);
    const e = 1-Math.pow(1-k,3);
    el.textContent = Math.round(from + (val-from)*e) + (suffix||'');
    if(k<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---- Achievements ---- */
function checkAchievements(){
  if(!state.achievements) state.achievements = {};
  ACHIEVEMENTS.forEach(a=>{
    if(!state.achievements[a.id] && a.check()){
      state.achievements[a.id] = true;
      state.passPoints += 1;
      toast('🏆 Ачивка: '+a.name+' (+1 пассивка)','good');
      sfx('ach');
      burstAtEl(document.getElementById('callsign-tag'), 'var(--purple)');
      if(a.id==='form110') recordRun();
    }
  });
}
function openAchievements(){
  const wrap = document.getElementById('ach-list');
  if(!wrap) return;
  wrap.innerHTML = ACHIEVEMENTS.map(a=>{
    const done = state.achievements && state.achievements[a.id];
    return '<div class="ach-card '+(done?'done':'')+'"><div class="ach-ic"><i class="fa-solid '+a.icon+'"></i></div><div><div class="font-semibold '+(done?'text-white':'text-cyan-300/60')+'">'+a.name+'</div><div class="text-[11px] text-cyan-300/60">'+a.desc+'</div></div></div>';
  }).join('');
  openModal('modal-achievements');
}

/* ---- Random events ---- */
let eventTimer = null;
function triggerEvent(){
  const ev = EVENTS[Math.floor(Math.random()*EVENTS.length)];
  document.getElementById('ev-icon').innerHTML = '<i class="fa-solid '+ev.icon+'"></i>';
  document.getElementById('ev-title').textContent = ev.title;
  document.getElementById('ev-desc').textContent = ev.desc;
  document.getElementById('ev-choices').innerHTML = ev.choices.map(function(c,i){ return '<button class="ev-choice" data-call="resolveEvent" data-args="'+i+'">'+c.label+'</button>'; }).join('');
  window._curEvent = ev;
  openModal('modal-event');
  sfx('event');
}
function resolveEvent(i){
  const ev = window._curEvent; if(!ev) return;
  const msg = ev.choices[i].act();
  closeModal('modal-event');
  toast(msg,'good'); sfx('loot');
  afterAction();
}
function startEvents(){
  if(eventTimer) return;
  eventTimer = setInterval(function(){
    const st = document.getElementById('screen-start'), tut = document.getElementById('screen-tutorial');
    if((st && !st.classList.contains('hidden')) || (tut && !tut.classList.contains('hidden'))) return;
    if(document.querySelector('.modal-backdrop.show')) return;
    if(Math.random()<0.5) triggerEvent();
  }, 50000);
}

/* ---- Tutorial ---- */
let tutIdx = 0;
function showTutorial(){ tutIdx = 0; renderTut(); const s = document.getElementById('screen-tutorial'); if(s) s.classList.remove('hidden'); }
function renderTut(){
  const step = TUT_STEPS[tutIdx];
  document.getElementById('tut-step-label').textContent = 'Обучение '+(tutIdx+1)+' / '+TUT_STEPS.length;
  document.getElementById('tut-title').textContent = step.title;
  document.getElementById('tut-body').textContent = step.body;
  document.getElementById('tut-dots').innerHTML = TUT_STEPS.map(function(_,i){ return '<div class="tut-dot '+(i===tutIdx?'active':'')+'"></div>'; }).join('');
  document.getElementById('tut-next').textContent = (tutIdx===TUT_STEPS.length-1)?'Начать!':'Далее';
  sfx('click');
}
function tutNext(){ if(tutIdx < TUT_STEPS.length-1){ tutIdx++; renderTut(); } else closeTutorial(true); }
function closeTutorial(){ const s = document.getElementById('screen-tutorial'); if(s) s.classList.add('hidden'); state.tutorialDone = true; saveGame(); }

/* =========================================================
   MORE: classes, streak, daily quests, pet, chat, donations,
         leaderboard, stats graph, export/import, crafting
   ========================================================= */
function classExpMult(){ return state.profile.class==='body' ? 1.12 : 1; }
function classIncomeMult(){ return state.profile.class==='streamer' ? 1.18 : 1; }
function nicheExpMult(){ return state.niche==='fit' ? 1.10 : 1; }
function nicheIncMult(){ return state.niche==='irl' ? 1.12 : 1; }
function nicheStaMult(){ return state.niche==='esports' ? 0.92 : 1; }
function nicheRecMult(){ return state.niche==='asmr' ? 1.10 : 1; }
function metaMult(){ return 1 + (state.meta?state.meta.level:0)*0.02; }
function metaUp(id){
  return (state.meta && state.meta.up && state.meta.up[id]) || 0;
}
function clanMult(){ return state.clan ? 1.05 : 1; }
function petIncomeMult(){ return 1 + (state.pet?state.pet.level:1)*0.03; }
function petRecMult(){ return 1 + (state.pet?(state.pet.level-1):0)*0.03; }
function streakMult(){ return 1 + Math.min(state.streak.count||0, 7)*(0.05 + 0.01*metaUp('m_streak')); }
function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

function ensureDaily(){ if(state.daily.date !== todayStr()){ state.daily = { date:todayStr(), train:0, earn:0, loot:0, mut:0, claimed:false, slept:false, trainById:{} }; } }
function dailyQuests(){
  return [
    { label:'Тренировок сегодня: '+state.daily.train+' / 3', done: state.daily.train>=3 },
    { label:'Заработано сегодня: '+state.daily.earn+' / 800 ₽', done: state.daily.earn>=800 },
    { label:'Лутбоксов сегодня: '+state.daily.loot+' / 2', done: state.daily.loot>=2 },
    { label:'Мутаций сегодня: '+state.daily.mut+' / 2', done: state.daily.mut>=2 }
  ];
}
function checkDaily(){
  ensureDaily();
  const qs = dailyQuests();
  if(!state.daily.claimed && qs.every(q=>q.done)){
    state.daily.claimed = true;
    state.passPoints += 2;
    state.exp += 250;
    state.money += 300;
    toast('🎯 Ежедневные задания выполнены! +2 пассивки, +250 EXP, +300 ₽','good');
    sfx('level'); burstCenter('var(--purple)');
    renderAll();
  }
}
function bumpStreak(){
  const t = todayStr();
  if(state.streak.lastDate === t) return;
  const y = new Date(); y.setDate(y.getDate()-1);
  const yStr = y.getFullYear()+'-'+(y.getMonth()+1)+'-'+y.getDate();
  state.streak.count = (state.streak.lastDate === yStr? (state.streak.count+1) : 1);
  state.streak.lastDate = t;
  // new-day survival effects
  state.hunger = clamp(state.hunger - Math.round(30*diffDecay()));
  state.sleepDebt = clamp(state.sleepDebt + (state.daily.slept ? -30 : 30));
  state.age += 1;
  tickSponsorDaily();
  if(state.hunger<=0){ state.hp = clamp(state.hp - 10); }
}

/* ---- Fan pet (subscriber) ---- */
function petExpGain(n){
  if(!state.pet) return;
  state.pet.exp += n;
  const need = state.pet.level*100;
  while(state.pet.exp >= need){
    state.pet.exp -= need;
    state.pet.level++;
    toast('🐣 Фан-питомец вырос до ур.'+state.pet.level+'!','good');
    sfx('level');
  }
}

/* ---- Chat feed ---- */
function pushChat(text){
  const feed = document.getElementById('chat-feed');
  if(!feed) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.textContent = text;
  feed.appendChild(div);
  while(feed.children.length>40) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;
}
function autoChat(){ pushChat(CHAT_LINES[Math.floor(Math.random()*CHAT_LINES.length)].replace('{n}', state.profile.name||'стример')); }
setInterval(autoChat, 7000);

/* ---- Donation alert ---- */
function maybeDonate(){
  if(Math.random()<0.35){
    const amt = [20,50,100,250][Math.floor(Math.random()*4)];
    state.money += amt;
    toast('💸 Донат '+amt+' ₽ от фана!','good');
    sfx('loot');
  }
}

/* ---- Leaderboard (local best runs) ---- */
const LB_KEY = 'bioarpg_leaderboard';
function recordRun(){
  try{
    const lb = JSON.parse(localStorage.getItem(LB_KEY)||'[]');
    lb.push({ name: state.profile.name||'стример', exp: Math.floor(state.exp), lvl: level(), kg: (currentStage().label.split(' ')[0]||'61'), date: todayStr() });
    lb.sort((a,b)=>b.exp-a.exp);
    localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0,10)));
  }catch(e){}
}
function openLeaderboard(){
  const wrap = document.getElementById('lb-list');
  if(!wrap) return;
  let lb=[]; try{ lb = JSON.parse(localStorage.getItem(LB_KEY)||'[]'); }catch(e){}
  if(!lb.length){ seedBots(); try{ lb = JSON.parse(localStorage.getItem(LB_KEY)||'[]'); }catch(e){} }
  if(!lb.length){ wrap.innerHTML = '<p class="text-cyan-300/60 text-sm">Пока нет записей. Умри или достигни 110 кг, чтобы попасть в топ!</p>'; }
  else wrap.innerHTML = lb.map(function(r,i){ return '<div class="cab-stat"><span>#'+(i+1)+' '+esc(r.name)+' · '+esc(r.kg)+' · ур.'+r.lvl+'</span><span>'+r.exp+' EXP</span></div>'; }).join('');
  openModal('modal-leaderboard');
}

/* ---- Stats + history graph ---- */
function recordHistory(){
  if(!state.history) state.history = { exp:[0], weight:[61] };
  state.history.exp.push(Math.floor(state.exp));
  const kg = parseInt(currentStage().label);
  state.history.weight.push(isNaN(kg)?61:kg);
  if(state.history.exp.length>60){ state.history.exp.shift(); state.history.weight.shift(); }
}
function sparkline(arr, color){
  if(!arr || !arr.length) return '';
  const w=260,h=70,max=Math.max.apply(null,arr),min=Math.min.apply(null,arr),rng=(max-min)||1;
  const pts = arr.map(function(v,i){ const x=(i/(arr.length-1))*w; const y=h-((v-min)/rng)*(h-8)-4; return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1); }).join(' ');
  return '<svg viewBox="0 0 '+w+' '+h+'" class="w-full"><path d="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2"/></svg>';
}
function openStats(){
  recordHistory(); saveGame();
  document.getElementById('stat-spark-exp').innerHTML = sparkline(state.history.exp, '#00f3ff');
  document.getElementById('stat-spark-w').innerHTML = sparkline(state.history.weight, '#bc13fe');
  const rows = [
    ['Всего тренировок', state.stats.train],
    ['Всего работ', state.stats.work],
    ['Всего отдыхов', state.stats.rest],
    ['Лутбоксов открыто', state.stats.loot],
    ['Куплено мутаций', Object.values(state.mutations).reduce((a,b)=>a+b,0)],
    ['Серия дней', state.streak.count],
    ['Уровень фан-питомца', state.pet.level]
  ];
  document.getElementById('stat-rows').innerHTML = rows.map(function(r){ return '<div class="cab-stat"><span>'+r[0]+'</span><span>'+r[1]+'</span></div>'; }).join('');
  openModal('modal-stats');
}

/* ---- Export / Import ---- */
function exportSave(){
  try{
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(code).then(function(){ toast('Код сохранения скопирован в буфер','good'); }, function(){ prompt('Скопируй код:', code); }); }
    else { prompt('Скопируй код:', code); }
  }catch(e){ toast('Не удалось экспортировать','bad'); }
}
function importSave(){
  const code = prompt('Вставь код сохранения:');
  if(!code) return;
  try{
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    state = Object.assign(makeDefaultState(), obj);
    state.mutations = Object.assign({arms:0,back:0,chest:0,legs:0,core:0,mode:0,mind:0,skin:0,spirit:0}, obj.mutations||{});
    state.equipped = Object.assign({helmet:null,torso:null,gloves:null,boots:null,artifact:null}, obj.equipped||{});
    state.profile = Object.assign({name:'',avatar:'fa-user-astronaut',color:'#00f3ff',class:''}, obj.profile||{});
    state.stats = Object.assign({train:0,work:0,rest:0,loot:0}, obj.stats||{});
    state.achievements = obj.achievements||{};
    lastStageMin = currentStage().min;
    renderAll(); saveGame();
    toast('Прогресс загружен из кода!','good');
  }catch(e){ toast('Неверный код сохранения','bad'); }
}

/* ---- Crafting (merge two same-slot items) ---- */
function craftItems(){
  const bySlot = {};
  state.inventory.forEach(function(it,i){ (bySlot[it.slot]=bySlot[it.slot]||[]).push({it:it,i:i}); });
  for(const slot in bySlot){
    const arr = bySlot[slot].filter(function(o){ return RARITY_ORDER.indexOf(o.it.rarity) < RARITY_ORDER.length-1; });
    if(arr.length>=2){
      arr.sort(function(a,b){ return RARITY_ORDER.indexOf(a.it.rarity)-RARITY_ORDER.indexOf(b.it.rarity); });
      const a = arr[0], b = arr[1];
      const newR = RARITY_ORDER[RARITY_ORDER.indexOf(a.it.rarity)+1];
      const merged = Object.assign({}, a.it);
      merged.rarity = newR;
      merged.name = 'Улучшенный '+a.it.name;
      if(merged.exp) merged.exp = Math.round(merged.exp*1.6);
      if(merged.money) merged.money = Math.round(merged.money*1.6);
      if(merged.moodReduce) merged.moodReduce = Math.min(0.6, merged.moodReduce*1.4);
      if(merged.hpReduce) merged.hpReduce = Math.min(0.6, merged.hpReduce*1.4);
      if(merged.energyReduce) merged.energyReduce = Math.min(0.6, merged.energyReduce*1.4);
      const idxs = [a.i, b.i].sort(function(x,y){ return y-x; });
      state.inventory.splice(idxs[0],1); state.inventory.splice(idxs[1],1);
      state.inventory.push(merged);
      toast('⚒ Скрафчено: '+merged.name+' ('+newR+')','good');
      sfx('buy'); burstCenter('var(--cyan)');
      renderInventory(); saveGame();
      return;
    }
  }
  toast('Нужно минимум 2 предмета одного слота (не легендарных)','bad');
}

/* =========================================================
   FEATURES 2: age, hunger/sleep, attributes, channel,
   studio, sponsor, glyphs, difficulty, endings, bots
   ========================================================= */
function diffExp(){ return (DIFFS[state.difficulty]||DIFFS.normal).exp; }
function diffDecay(){ return (DIFFS[state.difficulty]||DIFFS.normal).decay; }
function diffInc(){ return (DIFFS[state.difficulty]||DIFFS.normal).inc; }
function ageFactor(){ return Math.max(0.6, 1 - Math.max(0, state.age-20)*0.012); }
function glyphBonus(stat){ return state.glyphs.reduce(function(s,g){ return s + (g[stat]||0); }, 0); }
function viewers(){ return Math.floor(state.channel * (8 + state.attr.cha*0.2) * (0.9 + Math.random()*0.2)); }

function studioCost(){ return 500 * (state.studio+1); }
function buyStudio(){
  const c = studioCost();
  if(state.money < c){ toast('Нужно '+c+' ₽ для апгрейда студии','bad'); return; }
  state.money -= c; state.studio++;
  toast('Студия ур.'+state.studio+'! Дешевле тренировки, больше доход.','good');
  sfx('buy'); burstCenter('var(--cyan)'); renderAll(); saveGame();
}
function acceptSponsor(){
  if(state.channel < 5){ toast('Нужен канал от 5 для спонсора','bad'); return; }
  if(state.sponsor.active){ toast('Спонсор уже активен','bad'); return; }
  state.sponsor = { active:true, days:7, bonus:0.10 };
  toast('Спонсор принят! +10% дохода на 7 дней','good'); sfx('level'); renderAll(); saveGame();
}
function tickSponsorDaily(){ if(state.sponsor.active){ state.sponsor.days--; if(state.sponsor.days<=0){ state.sponsor={active:false,days:0,bonus:0}; toast('Спонсор завершил контракт','good'); } } }

function grantGlyph(){
  const g = GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
  if(state.glyphs.some(function(x){ return x.id===g.id; })) return;
  state.glyphs.push(Object.assign({},g));
  toast('🔮 Глиф: '+g.name+' ('+g.desc+')','good'); sfx('level'); burstCenter('var(--purple)');
}
function rollGlyphChance(){ if(Math.random()<0.25) grantGlyph(); }

function checkEndings(){
  const trig = { titan: currentStage().min>=34500, tycoon: state.money>=1000000, legend: level()>=100 };
  for(const k in trig){ if(trig[k] && !state.endings[k]){ state.endings[k]=true; showEnding(k); recordRun(); } }
}
function showEnding(k){
  const e = ENDINGS[k];
  document.getElementById('end-icon').innerHTML = '<i class="fa-solid '+e.icon+'"></i>';
  document.getElementById('end-title').textContent = e.title;
  document.getElementById('end-text').textContent = e.text;
  openModal('modal-ending'); sfx('level'); burstCenter('var(--purple)');
}
function seedBots(){
  try{
    const lb = JSON.parse(localStorage.getItem(LB_KEY)||'[]');
    if(lb.length) return;
    const bots = [['NeonKing',4200,12,'82'],['IronMaiden',3100,9,'90'],['StreamGuru',2600,7,'75'],['FlexLord',1800,5,'70']];
    bots.forEach(function(b){ lb.push({name:b[0],exp:b[1],lvl:b[2],kg:b[3],date:'bot'}); });
    lb.sort(function(a,b){ return b.exp-a.exp; }); localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0,10)));
  }catch(e){}
}
function updateViewers(){
  const el = document.getElementById('chat-viewers');
  if(el) el.textContent = viewers().toLocaleString('ru-RU');
}

/* chat visibility + position (customizable) */
let chatHidden = localStorage.getItem('bioarpg_chat_hidden')==='1';
let chatSide = localStorage.getItem('bioarpg_chat_side') || 'right';
function applyChat(){
  const panel = document.getElementById('chat-panel');
  if(!panel) return;
  panel.style.display = chatHidden ? 'none' : 'flex';
  panel.classList.toggle('chat-right', chatSide==='right');
  const sb = document.getElementById('chat-show-btn');
  if(sb) sb.style.display = chatHidden ? 'flex' : 'none';
}
function toggleChat(){ chatHidden = !chatHidden; localStorage.setItem('bioarpg_chat_hidden', chatHidden?'1':'0'); applyChat(); }
function toggleChatSide(){ chatSide = chatSide==='left'?'right':'left'; localStorage.setItem('bioarpg_chat_side', chatSide); applyChat(); }

/* =========================================================
   FEATURES 3: Twitch integration + profile card export
   ========================================================= */
let twClientId = localStorage.getItem('bioarpg_tw_client')||'';
let twToken = localStorage.getItem('bioarpg_tw_token')||'';
let twUser = null;
let twChatWS = null;
const TW_SCOPES = 'user:read:email chat:read';
function persistTw(){ try{ localStorage.setItem('bioarpg_tw_client', twClientId); localStorage.setItem('bioarpg_tw_token', twToken); }catch(e){} }
function openTwitch(){
  const c=document.getElementById('tw-client'); if(c) c.value=twClientId;
  const t=document.getElementById('tw-token'); if(t) t.value=twToken;
  const cb=document.getElementById('tw-chat'); if(cb) cb.checked = localStorage.getItem('bioarpg_tw_chat')==='1';
  renderTwitchStatus(); openModal('modal-twitch');
}
function startTwitchAuth(){
  twClientId = (document.getElementById('tw-client').value||'').trim();
  if(!twClientId){ toast('Введите Client ID','bad'); return; }
  persistTw();
  const redirect = location.href.split('#')[0];
  const url = 'https://id.twitch.tv/oauth2/authorize?response_type=token&client_id='+encodeURIComponent(twClientId)+'&redirect_uri='+encodeURIComponent(redirect)+'&scope='+encodeURIComponent(TW_SCOPES);
  location.href = url;
}
function applyTwitchToken(){
  twToken = (document.getElementById('tw-token').value||'').trim();
  if(!twToken){ toast('Введите токен','bad'); return; }
  persistTw(); fetchTwitch();
}
function renderTwitchStatus(){
  const el = document.getElementById('tw-status'); if(!el) return;
  if(twUser){ el.innerHTML = '<b>'+esc(twUser.display_name)+'</b> · подписчиков: '+(twUser.followers!=null?twUser.followers:'?')+' · '+(twUser.live?'<span style="color:#ff6b6b">В ЭФИРЕ</span>':'оффлайн'); }
  else if(twToken){ el.textContent = 'Токен есть — загружаю данные...'; }
  else { el.textContent = 'Не подключено.'; }
}
async function fetchTwitch(){
  if(!twToken || !twClientId){ renderTwitchStatus(); return; }
  try{
    const uh = new Headers(); uh.append('Authorization','Bearer '+twToken); uh.append('Client-Id', twClientId);
    const uRes = await fetch('https://api.twitch.tv/helix/users', {headers:uh});
    if(!uRes.ok) throw new Error('users '+uRes.status);
    const u = (await uRes.json()).data[0];
    twUser = { id:u.id, login:u.login, display_name:u.display_name, followers:null, live:false };
    try{ const fRes = await fetch('https://api.twitch.tv/helix/channels/followers?broadcaster_id='+u.id, {headers:uh}); if(fRes.ok){ twUser.followers = (await fRes.json()).total; } }catch(e){}
    try{ const sRes = await fetch('https://api.twitch.tv/helix/streams?user_login='+u.login, {headers:uh}); if(sRes.ok){ const sd=await sRes.json(); twUser.live = !!(sd.data && sd.data.length); } }catch(e){}
    if(twUser.followers){ state.channel = Math.min(999, 1 + Math.floor(twUser.followers/10)); }
    renderTwitchStatus(); renderAll(); saveGame();
    toast('Twitch подключён: '+twUser.display_name,'good');
  }catch(e){ toast('Ошибка Twitch: '+e.message,'bad'); renderTwitchStatus(); }
}
function toggleTwitchChat(on){
  localStorage.setItem('bioarpg_tw_chat', on?'1':'0');
  if(on) connectTwitchChat(); else disconnectTwitchChat();
}
function connectTwitchChat(){
  if(!twUser || !twToken){ toast('Сначала подключи Twitch','bad'); return; }
  try{
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws.onopen = function(){ ws.send('PASS oauth:'+twToken); ws.send('NICK '+twUser.login); ws.send('JOIN #'+twUser.login); };
    ws.onmessage = function(ev){
      ev.data.split('\r\n').forEach(function(line){
        if(line.indexOf('PRIVMSG')!==-1){
          const m = line.match(/PRIVMSG #\w+ :(.*)/); const u = line.match(/:(\w+)!/);
          if(m) pushChat((u?u[1]:'anon')+': '+m[1]);
        } else if(line[0]==='PING'){ ws.send('PONG :tmi.twitch.tv'); }
      });
    };
    ws.onerror = function(){ toast('Ошибка чата Twitch','bad'); };
    twChatWS = ws; toast('Чат Twitch подключён','good');
  }catch(e){ toast('Не удалось подключить чат','bad'); }
}
function disconnectTwitchChat(){ if(twChatWS){ try{ twChatWS.close(); }catch(e){} twChatWS=null; } }

/* export profile card as PNG */
function exportProfileCard(){
  try{
    const c = document.createElement('canvas'); c.width=480; c.height=300;
    const x = c.getContext('2d');
    const cyan = getComputedStyle(document.documentElement).getPropertyValue('--cyan')||'#00f3ff';
    const pur = getComputedStyle(document.documentElement).getPropertyValue('--purple')||'#bc13fe';
    const g = x.createLinearGradient(0,0,480,300); g.addColorStop(0,'#0a0f1f'); g.addColorStop(1,'#131a30');
    x.fillStyle=g; x.fillRect(0,0,480,300);
    x.strokeStyle=cyan; x.lineWidth=2; x.strokeRect(8,8,464,284);
    x.fillStyle=cyan; x.font='bold 26px sans-serif'; x.fillText('BIO-ARPG', 24, 46);
    x.fillStyle='#dbeafe'; x.font='bold 22px sans-serif'; x.fillText('@'+(state.profile.name||'стример'), 24, 84);
    x.fillStyle='#9fb4d6'; x.font='14px sans-serif';
    const lines = [
      'Форма: '+currentStage().label+'   Уровень '+level(),
      'EXP: '+Math.floor(state.exp)+'   Деньги: '+Math.floor(state.money)+' ₽',
      'Канал: '+Math.round(state.channel)+'   Возраст: '+state.age,
      'Сила '+state.attr.str+' · Выносл. '+state.attr.sta+' · Харизма '+state.attr.cha,
      'Мутаций: '+Object.values(state.mutations).reduce((a,b)=>a+b,0)+'   Ачивок: '+Object.keys(state.achievements||{}).length
    ];
    lines.forEach(function(l,i){ x.fillText(l, 24, 120+i*26); });
    x.fillStyle=pur; x.font='12px sans-serif'; x.fillText('Симулятор Трансформации Стримера', 24, 282);
    const a = document.createElement('a'); a.download='bioarpg-card.png'; a.href=c.toDataURL('image/png'); a.click();
    toast('Карточка профиля выгружена (PNG)','good');
  }catch(e){ toast('Не удалось экспортировать','bad'); }
}

/* =========================================================
   FEATURES 4: prestige, duels, clan, story, music
   ========================================================= */
/* ---- Training minigame toggle ---- */
function toggleMiniGame(){ state.miniGame = !state.miniGame; saveGame(); toast('Мини-игра тренировок: '+(state.miniGame?'ВКЛ':'ВЫКЛ'),'good'); const b=document.getElementById('mg-btn'); if(b) b.innerHTML = '<i class="fa-solid fa-gamepad"></i><span>Мини-игра: '+(state.miniGame?'ВКЛ':'ВЫКЛ')+'</span>'; }

/* ---- Duels with bots ---- */
function myPower(){ return state.attr.str*2 + state.attr.sta + state.attr.cha + level(); }
function openDuels(){
  const wrap = document.getElementById('duel-list');
  if(wrap) wrap.innerHTML = DUEL_BOTS.map(function(b){
    const can = myPower() >= b.power*0.5;
    return `<div class="glass rounded-xl p-3 flex items-center gap-3 ${can?'':'opacity-60'}">
      <div class="text-2xl" style="color:${b.color||'#c4b5fd'}"><i class="fa-solid ${b.icon||'fa-robot'}"></i></div>
      <div class="flex-1"><div class="text-sm font-semibold">${b.name}</div><div class="text-[11px] text-cyan-200/70">Сила: ${b.power} · Награда: ${b.reward} ₽ + EXP</div></div>
      <button class="glass rounded-lg px-3 py-2 text-sm neon-purple hover:bg-pink-400/10" data-call="startDuel" data-args="${b.id}">Бой</button>
    </div>`;
  }).join('');
  document.getElementById('duel-power').textContent = 'Твоя сила: '+myPower();
  openModal('modal-duel');
}
function startDuel(id){
  const b = DUEL_BOTS.find(function(x){ return x.id===id; }); if(!b) return;
  const my = myPower();
  const win = my >= b.power*0.8 && Math.random() < (my/(my+b.power));
  if(win){ const g=Math.round(b.reward*expMult()); state.exp+=g; state.money+=b.reward; toast('Победа над '+b.name+'! +'+b.reward+' ₽, +'+g+' EXP','good'); sfx('duel_win'); }
  else { state.hp=clamp(state.hp-8); state.mood=clamp(state.mood-8); toast('Поражение от '+b.name,'bad'); sfx('duel_lose'); }
  afterAction();
}

/* ---- Clan (local) ---- */
function openClan(){ const i=document.getElementById('clan-input'); if(i) i.value=state.clan||''; openModal('modal-clan'); }
function setClan(){
  const v=(document.getElementById('clan-input').value||'').trim().slice(0,18);
  state.clan=v; saveGame(); renderAll(); toast(v ? ('Клан "'+v+'" создан (+5% доход)') : 'Клан покинут', 'good'); openClan();
}

/* ---- Story chapters ---- */
function checkStory(){
  STORY.forEach(function(c){
    if(!state.story[c.id] && c.check()){ state.story[c.id]=true; c.reward(); toast('📖 Сюжет: «'+c.title+'» пройден!','good'); sfx('level'); }
  });
}
function openStory(){
  const wrap=document.getElementById('story-list');
  if(wrap) wrap.innerHTML = STORY.map(function(c){
    const done = !!state.story[c.id];
    return `<div class="glass rounded-xl p-3 ${done?'border border-cyan-400/40':''}">
      <div class="flex items-center justify-between"><div class="text-sm font-semibold">${c.title}</div>${done?'<span class="text-cyan-300 text-xs">✓ пройдено</span>':'<span class="text-cyan-300/50 text-xs">в процессе</span>'}</div>
      <div class="text-[11px] text-cyan-200/70">${c.desc}</div></div>`;
  }).join('');
  openModal('modal-story');
}

/* ---- Prestige / metaprogression ---- */
function prestigeGain(){ return Math.floor(level()/5); }
function renderPrestigeInfo(){
  document.getElementById('prestige-info').innerHTML =
    'Текущий уровень: <b>'+level()+'</b> · Мета-очки: <b>'+(state.meta?state.meta.points:0)+'</b><br>'+
    (level()>=20 ? 'За престиж ты получишь <b>+'+prestigeGain()+'</b> мета-очков (каждый мета-уровень +2% к EXP и доходу навсегда) и начнёшь заново, сохранив профиль, класс, нишу, глифы, ачивки и клан.' : 'Нужен <b>20 уровень</b>, чтобы сделать престиж.');
}
function openPrestige(){
  renderPrestigeInfo();
  renderMetaShop();
  openModal('modal-prestige');
}
function renderMetaShop(){
  const wrap = document.getElementById('meta-shop');
  if(!wrap) return;
  const pts = state.meta ? state.meta.points : 0;
  wrap.innerHTML = META_UPGRADES.map(function(u){
    const lvl = metaUp(u.id);
    const maxed = lvl >= u.max;
    const cost = u.cost(lvl);
    const can = !maxed && pts >= cost;
    return `<div class="glass rounded-xl p-3 mb-2 flex items-center gap-3 ${maxed?'opacity-70':''}">
      <div class="text-2xl text-purple-300"><i class="fa-solid ${u.icon}"></i></div>
      <div class="flex-1">
        <div class="text-sm font-semibold">${u.name} <span class="text-[11px] text-cyan-300/60">ур. ${lvl}/${u.max}</span></div>
        <div class="text-[11px] text-cyan-200/70">${u.desc}</div>
      </div>
      ${maxed
        ? '<span class="text-green-300 text-sm"><i class="fa-solid fa-check"></i> Макс.</span>'
        : `<button class="glass rounded-lg px-3 py-2 text-sm ${can?'neon-purple hover:bg-pink-400/10':'opacity-50 cursor-not-allowed'}" data-call="buyMeta" data-args="${u.id}" ${can?'':'disabled'}>${cost} очк.</button>`}
    </div>`;
  }).join('');
}
function buyMeta(id){
  const u = META_UPGRADES.find(x=>x.id===id);
  if(!u) return;
  const lvl = metaUp(id);
  if(lvl >= u.max){ toast('Уже максимум','bad'); return; }
  const cost = u.cost(lvl);
  if((state.meta?state.meta.points:0) < cost){ toast('Не хватает мета-очков','bad'); sfx('error'); return; }
  state.meta.points -= cost;
  state.meta.up = state.meta.up || {};
  state.meta.up[id] = lvl+1;
  toast(u.name+': уровень '+(lvl+1),'good');
  sfx('buy');
  renderPrestigeInfo();
  renderMetaShop();
  renderAll();
  saveGame();
}
function doPrestige(){
  if(level()<20){ toast('Нужен 20 уровень','bad'); return; }
  const gain = prestigeGain();
  const keep = {
    meta:{ level:(state.meta?state.meta.level:0)+1, points:(state.meta?state.meta.points:0)+gain, up:(state.meta&&state.meta.up)||{} },
    profile:state.profile, niche:state.niche, achievements:state.achievements,
    glyphs:state.glyphs, difficulty:state.difficulty, tutorialDone:true,
    clan:state.clan, story:state.story
  };
  if(metaUp('m_keep') >= 1){ keep.equipped = state.equipped; keep.inventory = state.inventory; }
  const d = makeDefaultState();
  Object.assign(state, d, keep);
  weeklyInit();
  saveGame(); renderAll(); closeModal('modal-prestige');
  toast('Престиж! Новый мета-уровень '+(state.meta.level)+', +'+gain+' мета-очков','good'); sfx('level'); burstCenter('var(--purple)');
}

/* ---- Background music: synthwave sequencer (WebAudio, no assets) ---- */
/* four distinct tracks; drums: four=four-on-floor, half=half-time, soft=ambient */
const MUSIC_TRACKS=[
  { name:'Neon Drive',   bpm:104, drums:'four', hat:4, arpWave:'square',   bassWave:'sawtooth', arpOct:0,  pad:0.05,
    chords:[ {bass:45,arp:[57,60,64,69]},{bass:41,arp:[53,57,60,65]},{bass:48,arp:[55,60,64,67]},{bass:43,arp:[55,59,62,67]} ],
    patt:[0,1,2,3,2,1,2,3,0,2,1,3,2,3,1,2] },
  { name:'Dark Iron',    bpm:88,  drums:'half', hat:4, arpWave:'triangle', bassWave:'sawtooth', arpOct:0,  pad:0.06,
    chords:[ {bass:38,arp:[50,53,57,62]},{bass:34,arp:[46,50,53,58]},{bass:41,arp:[53,57,60,65]},{bass:36,arp:[48,52,55,60]} ],
    patt:[0,-1,2,-1,1,-1,3,-1,0,-1,2,1,-1,3,-1,2] },
  { name:'Cyber Rush',   bpm:128, drums:'four', hat:2, arpWave:'sawtooth', bassWave:'square',   arpOct:12, pad:0.04,
    chords:[ {bass:40,arp:[52,55,59,64]},{bass:36,arp:[48,52,55,60]},{bass:43,arp:[55,59,62,67]},{bass:38,arp:[50,54,57,62]} ],
    patt:[0,2,1,3,0,2,1,3,0,2,1,3,0,2,1,3] },
  { name:'Chill Stream', bpm:76,  drums:'soft', hat:8, arpWave:'sine',     bassWave:'triangle', arpOct:0,  pad:0.06,
    chords:[ {bass:36,arp:[55,59,60,64]},{bass:45,arp:[57,60,64,67]},{bass:41,arp:[53,57,60,64]},{bass:43,arp:[55,59,62,65]} ],
    patt:[0,-1,1,-1,2,-1,3,-1,2,-1,1,-1,0,-1,2,-1] }
];
const Music = (function(){
  let ctx=null, master=null, delaySend=null, noise=null;
  let timer=null, nextTime=0, step=0, running=false;
  let cfgIdx=0, TR=MUSIC_TRACKS[0], vol=0.16;
  try{ const v=parseInt(localStorage.getItem('bioarpg_track')); if(!isNaN(v)) cfgIdx=((v%MUSIC_TRACKS.length)+MUSIC_TRACKS.length)%MUSIC_TRACKS.length; }catch(e){}
  TR=MUSIC_TRACKS[cfgIdx];
  const SD = () => 60/TR.bpm/4;
  const BARS=4, STEPS=BARS*16;
  const f = m => 440*Math.pow(2,(m-69)/12);
  function env(g,t,a,peak,rel){
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(peak,t+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t+rel);
  }
  function kick(t,vel){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(45,t+0.12);
    env(g,t,0.002,vel||0.9,0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+0.2);
  }
  function hat(t,open){
    const s=ctx.createBufferSource(); s.buffer=noise;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=7000;
    const g=ctx.createGain(); env(g,t,0.001,open?0.14:0.08,open?0.14:0.045);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t+0.2);
  }
  function snare(t){
    const s=ctx.createBufferSource(); s.buffer=noise;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1800; bp.Q.value=0.8;
    const g=ctx.createGain(); env(g,t,0.001,0.3,0.14);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t+0.2);
    const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=190;
    const g2=ctx.createGain(); env(g2,t,0.001,0.2,0.09);
    o.connect(g2); g2.connect(master); o.start(t); o.stop(t+0.12);
  }
  function bass(t,midi,len){
    const o=ctx.createOscillator(); o.type=TR.bassWave; o.frequency.value=f(midi);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass';
    lp.frequency.setValueAtTime(700,t);
    lp.frequency.exponentialRampToValueAtTime(220,t+0.22);
    const g=ctx.createGain(); env(g,t,0.005,0.32,len);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t+len+0.05);
  }
  function pluck(t,midi){
    if(midi==null) return;
    const o=ctx.createOscillator(); o.type=TR.arpWave; o.frequency.value=f(midi);
    const g=ctx.createGain(); env(g,t,0.003,0.1,SD()*1.4);
    o.connect(g); g.connect(master); g.connect(delaySend);
    o.start(t); o.stop(t+SD()*1.6);
  }
  function pad(t,chord){
    if(!TR.pad) return;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(TR.pad,t+0.6);
    g.gain.setValueAtTime(TR.pad,t+SD()*14);
    g.gain.linearRampToValueAtTime(0.0001,t+SD()*16);
    lp.connect(g); g.connect(master);
    chord.arp.slice(0,3).forEach((m,i)=>{
      const o=ctx.createOscillator(); o.type='sawtooth';
      o.frequency.value=f(m)*(i===2?1.004:0.996); /* detune = width */
      o.connect(lp); o.start(t); o.stop(t+SD()*16+0.1);
    });
  }
  function bassLine(s,t,ch){
    let play=false, oct=false, len=SD()*1.8;
    if(TR.drums==='four'){ play = s%2===0; oct = s===14; }
    else if(TR.drums==='half'){ play = (s===0||s===7||s===10); oct = s===10; }
    else { play = s===0; len = SD()*14; }
    if(play) bass(t, ch.bass + (oct?12:0), len);
  }
  function drums(s,t,bar){
    if(TR.drums==='four'){
      if(s%4===0) kick(t);
      if(s===4||s===12) snare(t);
      if(s%TR.hat===(TR.hat>>1)) hat(t,false);
      if(s===15 && bar%2===1) hat(t,true);
    } else if(TR.drums==='half'){
      if(s===0||s===10) kick(t);
      if(s===8) snare(t);
      if(s%TR.hat===(TR.hat>>1)) hat(t,false);
    } else if(TR.drums==='soft'){
      if(s===0) kick(t,0.4);
      if(s%TR.hat===(TR.hat>>1)) hat(t,false);
    }
  }
  function schedule(){
    while(nextTime < ctx.currentTime + 0.35){
      const s = step % 16, bar = (step/16|0) % BARS, ch = TR.chords[bar];
      if(s===0) pad(nextTime,ch);
      bassLine(s,nextTime,ch);
      drums(s,nextTime,bar);
      const p = TR.patt[s];
      if(p!=null && p>=0) pluck(nextTime, ch.arp[p] + TR.arpOct);
      nextTime += SD(); step=(step+1)%STEPS;
    }
  }
  function ensure(){
    if(ctx) return;
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain(); master.gain.value=0.0001;
    const comp=ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noise=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);
    const d=noise.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    /* echo for the arp */
    delaySend=ctx.createGain(); delaySend.gain.value=0.35;
    const dl=ctx.createDelay(1); dl.delayTime.value=SD()*3;
    const fb=ctx.createGain(); fb.gain.value=0.35;
    const wet=ctx.createGain(); wet.gain.value=0.5;
    delaySend.connect(dl); dl.connect(fb); fb.connect(dl);
    dl.connect(wet); wet.connect(master);
  }
  function start(){
    ensure(); ctx.resume();
    running=true; step=0; nextTime=ctx.currentTime+0.1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001,ctx.currentTime);
    master.gain.linearRampToValueAtTime(vol,ctx.currentTime+1.2);
    if(timer) clearInterval(timer);
    timer=setInterval(schedule,90); schedule();
  }
  function stop(){
    running=false;
    if(timer){ clearInterval(timer); timer=null; }
    const t=ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value,t);
    master.gain.linearRampToValueAtTime(0.0001,t+0.6);
  }
  function setVolume(v){
    vol = v;
    if(master && running){
      const t=ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value,t);
      master.gain.linearRampToValueAtTime(Math.max(v,0.0001),t+0.15);
    }
  }
  function toggle(){
    ensure(); ctx.resume();
    if(running) stop(); else start();
    return running;
  }
  function next(){
    const was = running;
    if(was) stop();
    cfgIdx = (cfgIdx+1) % MUSIC_TRACKS.length;
    TR = MUSIC_TRACKS[cfgIdx];
    try{ localStorage.setItem('bioarpg_track', String(cfgIdx)); }catch(e){}
    if(was) start();
    return TR.name;
  }
  function playIndex(i){
    i = ((i%MUSIC_TRACKS.length)+MUSIC_TRACKS.length)%MUSIC_TRACKS.length;
    if(i === cfgIdx) return TR.name;
    const was = running;
    if(was) stop();
    cfgIdx = i; TR = MUSIC_TRACKS[cfgIdx];
    try{ localStorage.setItem('bioarpg_track', String(cfgIdx)); }catch(e){}
    if(was) start();
    return TR.name;
  }
  return { toggle:toggle, next:next, playIndex:playIndex, setVolume:setVolume,
           trackName:function(){ return TR.name; }, isPlaying:function(){ return running; } };
})();

/* volume modal */
function openVolume(){
  const m = document.getElementById('vol-music'), s = document.getElementById('vol-sfx');
  if(m) m.value = Math.round(parseFloat(localStorage.getItem('bioarpg_vol_music')||'0.16')*100);
  if(s) s.value = Math.round(sfxVolume*100);
  openModal('modal-volume');
}

/* ---- Help modal ---- */
function openHelp(){
  const wrap = document.getElementById('help-mults');
  if(wrap){
    const rows = [
      ['Множитель EXP', '×'+expMult().toFixed(2)],
      ['Множитель дохода', '×'+incomeMult().toFixed(2)],
      ['Серия дней', (state.streak.count||0)+' дн. · ×'+streakMult().toFixed(2)],
      ['Мета-бонус', '×'+metaMult().toFixed(2)],
      ['Клан', state.clan ? '×'+clanMult().toFixed(2) : 'нет'],
      ['Сложность', state.difficulty]
    ];
    wrap.innerHTML = rows.map(r=>`<div class="flex justify-between"><span class="text-cyan-300/70">${r[0]}</span><span>${r[1]}</span></div>`).join('');
  }
  openModal('modal-help');
}

/* ---- Weekly quests ---- */
function weekKey(){
  const d = new Date();
  const start = new Date(d.getFullYear(),0,1);
  const wk = Math.floor((d - start) / (7*864e5));
  return d.getFullYear()+'-W'+wk;
}
function weeklyInit(){
  if(!state.weekly) state.weekly = { key:'', train:0, earn:0, loot:0, claimed:{} };
  if(state.weekly.key !== weekKey()){
    state.weekly = { key:weekKey(), train:0, earn:0, loot:0, claimed:{} };
  }
}
function weeklyCur(q){
  return q.id==='w_train' ? state.weekly.train : (q.id==='w_earn' ? state.weekly.earn : state.weekly.loot);
}
function openWeekly(){
  weeklyInit();
  renderWeekly();
  openModal('modal-weekly');
}
function renderWeekly(){
  const wrap = document.getElementById('weekly-list');
  if(!wrap) return;
  wrap.innerHTML = WEEKLY_QUESTS.map(function(q){
    const cur = Math.min(weeklyCur(q), q.target);
    const pct = Math.round(cur/q.target*100);
    const done = weeklyCur(q) >= q.target;
    const claimed = !!state.weekly.claimed[q.id];
    const reward = [
      q.reward.money ? q.reward.money+' ₽' : '',
      q.reward.exp ? q.reward.exp+' EXP' : ''
    ].filter(Boolean).join(' + ');
    let btn;
    if(claimed) btn = '<span class="text-green-300 text-sm"><i class="fa-solid fa-check"></i> Получено</span>';
    else if(done) btn = `<button class="glass rounded-lg px-4 py-2 text-sm neon-text hover:bg-cyan-400/10" data-call="claimWeekly" data-args="${q.id}">Забрать</button>`;
    else btn = `<span class="text-[11px] text-cyan-300/50">${reward}</span>`;
    return `<div class="glass rounded-xl p-3 mb-3">
      <div class="flex items-center gap-3">
        <div class="text-2xl text-cyan-300"><i class="fa-solid ${q.icon}"></i></div>
        <div class="flex-1">
          <div class="text-sm font-semibold">${q.desc}</div>
          <div class="text-[11px] text-cyan-300/60 mt-1">${Math.floor(weeklyCur(q)).toLocaleString('ru-RU')} / ${q.target.toLocaleString('ru-RU')} · награда: ${reward}</div>
        </div>
        ${btn}
      </div>
      <div class="bar-track mt-2" style="height:8px"><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--cyan),var(--purple))"></div></div>
    </div>`;
  }).join('');
}
function claimWeekly(id){
  const q = WEEKLY_QUESTS.find(x=>x.id===id);
  if(!q) return;
  weeklyInit();
  if(state.weekly.claimed[id]){ toast('Награда уже получена','bad'); return; }
  if(weeklyCur(q) < q.target){ toast('Задание ещё не выполнено','bad'); return; }
  state.weekly.claimed[id] = true;
  if(q.reward.money) state.money += q.reward.money;
  if(q.reward.exp) state.exp += q.reward.exp;
  toast('Награда: '+(q.reward.money?q.reward.money+' ₽ ':'')+(q.reward.exp?'+'+q.reward.exp+' EXP':''),'good');
  sfx('weekly');
  renderWeekly();
  renderAll();
  saveGame();
}
function cycleMusicTrack(){
  try{
    const name = Music.next();
    toast('Трек: '+name,'good');
    if(state.musicOn && !Music.isPlaying()) toggleMusic();
  }catch(e){ toast('Аудио недоступно','bad'); }
}
function toggleMusic(){
  try{
    state.musicOn = Music.toggle();
    saveGame();
    const b=document.getElementById('music-btn');
    if(b) b.innerHTML = state.musicOn ? '<i class="fa-solid fa-music"></i><span>Музыка</span>' : '<i class="fa-solid fa-volume-xmark"></i><span>Музыка</span>';
  }catch(e){ toast('Аудио недоступно','bad'); }
}

/* =========================================================
   INIT
   ========================================================= */
const loaded = loadGame();
if(loaded && (state.hp<=0 || state.mood<=0 || state.energy<=0)){
  // permadeath had already occurred -> progress is lost by design
  resetGame();
} else {
  if(loaded) toast('Прогресс загружен из сохранения.','good');
}
lastStageMin = currentStage().min;
renderAll();
if(!state.profile.name){ showStartScreen(); }
else if(!state.tutorialDone){ showTutorial(); }

/* restore theme + sound */
try{ const ti = parseInt(localStorage.getItem('bioarpg_theme')); if(!isNaN(ti)) applyTheme(ti); }catch(e){}
try{ if(localStorage.getItem('bioarpg_sound')==='1'){ soundOn=true; const b=document.getElementById('sound-btn'); if(b) b.innerHTML='<i class="fa-solid fa-volume-high"></i><span>Звук</span>'; } }catch(e){}
try{ const mg=document.getElementById('mg-btn'); if(mg) mg.innerHTML='<i class="fa-solid fa-gamepad"></i><span>Мини-игра: '+(state.miniGame?'ВКЛ':'ВЫКЛ')+'</span>'; }catch(e){}
try{ const mb=document.getElementById('music-btn'); if(mb) mb.innerHTML=(state.musicOn?'<i class="fa-solid fa-music"></i>':'<i class="fa-solid fa-volume-xmark"></i>')+'<span>Музыка</span>'; }catch(e){}
/* browsers block autoplay: if music was ON, start it on the first user gesture */
if(state.musicOn && !Music.isPlaying()){
  const startMusicOnce = function(){
    document.removeEventListener('click', startMusicOnce, true);
    if(!Music.isPlaying()) toggleMusic();
  };
  document.addEventListener('click', startMusicOnce, true);
}
startEvents();

/* volume sliders: live apply + persist */
(function(){
  const m = document.getElementById('vol-music'), s = document.getElementById('vol-sfx');
  const savedMusic = parseFloat(localStorage.getItem('bioarpg_vol_music'));
  if(!isNaN(savedMusic)) Music.setVolume(savedMusic);
  if(m) m.addEventListener('input', function(){
    const v = m.value/100;
    Music.setVolume(v);
    try{ localStorage.setItem('bioarpg_vol_music', String(v)); }catch(e){}
  });
  if(s) s.addEventListener('input', function(){ setSfxVolume(s.value/100); });
})();

/* ---------- Dev panel (only with ?dev=1 in URL) ---------- */
(function(){
  if(!location.search.includes('dev=1')) return;
  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  panel.style.cssText = 'position:fixed;right:16px;top:80px;z-index:2000;width:210px;padding:12px;border-radius:14px;'+
    'background:rgba(8,12,28,.96);border:1px dashed #ff4d6d;font-size:12px;color:#dbeafe;display:flex;flex-direction:column;gap:6px';
  panel.innerHTML = `
    <div style="font-family:Orbitron;color:#ff4d6d;text-align:center">DEV PANEL</div>
    <button data-d="money"  class="glass rounded py-1">+1 000 ₽</button>
    <button data-d="exp"    class="glass rounded py-1">+500 EXP</button>
    <button data-d="stage"  class="glass rounded py-1">След. форма</button>
    <button data-d="pp"     class="glass rounded py-1">+5 пассивок</button>
    <button data-d="meta"   class="glass rounded py-1">+3 мета-очка</button>
    <button data-d="item"   class="glass rounded py-1">+случайный предмет</button>
    <button data-d="day"    class="glass rounded py-1">День вперёд (стрик)</button>
    <button data-d="week"   class="glass rounded py-1">Сбросить неделю</button>
    <button data-d="stats"  class="glass rounded py-1">+1 СИЛ/ВЫН/ХАР</button>`;
  document.body.appendChild(panel);
  panel.addEventListener('click', function(e){
    const b = e.target.closest('[data-d]');
    if(!b) return;
    const act = b.dataset.d;
    if(act==='money') state.money += 1000;
    if(act==='exp') state.exp += 500;
    if(act==='stage'){ const n = nextStageThreshold(); if(n) state.exp = n; else state.exp += 5000; }
    if(act==='pp') state.passPoints += 5;
    if(act==='meta'){ state.meta.points += 3; }
    if(act==='item') state.inventory.push(rollItem(['simple','elite','legendary'][Math.floor(Math.random()*3)]));
    if(act==='day'){
      state.streak.count = (state.streak.count||0)+1;
      state.streak.lastDate = todayStr();
      state.daily = { date:'', train:0, earn:0, loot:0, mut:0, claimed:false, slept:false, trainById:{} };
    }
    if(act==='week'){ state.weekly = { key:weekKey(), train:0, earn:0, loot:0, claimed:{} }; toast('Неделя сброшена'); }
    if(act==='stats'){ state.attr.str++; state.attr.sta++; state.attr.cha++; }
    renderAll();
    saveGame();
    toast('DEV: '+b.textContent.trim(),'good');
  });
})();

/* Twitch OAuth return: capture token from URL hash */
(function(){
  try{
    const h = location.hash || '';
    const m = h.match(/access_token=([\w\-.~+]+)/);
    if(m){ twToken = m[1]; persistTw(); location.hash=''; fetchTwitch(); }
    else if(twToken && twClientId){ fetchTwitch(); }
  }catch(e){}
})();

/* ---------- Boot shared interactive background + custom cursor ---------- */
if (window.initBackground) initBackground('canvas-container');
if (window.initCursor) initCursor('.action-card, .tab-btn, button, a, .node, .slot, .inv-cell, .loot-chest');
setInterval(updateViewers, 3000);
applyChat();

/* ---------- Keyboard shortcuts (e.code = layout-independent) ----------
   Esc — close top modal · M — music · C — theme · F1 / ? — help
   On the actions tab: 1..6 trainings, Q..T works, A..J rests          */
document.addEventListener('keydown', function(e){
  if(e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
  const tag = e.target && e.target.tagName;
  if(tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT') return;
  if(e.code==='Escape'){
    const closable = [...document.querySelectorAll('.modal-backdrop.show')].filter(m=>m.id!=='modal-gameover');
    if(closable.length) closeModal(closable[closable.length-1].id);
    return;
  }
  if(e.code==='KeyM'){ toggleMusic(); return; }
  if(e.code==='KeyC'){ cycleTheme(); return; }
  if(e.code==='F1' || e.key==='?'){ e.preventDefault(); openHelp(); return; }
  if(currentTab!=='actions' || document.querySelector('.modal-backdrop.show')) return;
  const trainKeys = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'];
  const workKeys  = ['KeyQ','KeyW','KeyE','KeyR','KeyT'];
  const restKeys  = ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ'];
  let idx = trainKeys.indexOf(e.code);
  if(idx>-1 && TRAININGS[idx]){ doAction('train', TRAININGS[idx].id); return; }
  idx = workKeys.indexOf(e.code);
  if(idx>-1 && WORKS[idx]){ doAction('work', WORKS[idx].id); return; }
  idx = restKeys.indexOf(e.code);
  if(idx>-1 && RESTS[idx]){ doAction('rest', RESTS[idx].id); return; }
});
