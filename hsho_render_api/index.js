import express from "express";
import cors from "cors";
import morgan from "morgan";
import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";
const BASE = process.env.PUBLIC_BASE_URL || "https://apihshow.onrender.com";
const DATABASE_URL = process.env.DATABASE_URL || "";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

let pool = null;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5
  });
}

async function ensureSchema() {
  if (!pool) {
    console.log("[DB] Skipped (no DATABASE_URL)");
    return;
  }
  const sql = `
  BEGIN;

  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    steam_id  TEXT UNIQUE,
    name      TEXT,
    token     TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Make sure columns exist even if old table is present
  ALTER TABLE players ADD COLUMN IF NOT EXISTS steam_id TEXT;
  ALTER TABLE players ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE players ADD COLUMN IF NOT EXISTS token TEXT;
  ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
  ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'players_steam_id_idx' AND n.nspname = 'public'
    ) THEN
      CREATE UNIQUE INDEX players_steam_id_idx ON players(steam_id);
    END IF;
  END $$;

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    player_id  TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS profiles (
    player_id TEXT PRIMARY KEY,
    level INT DEFAULT 1,
    exp   INT DEFAULT 0,
    role  TEXT DEFAULT 'Survivor',
    coin  INT DEFAULT 0,
    gem   INT DEFAULT 0,
    lootbox_balance INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  COMMIT;`;
  await pool.query(sql);
  console.log("[DB] Schema ensured.");
}

function hex(n) {
  return crypto.randomBytes(n).toString("hex");
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function makePlayerId(ticket) {
  // Stable-ish ID: use first 8 bytes of sha256(ticket)
  const h = sha256Hex(ticket || hex(8));
  return "p_" + h.slice(0, 16);
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function ttl(seconds) {
  return nowEpoch() + seconds;
}

let lastAuthDebug = null;

app.get("/", (req, res) => res.redirect(302, "/health"));
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/__debug/authen", (req, res) => {
  if (!lastAuthDebug) return res.status(200).json({ note: "no auth yet" });
  res.status(200).json(lastAuthDebug);
});

