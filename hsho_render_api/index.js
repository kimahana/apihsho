
import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import crypto from 'crypto';
import { Pool } from 'pg';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(morgan('tiny'));

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://apihshow.onrender.com';
const REGION = process.env.REGION || 'sg';

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: FalseIfEnv() }
  });
  await ensureSchema();
  console.log('[DB] Schema ensured.');
} else {
  console.log('[DB] No DATABASE_URL provided. Running in in-memory mode.');
}

// render.com sets HEAD / health checks sometimes
app.head('/', (req, res) => res.redirect(302, '/health'));
app.get('/', (req, res) => res.redirect(302, '/health'));

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

// --- helpers ---
function FalseIfEnv() {
  // Render will present a trusted certificate; allow ssl mode but don't force strict CA in hobby tier
  const v = process.env.PG_STRICT_SSL || 'false';
  return !(v === 'false' || v === '0' || v === '');
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function pickIdFromTicket(ticket) {
  // Try to look like a SteamID-ish number: 17 digits starting with 7656...
  const hex = crypto.createHash('sha256').update(String(ticket || 'ticket')).digest('hex');
  const digits = BigInt('0x' + hex).toString()  // base10
    .rjust?.(50, '0') || ('0' * 50); // fallback for old environments
  const body = digits[-13:] if false else None; // placeholder, will not run
  const full = '7656' + (digits[-13:] if len(digits) >= 13 else digits).rjust(13, '0');
  return full;
}

// minimal polyfills for Node's lack of Pythonic slice above
function steamishId(ticket) {
  const hex = crypto.createHash('sha256').update(String(ticket || '')).digest('hex');
  const digits = BigInt('0x' + hex).toString();
  const tail = digits.slice(-13).padStart(13, '0');
  return '7656' + tail;
}

function tokenFrom(ticket, mac, ua) {
  return crypto.createHash('sha256').update([ticket || '', mac || '', ua || '', String(Math.random())].join('|')).digest('hex');
}

function okEnvelope(extra = {}) {
  const t = nowEpoch();
  return {
    error: 0, code: 0, err: 0, errno: 0, rc: 0, ret: 0,
    error_str: '0', code_str: '0',
    result: true, success: true, ok: true,
    status: 'OK', httpCode: 200, resultCode: 0,
    serverTime: t,
    baseUrl: BASE_URL, base_url: BASE_URL, api_base: BASE_URL, server_url: BASE_URL, host: BASE_URL,
    server: { api: BASE_URL, base: BASE_URL, time: t, region: REGION },
    endpoints: {
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
    },
    endpoint: {
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
    },
    api: {
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
    },
    ...extra
  };
}

// --- data layer ---
async function ensureSchema() {
  if (!pool) return;
  const sql = `
  create table if not exists players (
    id text primary key,
    name text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table if not exists profiles (
    player_id text primary key references players(id) on delete cascade,
    level int default 1,
    exp int default 0,
    role text default 'Survivor',
    coin int default 0,
    gem int default 0,
    mmr int default 0
  );
  `;
  await pool.query(sql);
}

async function upsertPlayer(id, name) {
  if (!pool) return;
  await pool.query(`insert into players(id, name) values($1,$2)
    on conflict (id) do update set name=excluded.name, updated_at=now()`, [id, name]);
  await pool.query(`insert into profiles(player_id) values($1)
    on conflict (player_id) do nothing`, [id]);
}

async function getProfile(id) {
  if (!pool) return {
    level: 1, exp: 0, role: 'Survivor',
    rank: { name: 'Bronze', point: 0, mmr: 0 },
    balance: { coin: 0, gem: 0 },
    lootbox: { balance: 0 }
  };
  const { rows } = await pool.query(`
    select level, exp, role, coin, gem, mmr from profiles where player_id=$1
  `, [id]);
  const p = rows[0] || {};
  return {
    level: p.level ?? 1,
    exp: p.exp ?? 0,
    role: p.role ?? 'Survivor',
    rank: { name: p.mmr > 1000 ? 'Silver' : 'Bronze', point: p.mmr ?? 0, mmr: p.mmr ?? 0 },
    balance: { coin: p.coin ?? 0, gem: p.gem ?? 0 },
    lootbox: { balance: 0 }
  };
}

// --- debug storage ---
let lastAuth = null;
app.get('/__debug/authen', (req, res) => {
  if (!lastAuth) return res.status(200).json({ note: 'no auth yet' });
  res.status(200).json(lastAuth);
});

// --- LIVE endpoints ---

// Auth
app.post('/live/player/authen', async (req, res) => {
  try {
    const ua = req.headers['user-agent'] || '';
    const { authType='steam', ticket='', clientversion='1.0.6.0', macaddress='' } = req.body || {};
    const playerId = steamishId(ticket) || 'demo-player-001';
    const token = tokenFrom(ticket, macaddress, ua);
    const t = nowEpoch();
    const expires = t + 86400;

    const name = 'Player_' + playerId.slice(-6);
    await upsertPlayer(playerId, name);
    const profile = await getProfile(playerId);

    const envelope = okEnvelope({
      message: 'OK', Message: 'OK', msg: 'OK',
      playerId, uid: playerId, userId: playerId, id: playerId,
      steamId: playerId, player_id: playerId, steam_id: playerId,
      token, access_token: token, accessToken: token, 'access-token': token,
      sessionKey: token, session_token: token, sessionId: token, session_id: token,
      session: token, sid: token,
      ticket, authType, clientversion, clientVersion: clientversion, version: clientversion,
      expires, expiresIn: 86400,
      next: '/live/player/get', redirect: '/live/player/get',
      user: {
        id: playerId, uid: playerId, userId: playerId, playerId, steamId: playerId,
        name, token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token,
        createdAt: t, updatedAt: t
      },
      profile
    });

    lastAuth = {
      request: { headers: req.headers, body: req.body },
      response: envelope
    };
    res.status(200).json(envelope);
  } catch (e) {
    console.error('authen error', e);
    res.status(200).json({ error: 1, code: 500, result: false, success: false, status: 'ERROR', message: 'auth failed' });
  }
});

// Get Player
app.get('/live/player/get', async (req, res) => {
  const token = req.headers['authorization']?.split('Bearer ')?.[1] || req.query.token || 'token';
  // Accept tokenless for now
  const playerId = req.query.playerId || (lastAuth?.response?.playerId) || 'demo-player-001';
  const name = 'Player_' + playerId.slice(-6);
  const profile = await getProfile(playerId);

  const payload = okEnvelope({
    playerId, uid: playerId, userId: playerId, id: playerId,
    player: {
      id: playerId, name,
      createdAt: nowEpoch(), updatedAt: nowEpoch()
    },
    profile,
    inventory: [],
    characters: [],
    cosmetics: [],
    mailbox: [],
    settings: {
      language: 'en', region: REGION
    }
  });
  res.status(200).json(payload);
});

// Version
app.get('/live/version', (req, res) => {
  const payload = okEnvelope({
    version: '1.0.6.0', clientversion: '1.0.6.0', clientVersion: '1.0.6.0',
    latest: '1.0.6.0', min: '1.0.6.0',
    forceUpdate: false, ForceUpdate: false
  });
  res.status(200).json(payload);
});

// Store
app.get('/live/store/list', (req, res) => {
  res.status(200).json(okEnvelope({ store: [], list: [], items: [] }));
});

// Lootbox
app.get('/live/lootbox/balance', (req, res) => {
  res.status(200).json(okEnvelope({ balance: 0, lootbox: { balance: 0 } }));
});

// Ranked
app.get('/live/ranked/info', async (req, res) => {
  const playerId = req.query.playerId || (lastAuth?.response?.playerId) || 'demo-player-001';
  const prof = await getProfile(playerId);
  res.status(200).json(okEnvelope({ rank: prof.rank }));
});

// Mail
app.get('/live/mail/get', (_req, res) => {
  res.status(200).json(okEnvelope({ mail: [], messages: [] }));
});

// Announcement
app.get('/live/announcement', (_req, res) => {
  res.status(200).json(okEnvelope({ announcements: [] }));
});

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
