/* =========================================================
   api/lb.js — global leaderboard endpoint (zero-dependency)
   Storage: Vercel KV (Upstash REST), env vars auto-injected:
     KV_REST_API_URL, KV_REST_API_TOKEN
   GET              -> { top:[{name,exp,lvl,kg}], found:{...,rank}|null }
   POST {name,exp}  -> upsert player score (keyed by nick)
   ========================================================= */

/* stage thresholds duplicated from data.js (serverless has no DOM bundle) */
const STAGE_MIN = [0,750,1600,3000,4600,6500,9000,12000,15500,19500,24000,29000,34500];
const STAGE_KG  = ['61','66','70','75','79','82','86','90','94','98','102','106','110'];

module.exports = async function handler(req, res){
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if(!url || !token){ res.status(503).json({ error:'leaderboard unavailable' }); return; }

  async function redis(cmd){
    const r = await fetch(url, {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
      body: JSON.stringify(cmd)
    });
    const d = await r.json();
    if(d.error) throw new Error(d.error);
    return d.result;
  }
  function cleanName(s){
    s = String(s == null ? '' : s).trim().slice(0, 18);
    return /^[\wа-яА-ЯёЁ\-. ]{1,18}$/u.test(s) ? s : null;
  }
  function row(name, exp){
    exp = Math.max(0, Math.min(50000000, Math.floor(Number(exp) || 0)));
    let kg = '61';
    for(let i = STAGE_MIN.length - 1; i >= 0; i--){
      if(exp >= STAGE_MIN[i]){ kg = STAGE_KG[i]; break; }
    }
    return { name:name, exp:exp, lvl:Math.floor(exp/150)+1, kg:kg };
  }

  try{
    if(req.method === 'POST'){
      let body = '';
      req.on('data', c => { body += c; });
      await new Promise(r => req.on('end', r));
      let j = {};
      try{ j = JSON.parse(body || '{}'); }catch(e){}
      const name = cleanName(j.name);
      if(!name){ res.status(400).json({ error:'bad name' }); return; }
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
      const fresh = await redis(['SET', 'rl:'+ip, '1', 'EX', '10', 'NX']);
      if(fresh !== 'OK'){ res.status(429).json({ error:'too many requests' }); return; }
      const e = row(name, j.exp);
      await redis(['ZADD', 'lb', String(e.exp), name]);
      res.status(200).json({ ok:true });
      return;
    }

    /* GET */
    const raw = await redis(['ZREVRANGE', 'lb', 0, 19, 'WITHSCORES']);
    const top = [];
    for(let i = 0; i < raw.length; i += 2) top.push(row(raw[i], Number(raw[i+1])));
    let found = null;
    const q = cleanName(new URL(req.url, 'http://localhost').searchParams.get('name'));
    if(q){
      const sc = await redis(['ZSCORE', 'lb', q]);
      if(sc !== null && sc !== undefined){
        const rk = await redis(['ZREVRANK', 'lb', q]);
        found = Object.assign(row(q, Number(sc)), { rank: (rk === null ? null : rk + 1) });
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ top:top, found:found });
  }catch(err){
    res.status(500).json({ error:'internal' });
  }
};
