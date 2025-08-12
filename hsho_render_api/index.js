
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://apihshow.onrender.com';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_STRICT_SSL === 'true' ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
});

async function ensureSchema() {
  const sql = `
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT,
    steamid TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    player_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS profiles (
    player_id TEXT PRIMARY KEY,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    role TEXT DEFAULT 'Survivor',
    coin INTEGER DEFAULT 0,
    gem INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  `;
  await pool.query(sql);

  // Make sure columns exist even if an older table was created differently
  await pool.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='id') THEN ALTER TABLE players ADD COLUMN id TEXT; END IF; END $$;");
  await pool.query("UPDATE players SET id = COALESCE(id, steamid) WHERE id IS NULL;");

  console.log('[DB] Schema ensured.');
}

function randToken(len = 64) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// root -> health (for Render HEAD /)
app.get('/', (_req, res) => res.redirect(302, '/health'));
app.head('/', (_req, res) => res.status(404).json({ error: 'not found' }));

let lastAuth = null;

// debug dump
app.get('/__debug/authen', (_req, res) => {
  if (!lastAuth) return res.status(200).json({ empty: true });
  res.json(lastAuth);
});

// Auth endpoint
app.post('/live/player/authen', async (req, res) => {
  try {
    const body = req.body || {};
    const ticket = String(body.ticket || '');
    const mac = String(body.macaddress || '');
    const userAgent = String(req.headers['user-agent'] || '');

    // Create a deterministic id for same ticket within the day, otherwise random
    const seed = ticket || (mac + userAgent);
    const hash = crypto.createHash('sha256').update(seed || Date.now().toString()).digest('hex');
    const playerId = (seed ? '7656' : 'p_') + hash.slice(-14);

    const token = randToken(64);

    // upsert player
    await pool.query(
      `INSERT INTO players (id, name, steamid) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET updated_at=now()`,
      [playerId, 'Player_' + playerId.slice(-6), playerId]
    );
    await pool.query(
      `INSERT INTO profiles (player_id) VALUES ($1)
       ON CONFLICT (player_id) DO NOTHING`,
      [playerId]
    );
    await pool.query(
      `INSERT INTO sessions (token, player_id) VALUES ($1,$2)
       ON CONFLICT (token) DO UPDATE SET player_id=EXCLUDED.player_id`,
      [token, playerId]
    );

    const base = BASE_URL;

    const payload = {
      error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0,
      rc: 0, ret: 0, error_str: '0', code_str: '0',
      statusCode: 0, status_code: 0, ResponseCode: 0,
      result: true, success: true, ok: true, status: 'OK',
      httpCode: 200, resultCode: 0,
      message: 'OK', Message: 'OK', msg: 'OK',
      playerId: playerId, uid: playerId, userId: playerId, id: playerId,
      steamId: playerId, player_id: playerId, steam_id: playerId,
      token, access_token: token, accessToken: token, 'access-token': token,
      sessionKey: token, session_token: token, sessionId: token, session_id: token, session: token, sid: token,
      ticket,
      authType: body.authType || 'steam',
      clientversion: body.clientversion || '1.0.6.0',
      clientVersion: body.clientversion || '1.0.6.0',
      version: body.clientversion || '1.0.6.0',
      expires: Math.floor(Date.now()/1000) + 86400,
      expiresIn: 86400,
      serverTime: Math.floor(Date.now()/1000),
      baseUrl: base, base_url: base, api_base: base, server_url: base, host: base,
      server: { api: base, base, time: Math.floor(Date.now()/1000), region: 'sg' },
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
        name: 'Player_' + playerId.slice(-6),
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
      }
    };

    lastAuth = {
      request: { headers: req.headers, body },
      response: payload
    };

    res.json(payload);
  } catch (err) {
    console.error('[authen] error', err);
    res.status(500).json({ error: 1, message: String(err.message || err) });
  }
});

// Player get
app.get('/live/player/get', async (req, res) => {
  try {
    const token = String(req.headers['x-auth-token'] || req.query.token || '');
    let pid = null;
    if (token) {
      const { rows } = await pool.query('SELECT player_id FROM sessions WHERE token=$1', [token]);
      pid = rows[0]?.player_id || null;
    }
    if (!pid) {
      // fallback to lastAuth
      pid = lastAuth?.response?.playerId || 'demo-player-001';
    }
    const { rows: prow } = await pool.query('SELECT * FROM profiles WHERE player_id=$1', [pid]);
    const profile = prow[0] || { player_id: pid, level: 1, exp: 0, role: 'Survivor', coin: 0, gem: 0 };
    res.json({
      error: 0, result: true, status: 'OK',
      playerId: pid, profile: {
        level: profile.level || 1,
        exp: profile.exp || 0,
        role: profile.role || 'Survivor',
        balance: { coin: profile.coin || 0, gem: profile.gem || 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 1, message: String(err.message || err) });
  }
});

// stubs
app.get('/live/store/list', (_req, res) => res.json({ error: 0, result: true, items: [] }));
app.get('/live/lootbox/balance', (_req, res) => res.json({ error: 0, balance: 0 }));
app.get('/live/ranked/info', (_req, res) => res.json({ error: 0, rank: { name: 'Bronze', point: 0, mmr: 0 } }));
app.get('/live/mail/get', (_req, res) => res.json({ error: 0, mails: [] }));
app.get('/live/announcement', (_req, res) => res.json({ error: 0, list: [] }));
app.get('/live/version', (_req, res) => res.json({ error: 0, version: '1.0.6.0' }));

(async () => {
  try {
    await ensureSchema();
    app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
