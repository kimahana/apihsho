import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;
// Prefer PUBLIC_BASE_URL or RENDER_EXTERNAL_URL if provided; fallback to localhost
const BASE = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

let lastAuth = null;

function gameOkEnvelope(obj) {
  const baseInfo = {
    error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0, rc: 0, ret: 0,
    error_str: '0', code_str: '0', statusCode: 0, status_code: 0, ResponseCode: 0,
    result: true, success: true, ok: true, status: 'OK', httpCode: 200,
  };
  return { ...baseInfo, ...obj };
}

app.get('/health', (req, res) => res.status(200).send('OK'));
app.head('/', (req, res) => res.redirect(302, '/health'));
app.get('/', (req, res) => res.redirect(302, '/health'));

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

async function ensureSchema() {
  if (!pool) {
    console.log('[DB] Skipped (no DATABASE_URL).');
    return;
  }
  await pool.query(`
    create table if not exists players(
      id text primary key,
      name text,
      created_at timestamptz default now()
    );
  `);
  await pool.query(`
    create table if not exists sessions(
      session_id text primary key,
      player_id text references players(id) on delete cascade,
      created_at timestamptz default now()
    );
  `);
  console.log('[DB] Schema ensured.');
}

function safeIdFromTicket(ticket) {
  const hex = String(ticket || '');
  const head = hex.slice(0, 16);
  let num = 0n;
  try { num = BigInt('0x' + head); } catch (e) { num = 0n; }
  return 'p_' + (num % 0xffffffffffffffffn).toString(16).padStart(16, '0').slice(-8);
}

app.post('/live/player/authen', async (req, res) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const ticket = req.body?.ticket || '';
  const authType = req.body?.authType || 'steam';

  const playerId = (() => {
    const m = ticket.match(/\\b(7656\\d{11,})\\b/);
    return m ? m[1] : safeIdFromTicket(ticket);
  })();

  const token = (global.crypto?.randomUUID?.() || `${nowSec}-${Math.random()}`).replace(/-/g, '');

  if (pool) {
    try {
      await pool.query(
        `insert into players(id, name) values($1, $2)
         on conflict (id) do update set name = excluded.name`,
        [playerId, `Player_${playerId.slice(-6)}`]
      );
      await pool.query(
        `insert into sessions(session_id, player_id) values($1, $2)
         on conflict (session_id) do nothing`,
        [token, playerId]
      );
    } catch (e) {
      console.warn('DB write skipped:', e.message);
    }
  }

  const baseUrl = BASE;

  const payload = gameOkEnvelope({
    message: authType === 'steam' ? 'auth success' : 'OK',
    playerId, uid: playerId, userId: playerId, id: playerId, steamId: playerId,
    token, access_token: token, accessToken: token, 'access-token': token,
    sessionKey: token, session_token: token, sessionId: token, session_id: token, session: token, sid: token,
    ticket, authType,
    clientversion: req.body?.clientversion, clientVersion: req.body?.clientversion, version: req.body?.clientversion,
    expires: nowSec + 86400, expiresIn: 86400, serverTime: nowSec,
    baseUrl: baseUrl, base_url: baseUrl, api_base: baseUrl, server_url: baseUrl, host: baseUrl,
    server: { api: baseUrl, base: baseUrl, time: nowSec, region: 'sg' },
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
    next: '/live/player/get',
    redirect: '/live/player/get',
    user: {
      id: playerId, uid: playerId, userId: playerId, playerId, steamId: playerId,
      name: `Player_${playerId.slice(-6)}`,
      token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token,
    },
    profile: { level: 1, exp: 0, role: 'Survivor', rank: { name: 'Bronze', point: 0, mmr: 0 }, balance: { coin: 0, gem: 0 }, lootbox: { balance: 0 } },
    response: { params: { result: 'OK', steamid: playerId, playerid: playerId, token }, error: null }
  });

  lastAuth = { request: { headers: req.headers, body: req.body }, response: payload, steam: null };
  res.json(payload);
});

app.get('/__debug/authen', (req, res) => {
  if (!lastAuth) return res.json({ note: 'no auth yet' });
  res.json(lastAuth);
});

ensureSchema().then(() => {
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}).catch(e => {
  console.error('Schema init error', e);
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
});
