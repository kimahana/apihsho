import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// -------------------- helpers --------------------
const STATE = {
  lastAuth: null,
  players: new Map(), // token -> player payload
};

const BASE_URL = 'https://apihshow.onrender.com';

const FLAGS_OK = {
  error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0, rc: 0, ret: 0,
  error_str: '0', code_str: '0', statusCode: 0, status_code: 0, ResponseCode: 0,
  result: true, success: true, ok: true, status: 'OK', httpCode: 200, resultCode: 0,
  message: 'OK', Message: 'OK', msg: 'OK'
};

const ENDPOINTS = {
  getPlayer: '/live/player/get',
  playerGet: '/live/player/get',
  player: '/live/player/get',
  storeList: '/live/store/list',
  store_list: '/live/store/list',
  lootbox: '/live/lootbox/balance',
  ranked: '/live/ranked/info',
  mailbox: '/live/mail/get',
  announcement: '/live/announcement',
  version: '/live/version'
};

function nowTs(){ return Math.floor(Date.now()/1000); }
function expTs(){ return nowTs() + 86400; }
function v(obj, keys, d){ for (const k of keys){ if (obj && obj[k] != null) return obj[k]; } return d; }
function makeSteam64(ticket){
  const base = BigInt('76561197960265728');
  const h = crypto.createHash('sha256').update(String(ticket||'')).digest('hex');
  const v64 = BigInt('0x' + h.substring(0,16));
  return (base + (v64 % BigInt(10_000_000_000))).toString();
}

function enrich(base){
  // Mirror a "data" object and add Steam-like response wrapper
  const full = {
    ...FLAGS_OK,
    ...base,
    data: { ...FLAGS_OK, ...base },
    response: { params: { result: 'OK', steamid: base.steamId, playerid: base.playerId, token: base.token }, error: null }
  };
  return full;
}

function authPayload(body){
  const ticket = v(body, ['ticket','authTicket','access_ticket'], '');
  const clientVersion = v(body, ['clientversion','clientVersion','version'],'1.0.6.0');
  const id64 = makeSteam64(ticket);
  const token = crypto.createHash('sha256').update(id64 + ':' + nowTs()).digest('hex');

  const user = {
    id: id64, uid: id64, userId: id64, playerId: id64, steamId: id64,
    name: `Player_${id64.slice(-6)}`,
    token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token
  };
  const server = { api: BASE_URL, base: BASE_URL, time: nowTs(), region: 'sg' };

  const base = {
    playerId: id64, uid: id64, userId: id64, id: id64, steamId: id64,
    player_id: id64, steam_id: id64,
    token, access_token: token, accessToken: token, 'access-token': token,
    sessionKey: token, session_token: token, sessionId: token, session_id: token, session: token, sid: token,
    ticket: ticket, authType: v(body, ['authType'], 'steam'),
    clientversion: clientVersion, clientVersion, version: clientVersion,
    expires: expTs(), expiresIn: 86400, serverTime: nowTs(),
    baseUrl: BASE_URL, base_url: BASE_URL, api_base: BASE_URL, server_url: BASE_URL, host: BASE_URL,
    server,
    endpoints: ENDPOINTS, endpoint: ENDPOINTS, api: ENDPOINTS,
    next: '/live/player/get', redirect: '/live/player/get',
    user,
    profile: { level: 1, exp: 0, role: 'Survivor', rank: { name: 'Bronze', point: 0, mmr: 0 },
               balance: { coin: 0, gem: 0 }, lootbox: { balance: 0 } }
  };

  return enrich(base);
}

// -------------------- debug --------------------
router.get('/__debug/authen', (req,res)=>{
  if (!STATE.lastAuth) return res.json({});
  res.json(STATE.lastAuth);
});

