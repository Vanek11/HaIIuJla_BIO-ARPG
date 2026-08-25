/* =========================================================
   BIO-ARPG :: game data (pure config, no logic)
   ========================================================= */

function heroSVG(weight, color){
  const t = (weight-61)/(94-61); // 0..1
  const torsoW = 50 + t*110;
  const armW = 12 + t*34;
  const legW = 22 + t*40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="420" viewBox="0 0 260 420">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="100%" stop-color="#bc13fe"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="260" height="420" fill="#050914"/>
    <g filter="url(#glow)" stroke="url(#g)" stroke-width="3" fill="rgba(0,243,255,0.12)">
      <circle cx="130" cy="55" r="26"/>
      <rect x="${130-torsoW/2}" y="85" width="${torsoW}" height="150" rx="20"/>
      <rect x="${130-torsoW/2-armW-6}" y="90" width="${armW}" height="130" rx="14"/>
      <rect x="${130+torsoW/2+6}" y="90" width="${armW}" height="130" rx="14"/>
      <rect x="${130-legW/2}" y="240" width="${legW}" height="150" rx="18"/>
      <rect x="${130-legW/2-legW-4}" y="240" width="${legW}" height="150" rx="18"/>
    </g>
    <text x="130" y="410" text-anchor="middle" fill="${color}" font-family="Orbitron, sans-serif" font-size="22" font-weight="700">${weight} kg</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

const STAGES = [
  { min:0,     max:750,   label:"61 кг (Старт, хрупкое тело)",     photo:"images/61kg.webp",  svg:heroSVG(61,"#00f3ff") },
  { min:750,   max:1600,  label:"66 кг (Пробуждение)",            photo:"images/66kg.webp",  svg:heroSVG(66,"#00d0ff") },
  { min:1600,  max:3000,  label:"70 кг (Фундамент, рельеф)",      photo:"images/70kg.webp",  svg:heroSVG(70,"#22d3ee") },
  { min:3000,  max:4600,  label:"75 кг (Рост силы)",              photo:"images/75kg.webp",  svg:heroSVG(75,"#38bdf8") },
  { min:4600,  max:6500,  label:"79 кг (Плотность)",              photo:"images/79kg.webp",  svg:heroSVG(79,"#818cf8") },
  { min:6500,  max:9000,  label:"82 кг (Масса, корсет)",          photo:"images/82kg.webp",  svg:heroSVG(82,"#a855f7") },
  { min:9000,  max:12000, label:"86 кг (Титаник)",                photo:"images/86kg.webp",  svg:heroSVG(86,"#9333ea") },
  { min:12000, max:15500, label:"90 кг (Гора)",                   photo:"images/90kg.webp",  svg:heroSVG(90,"#c026d3") },
  { min:15500, max:19500, label:"94 кг (Абсолют, пик формы)",     photo:"images/94kg.webp",  svg:heroSVG(94,"#bc13fe") },
  { min:19500, max:24000, label:"98 кг (Сверхформа)",             photo:"images/98kg.webp",  svg:heroSVG(98,"#e11d8f") },
  { min:24000, max:29000, label:"102 кг (Монолит)",               photo:"images/102kg.webp", svg:heroSVG(102,"#f43f5e") },
  { min:29000, max:34500, label:"106 кг (Колосс)",                photo:"images/106kg.webp", svg:heroSVG(106,"#fb7185") },
  { min:34500, max:Infinity, label:"110 кг (Титан, предел)",      photo:"images/110kg.webp", svg:heroSVG(110,"#f59e0b") }
];

const TRAININGS = [
  { id:'t1', name:'Разминка с гантелями', lvl:1, icon:'fa-dumbbell', exp:15, energy:8, hp:3, money:0, desc:'Лёгкая разминка для разгона кровотока.' },
  { id:'t2', name:'Базовая качалка', lvl:3, icon:'fa-person-pressing', exp:35, energy:15, hp:8, money:10, desc:'Классическая тренировка всего тела.' },
  { id:'t3', name:'Скамья Скотта', lvl:6, icon:'fa-hand-fist', exp:70, energy:25, hp:15, money:20, desc:'Изоляция на бицепс и предплечья.' },
  { id:'t4', name:'Тяга блока 55кг & 60кг', lvl:10, icon:'fa-arrows-left-right', exp:130, energy:35, hp:25, money:40, desc:'Тяжёлая спинная работа в блоках.' },
  { id:'t5', name:'Хардкор-лифтинг', lvl:16, icon:'fa-fire', exp:220, energy:50, hp:40, money:80, desc:'Экстремальный силовой лифтинг.' },
  { id:'t6', name:'Суперсет Pro', lvl:24, icon:'fa-bolt', exp:380, energy:65, hp:55, money:150, desc:'Безотдыхочные суперсеты профи.' }
];

const WORKS = [
  { id:'w1', name:'Стрим по WOT/CS2', lvl:1, icon:'fa-twitch', money:60, energy:12, mood:8, desc:'Донаты и подписки зрителей.' },
  { id:'w2', name:'Коучинг новичков', lvl:4, icon:'fa-chalkboard-user', money:120, energy:18, mood:12, desc:'Обучение новичков за деньги.' },
  { id:'w3', name:'Фриланс-кодинг Python/JS', lvl:8, icon:'fa-code', money:220, energy:25, mood:18, desc:'Заказы на бирже фриланса.' },
  { id:'w4', name:'Смена на складе', lvl:12, icon:'fa-warehouse', money:350, energy:35, mood:25, desc:'Тяжёлый физический труд.' },
  { id:'w5', name:'Контракт с брендом', lvl:20, icon:'fa-handshake', money:650, energy:40, mood:30, desc:'Рекламный контракт со спонсором.' }
];

const RESTS = [
  { id:'r1', name:'Сон 8ч', lvl:1, icon:'fa-bed', hp:30, energy:45, mood:10, money:0, energyCost:0, desc:'Полноценный ночной сон. Бесплатно.' },
  { id:'r2', name:'Катка в PEAK/CS2', lvl:2, icon:'fa-gamepad', hp:0, energy:10, mood:25, money:50, energyCost:5, desc:'Разрядка в любимой игре.' },
  { id:'r3', name:'Стейк + Протеин', lvl:5, icon:'fa-utensils', hp:25, energy:10, mood:0, money:80, energyCost:0, desc:'Плотный приём белковой пищи.' },
  { id:'r4', name:'Массаж и СПА', lvl:11, icon:'fa-spa', hp:15, energy:0, mood:30, money:200, energyCost:0, desc:'Релакс и восстановление нервов.' },
  { id:'r5', name:'Криосауна', lvl:18, icon:'fa-snowflake', hp:40, energy:20, mood:20, money:400, energyCost:0, desc:'Холодовая терапия премиум-класса.' },
  { id:'r6', name:'Плотный ужин', lvl:1, icon:'fa-utensils', hp:5, energy:0, mood:5, money:60, energyCost:0, hunger:45, desc:'Восстановление голода. Без еды метаболизм падает!' },
  { id:'r7', name:'Перезагрузка', lvl:1, icon:'fa-rotate', hp:0, energy:6, mood:4, money:0, energyCost:0, hunger:-2, emergency:true, desc:'Экстренный отдых: немного энергии и настроения БЕСПЛАТНО. Всегда доступно, чтобы выйти из тупика.' }
];

const BRANCHES = [
  { key:'arms',  name:'Руки',     icon:'fa-hand-fist',           color:'#00f3ff',
    effect:'+5% к приросту EXP от тренировок за уровень.' },
  { key:'legs',  name:'Ноги',     icon:'fa-shoe-prints',         color:'#38bdf8',
    effect:'+4% к приросту EXP от тренировок за уровень.' },
  { key:'back',  name:'Спина',    icon:'fa-person',              color:'#818cf8',
    effect:'-8% к расходу Бодрости и HP на тренировках за уровень.' },
  { key:'chest', name:'Грудь',    icon:'fa-shield-heart',       color:'#a855f7',
    effect:'+6% к доходу с работы за уровень.' },
  { key:'core',  name:'Пресс/Кор',icon:'fa-person-circle-check', color:'#f59e0b',
    effect:'-10% к потере Настроения за уровень.' },
  { key:'mode',  name:'Режим',    icon:'fa-power-off',           color:'#3ddc84',
    effect:'+10% к эффективности восстановления за уровень.' },
  { key:'mind',  name:'Разум',    icon:'fa-brain',               color:'#f472b6',
    effect:'+5% к доходу от артефакта за уровень.' },
  { key:'skin',  name:'Кожа',     icon:'fa-hand-sparkles',       color:'#fb7185',
    effect:'-7% к расходу Бодрости на отдых за уровень.' },
  { key:'spirit',name:'Дух',      icon:'fa-wand-magic-sparkles', color:'#bc13fe',
    effect:'+6% к приросту EXP от всех источников за уровень.' }
];

const MUT_TIERS = [ {cost:1}, {cost:2}, {cost:3}, {cost:4}, {cost:5} ];

const ITEM_POOL = {
  simple: [
    { id:'wraps', img:'images/items/wraps.svg', name:'Тряпичные хваты', slot:'gloves', rarity:'common', icon:'fa-mitten', exp:4, w:40 },
    { id:'cap', img:'images/items/cap.svg', name:'Кепка стримера', slot:'helmet', rarity:'common', icon:'fa-hat-cowboy', moodReduce:0.05, w:30 },
    { id:'tshirt', img:'images/items/tshirt.svg', name:'Футболка качка', slot:'torso', rarity:'common', icon:'fa-shirt', hpReduce:0.05, w:30 },
    { id:'sneakers', img:'images/items/sneakers.svg', name:'Кеды для зала', slot:'boots', rarity:'common', icon:'fa-shoe-prints', energyReduce:0.05, w:30 },
    { id:'piggy', img:'images/items/piggy.svg', name:'Копилка', slot:'artifact', rarity:'common', icon:'fa-piggy-bank', money:15, w:30 }
  ],
  elite: [
    { id:'gloves-pro', img:'images/items/gloves-pro.svg', name:'Кожаные хваты Pro', slot:'gloves', rarity:'rare', icon:'fa-mitten', exp:10, w:30 },
    { id:'game-helm', img:'images/items/game-helm.svg', name:'Геймерский шлем', slot:'helmet', rarity:'rare', icon:'fa-headset', moodReduce:0.12, w:25 },
    { id:'belt', img:'images/items/belt.svg', name:'Пояс тяжелоатлета', slot:'torso', rarity:'rare', icon:'fa-bandage', hpReduce:0.12, w:25 },
    { id:'nike', img:'images/items/nike.svg', name:'Кроссовки Nike', slot:'boots', rarity:'rare', icon:'fa-shoe-prints', energyReduce:0.12, w:25 },
    { id:'sponsor-art', img:'images/items/sponsor-art.svg', name:'Спонсорский контракт', slot:'artifact', rarity:'rare', icon:'fa-handshake', money:45, w:25 },
    { id:'expander', img:'images/items/expander.svg', name:'Эспандеры', slot:'gloves', rarity:'rare', icon:'fa-dumbbell', exp:8, w:20 }
  ],
  legendary: [
    { id:'nano-gloves', img:'images/items/nano-gloves.svg', name:'Нано-хваты Титана', slot:'gloves', rarity:'epic', icon:'fa-mitten', exp:22, w:25 },
    { id:'neuro-helm', img:'images/items/neuro-helm.svg', name:'Нейро-шлем фокуса', slot:'helmet', rarity:'epic', icon:'fa-headset', moodReduce:0.22, w:22 },
    { id:'exo-belt', img:'images/items/exo-belt.svg', name:'Экзо-пояс', slot:'torso', rarity:'epic', icon:'fa-bandage', hpReduce:0.25, w:22 },
    { id:'antigrav', img:'images/items/antigrav.svg', name:'Антиграв-ботинки', slot:'boots', rarity:'epic', icon:'fa-shoe-prints', energyReduce:0.25, w:22 },
    { id:'gold-active', img:'images/items/gold-active.svg', name:'Золотой актив', slot:'artifact', rarity:'epic', icon:'fa-gem', money:110, w:22 },
    { id:'cyber-fists', img:'images/items/cyber-fists.svg', name:'Кибер-перчатки Бога', slot:'gloves', rarity:'legendary', icon:'fa-hand-fist', exp:40, w:8 },
    { id:'crown', img:'images/items/crown.svg', name:'Корона Абсолюта', slot:'helmet', rarity:'legendary', icon:'fa-crown', moodReduce:0.40, w:8 },
    { id:'armor', img:'images/items/armor.svg', name:'Броня Абсолюта', slot:'torso', rarity:'legendary', icon:'fa-shield', hpReduce:0.45, w:8 },
    { id:'speed-boots', img:'images/items/speed-boots.svg', name:'Сапоги Скорости', slot:'boots', rarity:'legendary', icon:'fa-shoe-prints', energyReduce:0.45, w:8 },
    { id:'destiny', img:'images/items/destiny.svg', name:'Артефакт Судьбы', slot:'artifact', rarity:'legendary', icon:'fa-star', money:250, w:8 }
  ]
};

const SHOP = [
  { id:'protein', name:'Протеин', icon:'fa-mug-hot', cost:40, desc:'+20 Голод, +5 HP', apply:function(){ state.hunger=clamp(state.hunger+20); state.hp=clamp(state.hp+5); } },
  { id:'energy',  name:'Энергетик', icon:'fa-bolt', cost:50, desc:'+15 Энергия', apply:function(){ state.energy=clamp(state.energy+15); } },
  { id:'vitd',    name:'Витамин D', icon:'fa-capsules', cost:60, desc:'+15 Настроение', apply:function(){ state.mood=clamp(state.mood+15); } },
  { id:'subboost',name:'Буст подписчиков', icon:'fa-users', cost:120, desc:'+3 Канал', apply:function(){ state.channel=Math.min(999,state.channel+3); } },
  { id:'serum',   name:'Генетический серум', icon:'fa-dna', cost:300, desc:'+1 Сила (навсегда)', apply:function(){ state.attr.str+=1; } }
];

const SLOT_META = {
  helmet:{ name:'Шлем', icon:'fa-helmet-safety', ben:'Поглощает урон Настроения' },
  torso:{ name:'Торс',  icon:'fa-shirt',          ben:'Поглощает урон HP' },
  gloves:{ name:'Перчатки', icon:'fa-mitten',     ben:'+Сила (EXP)' },
  boots:{ name:'Обувь', icon:'fa-shoe-prints',           ben:'-Расход Бодрости' },
  artifact:{ name:'Артефакт', icon:'fa-star',     ben:'+Доход ₽' }
};

const AVATARS = ['fa-user-astronaut','fa-user-ninja','fa-robot','fa-dragon','fa-cat','fa-dog','fa-ghost','fa-mask','fa-gamepad','fa-headset'];

const CAB_COLORS = ['#00f3ff','#bc13fe','#3ddc84','#f59e0b','#fb7185','#38bdf8'];

const THEMES = [
  { name:'cyber',  cyan:'#00f3ff', purple:'#bc13fe' },
  { name:'toxic',  cyan:'#3ddc84', purple:'#a3e635' },
  { name:'magma',  cyan:'#f59e0b', purple:'#ef4444' },
  { name:'violet', cyan:'#a855f7', purple:'#22d3ee' }
];

const ACHIEVEMENTS = [
  { id:'first',  name:'Пробуждение', desc:'Провести первую тренировку', icon:'fa-fire', check:()=>state.stats.train>=1 },
  { id:'lvl5',   name:'Первые шаги', desc:'Достичь 5 уровня', icon:'fa-seedling', check:()=>level()>=5 },
  { id:'lvl20',  name:'Ветеран', desc:'Достичь 20 уровня', icon:'fa-medal', check:()=>level()>=20 },
  { id:'lvl50',  name:'Легенда', desc:'Достичь 50 уровня', icon:'fa-crown', check:()=>level()>=50 },
  { id:'form90', name:'Гора', desc:'Достичь формы 90 кг', icon:'fa-mountain', check:()=>state.exp>=12000 },
  { id:'form110',name:'Титан', desc:'Достичь формы 110 кг', icon:'fa-dumbbell', check:()=>state.exp>=34500 },
  { id:'mut10',  name:'Мутировавший', desc:'Купить 10 мутаций', icon:'fa-dna', check:()=>Object.values(state.mutations).reduce((a,b)=>a+b,0)>=10 },
  { id:'mut30',  name:'Генетический сбой', desc:'Купить 30 мутаций', icon:'fa-bolt', check:()=>Object.values(state.mutations).reduce((a,b)=>a+b,0)>=30 },
  { id:'rich',   name:'Магнат', desc:'Накопить 10 000 ₽', icon:'fa-sack-dollar', check:()=>state.money>=10000 },
  { id:'loot50', name:'Коллекционер', desc:'Открыть 50 лутбоксов', icon:'fa-box-open', check:()=>state.stats.loot>=50 },
  { id:'nosleep7', name:'Без сна', desc:'Сделать 7 действий подряд без сна', icon:'fa-moon', check:()=>state.stats.train+state.stats.work+state.stats.rest>=7 && !state.daily.slept },
  { id:'ironwill', name:'Железная воля', desc:'Провести 100 тренировок', icon:'fa-dumbbell', check:()=>state.stats.train>=100 },
  { id:'broadcaster', name:'Бродкастер', desc:'Поднять канал до 50', icon:'fa-satellite-dish', check:()=>state.channel>=50 }
];

const EVENTS = [
  { title:'Спонсор залетел', icon:'fa-handshake', desc:'Бренд предлагает быстрый контракт. Рискнешь потратить энергию ради денег?',
    choices:[
      { label:'Взять контракт (-20 энергии, +400 ₽)', act:function(){ state.energy=clamp(state.energy-20); state.money+=400; return 'Контракт подписан: +400 ₽'; } },
      { label:'Отказаться', act:function(){ return 'Ты отказался — спокойствие важнее.'; } }
    ] },
  { title:'Хейтеры в чате', icon:'fa-face-angry', desc:'Волна негатива бьёт по настроению. Как ответишь?',
    choices:[
      { label:'Игнорить (-5 настроения)', act:function(){ state.mood=clamp(state.mood-5); return 'Настроение слегка просело.'; } },
      { label:'Фитбэк-стрим (+10 настроения, -10 энергии)', act:function(){ state.mood=clamp(state.mood+10); state.energy=clamp(state.energy-10); return 'Стрим зарядил фанатов!'; } }
    ] },
  { title:'Вирусный клип', icon:'fa-fire', desc:'Твой момент разлетелся по сети!',
    choices:[
      { label:'Закрепить (+250 ₽, +30 EXP)', act:function(){ state.money+=250; state.exp+=30; return 'Вирал принёс славу!'; } },
      { label:'Не обращать внимания', act:function(){ return 'Шанс упущен, но ты спокоен.'; } }
    ] }
];

const TUT_STEPS = [
  { title:'Привет, стример!', body:'Это твой личный кабинет трансформации. Ты начинаешь с 61 кг, 1 уровня и 500 ₽. Цель — раскачать тело и стать Титаном (110 кг).' },
  { title:'Действия', body:'Тренировки дают EXP, но жгут Бодрость и Настроение (чем тяжелее — тем больше). Просто «спамить» тренировки не выйдет: настроение упадёт до нуля — и конец.' },
  { title:'Баланс ресурсов', body:'Сон можно взять только РАЗ в день и он лишь частично восстанавливает. За сон платится АРЕНДА (растёт с уровнем) — без работы ты не сможешь отдыхать и просядешь по настроению/HP. Чередуй тренировки, работу и отдых!' },
  { title:'Готов?', body:'Меняй тему и звук в боковой панели, следи за ачивками. Удачи на стриме!' }
];

const CLASSES = [
  { id:'body',     name:'Бодибилдер',       icon:'fa-dumbbell', desc:'+12% EXP с тренировок', color:'#00f3ff' },
  { id:'streamer', name:'Азартный стример', icon:'fa-twitch',   desc:'+18% к доходу с работы', color:'#bc13fe' },
  { id:'sci',      name:'Учёный-мутагор',   icon:'fa-flask',     desc:'+2 очка пассивок в старте', color:'#3ddc84' },
  { id:'monk',     name:'Монах дисциплины', icon:'fa-spa',       desc:'-15% потеря настроения', color:'#f59e0b' }
];

const NICHES = [
  { id:'fit',     name:'Фитнес-коуч',   icon:'fa-dumbbell', desc:'+10% EXP с тренировок', color:'#00f3ff' },
  { id:'irl',     name:'IRL / Казуал',  icon:'fa-car-side', desc:'+12% к доходу стрима', color:'#3ddc84' },
  { id:'esports', name:'Киберспорт',    icon:'fa-gamepad',   desc:'-8% затрат энергии', color:'#bc13fe' },
  { id:'asmr',    name:'ASMR / Музыка', icon:'fa-music',     desc:'+10% к восстановлению', color:'#f59e0b' }
];

const CHAT_LINES = [
  'gg wp {n}!', 'качайся {n} 💪', 'донат 50₽ от {n}_fan', '+подписка',
  'огонь 🔥', 'сколько уже вес?', 'титан грядёт', 'кеки {n}', 'погнали стрим!',
  'мутации читерские', 'лутбокс открыл?', 'красава {n}', 'скинь форму'
];

const RARITY_ORDER = ['common','rare','epic','legendary'];

const DIFFS = { easy:{exp:1.15,decay:0.8,inc:1.1}, normal:{exp:1,decay:1,inc:1}, hard:{exp:0.85,decay:1.25,inc:0.9} };

const GLYPHS = [
  { id:'g_exp', name:'Глиф Опыта', desc:'+5% EXP', exp:0.05 },
  { id:'g_inc', name:'Глиф Богатства', desc:'+5% доход', inc:0.05 },
  { id:'g_mood', name:'Глиф Души', desc:'-5% потеря настроения', mood:0.05 },
  { id:'g_str', name:'Глиф Силы', desc:'+3 к Силе', str:3 }
];

const ENDINGS = {
  titan:{ title:'ТИТАН', icon:'fa-dumbbell', text:'Ты достиг 110 кг — абсолютной формы. Легенда стриминга воплощена!' },
  tycoon:{ title:'МАГНАТ', icon:'fa-sack-dollar', text:'Капитал пробил 1 000 000 ₽. Ты построил империю.' },
  legend:{ title:'ЛЕГЕНДА', icon:'fa-crown', text:'Уровень 100 достигнут. Ты вне категорий.' }
};

const DUEL_BOTS = [
  { id:'b1', name:'ShadowLift',  power:20,  reward:300, icon:'fa-ghost',    color:'#a855f7' },
  { id:'b2', name:'IronBot',     power:45,  reward:700, icon:'fa-robot',    color:'#8aa2b8' },
  { id:'b3', name:'NeonTitan',   power:80,  reward:1500, icon:'fa-mountain', color:'#00f3ff' },
  { id:'b4', name:'VoidReaper',  power:130, reward:3000, icon:'fa-skull',    color:'#fb7185' }
];

const STORY = [
  { id:'s1', title:'Пробуждение', desc:'Достичь 5 уровня', check:()=>level()>=5, reward:()=>{ state.passPoints+=2; } },
  { id:'s2', title:'Первая форма', desc:'Достичь 90 кг (12 000 EXP)', check:()=>state.exp>=12000, reward:()=>{ state.money+=500; } },
  { id:'s3', title:'Голос народа', desc:'Поднять канал до 30', check:()=>state.channel>=30, reward:()=>{ state.exp+=1000; } },
  { id:'s4', title:'Титан эфира', desc:'Достичь 110 кг (34 500 EXP)', check:()=>state.exp>=34500, reward:()=>{ state.money+=5000; } }
];

