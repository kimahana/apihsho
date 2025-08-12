import express from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 10000;
const BASE = process.env.PUBLIC_BASE_URL || 'https://apihshow.onrender.com';
const DATABASE_URL = process.env.DATABASE_URL || '';

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

async function ensureSchema() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        steam_id TEXT UNIQUE,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
        token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS players_steam_id_idx ON players(steam_id);`);
    await client.query('COMMIT');
    console.log('[DB] Schema ensured.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Schema error', e);
    throw e;
  } finally {
    client.release();
  }
}

let lastAuth = { note: 'no auth yet' };

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/', (req, res) => res.redirect(302, '/health'));

app.get('/__debug/authen', (req, res) => {
  res.status(200).json(lastAuth);
});

function tsNow() {
  return Math.floor(Date.now() / 1000);
}

function randHex(n=32) {
  return crypto.randomBytes(n).toString('hex');
}

function tokenFromTicket(ticket) {
  const h = crypto.createHash('sha256').update(String(ticket || randHex(8))).digest('hex');
  return h;
}

function playerFromTicket(ticket) {
  // Try to make a 17-digit looking id from the hash (to resemble a SteamID-like format)
  const hex = crypto.createHash('sha256').update(String(ticket || randHex(8))).digest('hex');
  // Convert part of hex to int and keep 17 digits
  const num = BigInt('0x' + hex[:16]);
  const id = str(num)[-17:];
  return id.rjust(17, '0');
}

app.post('/live/player/authen', async (req, res) => {
  const body = req.body || {};
  const ticket = body.ticket || randHex(8);
  const playerId = playerFromTicket(ticket);
  const token = tokenFromTicket(ticket);
  const now = tsNow();
  const expires = now + 86400;

  // Build response object
  const payload = {
    error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0, rc: 0, ret: 0,
    error_str: "0", code_str: "0", statusCode: 0, status_code: 0, ResponseCode: 0,
    result: true, success: true, ok: true, status: "OK", httpCode: 200, resultCode: 0,
    message: "OK", Message: "OK", msg: "OK",

    playerId: playerId, uid: playerId, userId: playerId, id: playerId,
    steamId: playerId, player_id: playerId, steam_id: playerId,

    token, access_token: token, accessToken: token, 'access-token': token,
    sessionKey: token, session_token: token, sessionId: token, session_id: token, session: token, sid: token,

    ticket, authType: body.authType || 'steam',
    clientversion: body.clientversion || '1.0.6.0', clientVersion: body.clientversion || '1.0.6.0', version: body.clientversion || '1.0.6.0',

    expires, expiresIn: 86400, serverTime: now,

    baseUrl: BASE, base_url: BASE, api_base: BASE, server_url: BASE, host: BASE,
    server: { api: BASE, base: BASE, time: now, region: 'sg' },

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
    next: '/live/player/get',
    redirect: '/live/player/get',
    user: {
      id: playerId, uid: playerId, userId: playerId, playerId: playerId, steamId: playerId,
      name: 'Player_' + playerId[-6:],
      token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token
    },
    profile: {
      level: 1, exp: 0, role: 'Survivor',
      rank: { name: 'Bronze', point: 0, mmr: 0 },
      balance: { coin: 0, gem: 0 },
      lootbox: { balance: 0 }
    },
    response: {
      params: { result: 'OK', steamid: playerId, playerid: playerId, token },
      error: null
    },
    data: {} // filled below for duplication
  };
  payload.data = JSON.parse(JSON.stringify(payload));

  // Persist if DB present
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO players (id, steam_id, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET steam_id = EXCLUDED.steam_id, name = EXCLUDED.name, updated_at = NOW()`,
          [playerId, playerId, 'Player_' + playerId.slice(-6)]
        );
        await client.query(
          `INSERT INTO sessions (session_id, player_id, token, expires_at)
           VALUES ($1, $2, $3, to_timestamp($4))
           ON CONFLICT (session_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
          [token, playerId, token, expires]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('authen error', e);
        // Do NOT fail the response to the game; just proceed without DB
      } finally {
        client.release();
      }
    } catch {}
  }

  lastAuth = { request: { headers: req.headers, body }, response: payload };
  res.status(200).json(payload);
});

// Minimal placeholders for other endpoints so the client doesn't 404 hard (optional)
app.get('/live/player/get', (req, res) => {
  res.json({ error: 0, status: 'OK', result: true, player: { id: 'me' } });
});

// Start
ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on :${PORT}`);
    });
  })
  .catch((e) => {
    console.error(e);
    // still start server without DB
    app.listen(PORT, () => {
      console.log(`Server listening (no DB) on :${PORT}`);
    });
  });