// -------------------- auth --------------------
router.post(['/live/player/authen','/player/authen','/api/player/authen'], (req,res)=>{
  const body = req.body || {};
  const payload = authPayload(body);
  STATE.lastAuth = { request: { headers: req.headers, body }, response: payload };
  // keep a map for subsequent /player/get
  STATE.players.set(payload.token, payload);
  res.json(payload);
});

// -------------------- player/get --------------------
function getCurrent(ctx){
  // accept token via header (Authorization: Bearer/Basic ignored), query, or from lastAuth
  const q = ctx.query || {};
  const b = ctx.body || {};
  const token = v(q, ['token'], v(b, ['token','access_token','sessionKey'], v(ctx.headers, ['x-auth-token','authorization'], null)));
  if (token && typeof token === 'string' && STATE.players.has(token)){
    return STATE.players.get(token);
  }
  // fallback to last auth
  if (STATE.lastAuth && STATE.lastAuth.response) return STATE.lastAuth.response;
  return null;
}

router.all(['/live/player/get','/player/get','/api/player/get'], (req,res)=>{
  const auth = getCurrent(req);
  if (!auth){
    return res.status(200).json({ ...FLAGS_OK, result: false, success: false, message: 'no session', error: 1, code: 1 });
  }
  const id = auth.playerId;
  const token = auth.token;

  const result = enrich({
    ...auth,
    message: 'player loaded',
    user: { ...auth.user },
    profile: auth.profile,
    // minimal but safe containers
    inventory: { items: [], skins: [], emotes: [], charms: [], perks: [], characters: [] },
    characters: { survivors: ['sv_001'], specters: ['sp_001'] },
    balance: { coin: 0, gem: 0 },
    lootbox: { balance: 0 },
    settings: { language: 'en', region: 'sg' },
    next: '/live/store/list',
  });

  res.json(result);
});

// -------------------- store/list --------------------
router.all(['/live/store/list','/store/list','/api/store/list'], (req,res)=>{
  const auth = getCurrent(req) || {};
  const result = enrich({
    ...auth,
    message: 'store list',
    store: [
      { id: 'pack_starter', type: 'bundle', price: { gem: 0, coin: 0 }, items: [] },
      { id: 'cos_basic', type: 'cosmetic', price: { gem: 0, coin: 0 }, items: [] }
    ],
    next: '/live/lootbox/balance'
  });
  res.json(result);
});

// -------------------- lootbox/balance --------------------
router.all(['/live/lootbox/balance','/lootbox/balance','/api/lootbox/balance'], (req,res)=>{
  const auth = getCurrent(req) || {};
  const result = enrich({
    ...auth,
    message: 'lootbox balance',
    lootbox: { balance: 0 }
  });
  res.json(result);
});

// -------------------- ranked/info --------------------
router.all(['/live/ranked/info','/ranked/info','/api/ranked/info'], (req,res)=>{
  const auth = getCurrent(req) || {};
  const result = enrich({
    ...auth,
    message: 'ranked info',
    ranked: { tier: 'Bronze', mmr: 0, win: 0, lose: 0, draw: 0 }
  });
  res.json(result);
});

// -------------------- mailbox/get --------------------
router.all(['/live/mail/get','/mail/get','/api/mail/get'], (req,res)=>{
  const auth = getCurrent(req) || {};
  const result = enrich({
    ...auth,
    message: 'mailbox',
    mailbox: []
  });
  res.json(result);
});

// -------------------- announcement --------------------
router.all(['/live/announcement','/announcement','/api/announcement'], (req,res)=>{
  const auth = getCurrent(req) || {};
  const result = enrich({
    ...auth,
    message: 'announcement',
    announcement: []
  });
  res.json(result);
});

// -------------------- version --------------------
router.all(['/live/version','/version','/api/version'], (req,res)=>{
  const auth = getCurrent(req) || { clientversion: '1.0.6.0' };
  const result = enrich({
    ...auth,
    message: 'version',
    version: auth.version || auth.clientversion || '1.0.6.0',
    force: false,
    maintenance: false
  });
  res.json(result);
});

export default router;