app.post("/live/player/authen", async (req, res) => {
  try {
    const body = req.body || {};
    const ticket = String(body.ticket || "");
    const authType = String(body.authType || body.authtype || "steam");
    const clientVersion = String(body.clientversion || body.clientVersion || "1.0.6.0");

    // Derive IDs/tokens
    const playerId = makePlayerId(ticket);
    const steamId = playerId; // mirror for compatibility
    const token = sha256Hex(playerId + ":" + nowEpoch());
    const session = token;

    const serverTime = nowEpoch();
    const expires = ttl(24 * 60 * 60);

    // Persist minimal data
    if (pool) {
      await pool.query(
        `INSERT INTO players (player_id, steam_id, name, token, updated_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (player_id) DO UPDATE
         SET steam_id = EXCLUDED.steam_id,
             name = EXCLUDED.name,
             token = EXCLUDED.token,
             updated_at = now()`,
        [playerId, steamId, `Player_${playerId.slice(-6)}`, token]
      );

      await pool.query(
        `INSERT INTO profiles (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
        [playerId]
      );

      await pool.query(
        `INSERT INTO sessions (session_id, player_id, created_at, expires_at)
         VALUES ($1,$2,now(), to_timestamp($3)) ON CONFLICT (session_id) DO NOTHING`,
        [session, playerId, expires]
      );
    }

    const base = BASE;
    const endpoints = {
      getPlayer: "/live/player/get",
      playerGet: "/live/player/get",
      player: "/live/player/get",
      storeList: "/live/store/list",
      store_list: "/live/store/list",
      lootbox: "/live/lootbox/balance",
      ranked: "/live/ranked/info",
      mailbox: "/live/mail/get",
      announcement: "/live/announcement",
      version: "/live/version"
    };

    const payload = {
      error: 0, code: 0, err: 0, errno: 0, Error: 0, ErrorCode: 0,
      rc: 0, ret: 0, error_str: "0", code_str: "0",
      result: true, success: true, ok: true, status: "OK",
      httpCode: 200, resultCode: 0,
      message: "OK", Message: "OK", msg: "OK",
      playerId, uid: playerId, userId: playerId, id: playerId,
      steamId, player_id: playerId, steam_id: steamId,
      token, access_token: token, accessToken: token, "access-token": token,
      sessionKey: token, session_token: token, sessionId: token, session_id: token, session: token, sid: token,
      ticket,
      authType,
      clientversion: clientVersion, clientVersion, version: clientVersion,
      expires, expiresIn: 86400,
      serverTime: serverTime,
      baseUrl: base, base_url: base, api_base: base, server_url: base, host: base,
      server: { api: base, base, time: serverTime, region: "sg" },
      endpoints, endpoint: endpoints, api: endpoints,
      next: "/live/player/get", redirect: "/live/player/get",
      user: {
        id: playerId, uid: playerId, userId: playerId, playerId, steamId,
        name: `Player_${playerId.slice(-6)}`,
        token, access_token: token, sessionKey: token, session_token: token, sessionId: token, session_id: token
      },
      profile: {
        level: 1, exp: 0, role: "Survivor",
        rank: { name: "Bronze", point: 0, mmr: 0 },
        balance: { coin: 0, gem: 0 },
        lootbox: { balance: 0 }
      },
      response: {
        params: { result: "OK", steamid: playerId, playerid: playerId, token },
        error: null
      }
    };

    lastAuthDebug = { request: { headers: req.headers, body }, response: payload };

    res.json(payload);
  } catch (e) {
    console.error("authen error", e);
    res.status(200).json({
      error: 0, code: 0, result: true, success: true, status: "OK",
      message: "auth fallback ok",
      next: "/live/player/get"
    });
  }
});

function requireToken(req) {
  const auth = req.headers["authorization"] || "";
  const m = auth.startsWith("Bearer ") ? auth.slice(7) : (auth.split(" ").pop() || "");
  return m || (req.query.token || req.body?.token || "");
}

app.get("/live/player/get", async (req, res) => {
  const token = requireToken(req);
  let playerId = null;
  if (pool && token) {
    try {
      const { rows } = await pool.query(`SELECT player_id FROM players WHERE token=$1`, [token]);
      if (rows.length) playerId = rows[0].player_id;
    } catch {}
  }
  if (!playerId) {
    // Best effort fallback using last auth
    playerId = lastAuthDebug?.response?.playerId || makePlayerId(hex(8));
  }
  const payload = {
    error: 0, code: 0, result: true, success: true, status: "OK",
    httpCode: 200,
    playerId, id: playerId, uid: playerId, userId: playerId,
    profile: {
      level: 1, exp: 0, role: "Survivor",
      rank: { name: "Bronze", point: 0, mmr: 0 },
      balance: { coin: 0, gem: 0 },
      lootbox: { balance: 0 }
    },
    inventory: { items: [] }
  };
  res.json(payload);
});

app.get("/live/version", (req, res) => {
  res.json({
    error: 0, code: 0, result: true, success: true, status: "OK",
    version: "1.0.6.0", required: false
  });
});

app.get("/live/announcement", (req, res) => {
  res.json({
    error: 0, code: 0, result: true, success: true, status: "OK",
    announcements: []
  });
});

app.get("/live/mail/get", (req, res) => {
  res.json({ error: 0, code: 0, result: true, success: true, status: "OK", mails: [] });
});

app.get("/live/ranked/info", (req, res) => {
  res.json({
    error: 0, code: 0, result: true, success: true, status: "OK",
    rank: { name: "Bronze", point: 0, mmr: 0 }
  });
});

app.get("/live/lootbox/balance", (req, res) => {
  res.json({ error: 0, code: 0, result: true, success: true, status: "OK", balance: 0 });
});

// Legacy 'live' prefix passthrough for any unimplemented GET
app.all("/live/*", (req, res) => {
  res.json({ error: 0, code: 0, result: true, success: true, status: "OK" });
});

ensureSchema().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on :${PORT}`);
  });
}).catch(err => {
  console.error("[DB] init error:", err);
  // Still start server so /health works
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on :${PORT}`);
  });
});
